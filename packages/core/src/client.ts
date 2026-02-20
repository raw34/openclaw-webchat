import { createBrowserDeviceAuthProvider } from './deviceAuth';
import type {
  OpenClawClientOptions,
  OpenClawClientEvents,
  ConnectionState,
  ClientState,
  Frame,
  RequestFrame,
  ResponseFrame,
  EventFrame,
  ConnectParams,
  HelloOkPayload,
  Message,
  ChatSendParams,
  ChatHistoryParams,
  ChatInjectParams,
  MessageEvent,
  StreamChunkEvent,
  ErrorPayload,
  OpenClawErrorCode,
  DeviceAuthProvider,
  ConnectChallenge,
} from './types';

type EventCallback<T extends keyof OpenClawClientEvents> = OpenClawClientEvents[T];

const DEFAULT_OPTIONS: Required<
  Pick<
    OpenClawClientOptions,
    | 'reconnect'
    | 'reconnectInterval'
    | 'maxReconnectAttempts'
    | 'connectionTimeout'
    | 'debug'
    | 'clientName'
    | 'clientVersion'
  >
> = {
  reconnect: true,
  reconnectInterval: 3000,
  maxReconnectAttempts: 10,
  connectionTimeout: 10000,
  debug: false,
  clientName: 'webchat',
  clientVersion: '0.1.0',
};

class OpenClawClientError extends Error {
  code: OpenClawErrorCode;
  rawCode?: string;

  constructor(message: string, code: OpenClawErrorCode, rawCode?: string) {
    super(message);
    this.name = 'OpenClawClientError';
    this.code = code;
    this.rawCode = rawCode;
  }
}

/**
 * OpenClaw Gateway WebSocket Client
 */
export class OpenClawClient {
  private options: OpenClawClientOptions & typeof DEFAULT_OPTIONS;
  private ws: WebSocket | null = null;
  private messageId = 0;
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (reason: Error) => void;
      timeout: ReturnType<typeof setTimeout>;
    }
  >();
  private eventListeners = new Map<string, Set<Function>>();
  private state: ClientState = {
    connectionState: 'disconnected',
    reconnectAttempts: 0,
  };
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private deviceToken: string | undefined;
  private sessionKey: string | undefined;
  private currentStreamingMessageId: string | null = null;
  private lastStreamedContent = '';
  private deviceAuthProvider: DeviceAuthProvider | null = null;
  private lastChallenge: ConnectChallenge | null = null;
  private hasRetriedTokenMismatch = false;
  private forceSharedAuthOnce = false;

  constructor(options: OpenClawClientOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.deviceToken = options.deviceToken;
    this.sessionKey = options.sessionKey;
    this.deviceAuthProvider = options.deviceAuthProvider ?? null;
  }

  // ============ Connection ============

  async connect(): Promise<void> {
    if (this.state.connectionState === 'connected') {
      return;
    }

    try {
      this.ensureDeviceAuthSupport();
    } catch (error) {
      const typed = this.toClientError(error);
      this.setState({ connectionState: 'error', error: typed });
      this.emit('error', typed);
      throw typed;
    }

    this.setState({ connectionState: 'connecting' });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.ws?.close();
        reject(new Error('Connection timeout'));
      }, this.options.connectionTimeout);

      try {
        this.ws = new WebSocket(this.options.gateway);

        this.ws.onopen = () => {
          this.log('WebSocket connected, starting handshake...');
          this.setState({ connectionState: 'authenticating' });
        };

        this.ws.onmessage = async (event) => {
          try {
            this.log('Received raw message:', event.data);
            const frame = JSON.parse(event.data) as Frame;
            await this.handleFrame(frame, resolve, reject, timeout);
          } catch (err) {
            this.log('Failed to parse frame:', err);
          }
        };

        this.ws.onerror = (event) => {
          this.log('WebSocket error:', event);
          clearTimeout(timeout);
          const error = new Error('WebSocket error');
          this.setState({ connectionState: 'error', error });
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          this.log('WebSocket closed:', event.code, event.reason);
          clearTimeout(timeout);
          this.handleDisconnect(event.reason);
        };
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
  }

  disconnect(): void {
    this.options.reconnect = false;
    this.clearReconnectTimer();
    this.ws?.close(1000, 'Client disconnect');
    this.ws = null;
    this.setState({ connectionState: 'disconnected' });
    this.emit('disconnected', 'Client disconnect');
  }

  get isConnected(): boolean {
    return this.state.connectionState === 'connected';
  }

  get connectionState(): ConnectionState {
    return this.state.connectionState;
  }

  async resetDeviceIdentity(): Promise<void> {
    this.deviceToken = undefined;
    const provider = this.getDeviceAuthProvider();
    if (provider?.resetIdentity) {
      await provider.resetIdentity();
      return;
    }
    if (provider?.isSupported()) {
      await provider.clearDeviceToken();
    }
  }

  // ============ Chat Methods ============

  async send(content: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.sessionKey) {
      throw new Error('No session key available. Set sessionKey in options or wait for connection.');
    }
    const params: ChatSendParams = {
      sessionKey: this.sessionKey,
      message: content,
      idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      metadata,
    };
    await this.request('chat.send', params);
  }

  async getHistory(limit = 50, before?: string): Promise<Message[]> {
    const params: ChatHistoryParams = { limit, before };
    const response = await this.request<{ messages: Message[] }>('chat.history', params);
    return response.messages;
  }

  async inject(content: string, role: 'assistant' | 'system' = 'system'): Promise<void> {
    const params: ChatInjectParams = { content, role };
    await this.request('chat.inject', params);
  }

  // ============ Event Handling ============

  on<K extends keyof OpenClawClientEvents>(event: K, callback: EventCallback<K>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  off<K extends keyof OpenClawClientEvents>(event: K, callback: EventCallback<K>): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  once<K extends keyof OpenClawClientEvents>(event: K, callback: EventCallback<K>): () => void {
    const wrapper = ((...args: Parameters<EventCallback<K>>) => {
      this.off(event, wrapper as EventCallback<K>);
      (callback as Function)(...args);
    }) as EventCallback<K>;
    return this.on(event, wrapper);
  }

  // ============ Private Methods ============

  private emit<K extends keyof OpenClawClientEvents>(
    event: K,
    ...args: Parameters<EventCallback<K>>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          (callback as Function)(...args);
        } catch (err) {
          this.log('Event handler error:', err);
        }
      });
    }
  }

  private async handleFrame(
    frame: Frame,
    connectResolve?: (value: void) => void,
    connectReject?: (reason: Error) => void,
    connectTimeout?: ReturnType<typeof setTimeout>
  ): Promise<void> {
    this.log('Received frame:', frame.type, 'method' in frame ? frame.method : '');

    switch (frame.type) {
      case 'req':
        await this.handleRequest(frame as RequestFrame, connectReject);
        break;
      case 'res':
        await this.handleResponse(
          frame as ResponseFrame,
          connectResolve,
          connectReject,
          connectTimeout
        );
        break;
      case 'event':
        await this.handleEvent(frame as EventFrame, connectReject);
        break;
    }
  }

  private async handleRequest(
    frame: RequestFrame,
    connectReject?: (reason: Error) => void
  ): Promise<void> {
    if (frame.method === 'connect.challenge') {
      this.log('Received challenge, sending connect request...');
      const challenge = this.parseChallenge(frame.params);
      try {
        await this.sendConnectRequest(challenge);
      } catch (error) {
        if (connectReject) {
          connectReject(this.toClientError(error));
        }
      }
    }
  }

  private async handleResponse(
    frame: ResponseFrame,
    connectResolve?: (value: void) => void,
    connectReject?: (reason: Error) => void,
    connectTimeout?: ReturnType<typeof setTimeout>
  ): Promise<void> {
    const payload = frame.payload as HelloOkPayload;
    if (frame.ok && payload && payload.type === 'hello-ok') {
      this.log('Connected to gateway:', payload.server?.host || payload.server?.version);

      if (payload.auth?.deviceToken) {
        this.deviceToken = payload.auth.deviceToken;
        await this.persistDeviceToken(payload.auth.deviceToken);
      }

      if (!this.sessionKey && payload.snapshot?.sessionDefaults?.mainSessionKey) {
        this.sessionKey = payload.snapshot.sessionDefaults.mainSessionKey;
        this.log('Using session key:', this.sessionKey);
      }

      this.hasRetriedTokenMismatch = false;
      this.forceSharedAuthOnce = false;
      this.setState({ connectionState: 'connected', reconnectAttempts: 0 });
      this.emit('connected');

      if (connectTimeout) clearTimeout(connectTimeout);
      if (connectResolve) connectResolve();
      return;
    }

    const pending = this.pendingRequests.get(frame.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(frame.id);

      if (frame.ok) {
        pending.resolve(frame.payload);
      } else {
        pending.reject(this.createError(frame.error, 'Request failed'));
      }
      return;
    }

    if (!frame.ok && connectReject) {
      if (this.shouldRetryAfterTokenMismatch(frame.error)) {
        try {
          await this.retryConnectAfterTokenMismatch();
          return;
        } catch (error) {
          if (connectTimeout) clearTimeout(connectTimeout);
          connectReject(this.toClientError(error));
          return;
        }
      }

      if (connectTimeout) clearTimeout(connectTimeout);
      connectReject(this.createError(frame.error, 'Connection failed'));
    }
  }

  private async handleEvent(frame: EventFrame, connectReject?: (reason: Error) => void): Promise<void> {
    switch (frame.event) {
      case 'connect.challenge': {
        this.log('Received challenge event, sending connect request...');
        const challenge = this.parseChallenge(frame.payload);
        try {
          await this.sendConnectRequest(challenge);
        } catch (error) {
          if (connectReject) {
            connectReject(this.toClientError(error));
          }
        }
        break;
      }

      case 'message': {
        const msgEvent = frame.payload as MessageEvent;
        this.emit('message', msgEvent.message);
        break;
      }

      case 'stream.start': {
        const startEvent = frame.payload as { messageId: string };
        this.emit('streamStart', startEvent.messageId);
        break;
      }

      case 'stream.chunk': {
        const chunkEvent = frame.payload as StreamChunkEvent;
        this.emit('streamChunk', chunkEvent.messageId, chunkEvent.chunk);
        if (chunkEvent.done) {
          this.emit('streamEnd', chunkEvent.messageId);
        }
        break;
      }

      case 'chat':
        this.handleChatEvent(frame.payload);
        break;

      case 'agent':
        this.log('Agent event:', frame.payload);
        break;

      case 'health':
      case 'tick':
      case 'heartbeat':
      case 'presence':
        break;

      default:
        this.log('Unknown event:', frame.event);
    }
  }

  private handleChatEvent(payload: unknown): void {
    const chatPayload = payload as {
      runId?: string;
      sessionKey?: string;
      seq?: number;
      state?: 'delta' | 'final';
      message?: {
        role?: string;
        content?: Array<{ type: string; text: string }>;
        timestamp?: number;
      };
    };

    this.log('Chat event:', chatPayload.state, 'seq:', chatPayload.seq);

    const messageId = chatPayload.runId || 'stream';
    const contentBlocks = chatPayload.message?.content || [];
    const fullContent = contentBlocks
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('');

    if (!this.currentStreamingMessageId && chatPayload.state === 'delta') {
      this.currentStreamingMessageId = messageId;
      this.lastStreamedContent = '';
      this.emit('streamStart', messageId);
    }

    if (fullContent.length > this.lastStreamedContent.length) {
      const newChunk = fullContent.slice(this.lastStreamedContent.length);
      if (newChunk && this.currentStreamingMessageId) {
        this.emit('streamChunk', this.currentStreamingMessageId, newChunk);
      }
      this.lastStreamedContent = fullContent;
    }

    if (chatPayload.state === 'final') {
      const message: Message = {
        id: messageId,
        role: 'assistant',
        content: fullContent,
        timestamp: chatPayload.message?.timestamp || Date.now(),
      };
      this.emit('message', message);
      this.emit('streamEnd', messageId);

      this.currentStreamingMessageId = null;
      this.lastStreamedContent = '';
    }
  }

  private async sendConnectRequest(challenge?: ConnectChallenge): Promise<void> {
    const provider = this.getDeviceAuthProvider();
    const isBrowser = typeof window !== 'undefined';
    if (isBrowser && provider && !provider.isSupported()) {
      throw new OpenClawClientError(
        'Device auth requires IndexedDB + WebCrypto support in browser',
        'DEVICE_AUTH_UNSUPPORTED'
      );
    }

    this.lastChallenge = challenge ?? this.lastChallenge;

    const params: ConnectParams = {
      minProtocol: 3,
      maxProtocol: 3,
      client: {
        id: this.options.clientName,
        version: this.options.clientVersion,
        platform: isBrowser ? 'browser' : 'node',
        mode: 'node',
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
    };

    if (!this.forceSharedAuthOnce && provider?.isSupported() && !this.deviceToken) {
      this.deviceToken = await provider.getDeviceToken();
    }

    const authToken =
      this.deviceToken && !this.forceSharedAuthOnce ? this.deviceToken : this.options.token;

    if (authToken) {
      params.auth = { token: authToken };
    } else if (this.options.password) {
      params.auth = { password: this.options.password };
    }

    if (challenge && provider?.isSupported()) {
      params.device = await provider.signChallenge(challenge, {
        clientId: this.options.clientName,
        clientMode: 'node',
        role: 'operator',
        scopes: params.scopes,
        token: authToken ?? null,
      });
    }

    this.forceSharedAuthOnce = false;

    this.sendFrame({
      type: 'req',
      id: this.nextId(),
      method: 'connect',
      params,
    });
  }

  private async request<T = unknown>(method: string, params?: unknown): Promise<T> {
    if (!this.isConnected) {
      throw new Error('Not connected');
    }

    const id = this.nextId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      this.sendFrame({
        type: 'req',
        id,
        method,
        params,
      });
    });
  }

  private sendFrame(frame: Frame): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const json = JSON.stringify(frame);
      this.log('Sending frame:', frame.type, 'method' in frame ? frame.method : '', json);
      this.ws.send(json);
    } else {
      this.log('Cannot send frame, WebSocket not open');
    }
  }

  private nextId(): string {
    return `${Date.now()}-${++this.messageId}`;
  }

  private handleDisconnect(reason?: string): void {
    const wasConnected = this.state.connectionState === 'connected';
    this.ws = null;

    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Disconnected'));
    });
    this.pendingRequests.clear();

    if (wasConnected) {
      this.emit('disconnected', reason);
    }

    if (this.options.reconnect && this.shouldReconnect()) {
      this.scheduleReconnect();
    } else {
      this.setState({ connectionState: 'disconnected' });
    }
  }

  private shouldReconnect(): boolean {
    const maxAttempts = this.options.maxReconnectAttempts;
    return maxAttempts === -1 || this.state.reconnectAttempts < maxAttempts;
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    const attempt = this.state.reconnectAttempts + 1;
    this.setState({ connectionState: 'reconnecting', reconnectAttempts: attempt });
    this.emit('reconnecting', attempt);

    this.log(`Reconnecting in ${this.options.reconnectInterval}ms (attempt ${attempt})...`);

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (err) {
        this.log('Reconnect failed:', err);
      }
    }, this.options.reconnectInterval);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(partial: Partial<ClientState>): void {
    this.state = { ...this.state, ...partial };
    this.emit('stateChange', this.state);
  }

  private parseChallenge(payload: unknown): ConnectChallenge | undefined {
    const challenge = payload as Partial<ConnectChallenge> | undefined;
    if (!challenge || typeof challenge.nonce !== 'string') {
      return undefined;
    }

    return {
      nonce: challenge.nonce,
      timestamp: typeof challenge.timestamp === 'number' ? challenge.timestamp : Date.now(),
    };
  }

  private getDeviceAuthProvider(): DeviceAuthProvider | null {
    if (this.deviceAuthProvider) {
      return this.deviceAuthProvider;
    }

    if (typeof window === 'undefined') {
      return null;
    }

    this.deviceAuthProvider = createBrowserDeviceAuthProvider(this.options.gateway);
    return this.deviceAuthProvider;
  }

  private ensureDeviceAuthSupport(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const provider = this.getDeviceAuthProvider();
    if (provider && !provider.isSupported()) {
      throw new OpenClawClientError(
        'Device auth requires IndexedDB + WebCrypto support in browser',
        'DEVICE_AUTH_UNSUPPORTED'
      );
    }
  }

  private shouldRetryAfterTokenMismatch(error?: ErrorPayload): boolean {
    if (this.hasRetriedTokenMismatch) {
      return false;
    }

    const message = String(error?.message ?? '').toLowerCase();
    if (!message) {
      return false;
    }

    return (
      message.includes('gateway token mismatch') ||
      message.includes('device token mismatch') ||
      message.includes('token mismatch')
    );
  }

  private async retryConnectAfterTokenMismatch(): Promise<void> {
    this.hasRetriedTokenMismatch = true;
    this.forceSharedAuthOnce = true;
    this.deviceToken = undefined;

    const provider = this.getDeviceAuthProvider();
    if (provider?.isSupported()) {
      await provider.clearDeviceToken();
    }

    await this.sendConnectRequest(this.lastChallenge ?? undefined);
  }

  private classifyErrorCode(error?: ErrorPayload): OpenClawErrorCode {
    const code = error?.code;
    const message = String(error?.message ?? '').toLowerCase();

    if (message.includes('missing scope') && message.includes('operator.write')) {
      return 'SCOPE_MISSING_WRITE';
    }

    if (message.includes('pairing')) {
      return 'PAIRING_REQUIRED';
    }

    if (code === 'AUTH_FAILED') {
      return 'AUTH_FAILED';
    }

    if (code === 'INVALID_REQUEST') {
      return 'INVALID_REQUEST';
    }

    if (code === 'PAIRING_REQUIRED') {
      return 'PAIRING_REQUIRED';
    }

    return 'UNKNOWN';
  }

  private createError(error: ErrorPayload | undefined, fallback: string): OpenClawClientError {
    const message = error?.message || fallback;
    const code = this.classifyErrorCode(error);
    return new OpenClawClientError(message, code, error?.code);
  }

  private toClientError(error: unknown): OpenClawClientError {
    if (error instanceof OpenClawClientError) {
      return error;
    }

    if (error instanceof Error) {
      return new OpenClawClientError(error.message, 'UNKNOWN');
    }

    return new OpenClawClientError('Unknown error', 'UNKNOWN');
  }

  private async persistDeviceToken(token: string): Promise<void> {
    const provider = this.getDeviceAuthProvider();
    if (provider?.isSupported()) {
      await provider.setDeviceToken(token);
    }
  }

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[OpenClawClient]', ...args);
    }
  }
}
