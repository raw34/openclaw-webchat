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
  clientName: 'openclaw-webchat',
  clientVersion: '0.1.0',
};

/**
 * OpenClaw Gateway WebSocket Client
 *
 * @example
 * ```typescript
 * const client = new OpenClawClient({
 *   gateway: 'ws://localhost:18789',
 *   token: 'your-token'
 * });
 *
 * client.on('message', (msg) => {
 *   console.log('AI:', msg.content);
 * });
 *
 * await client.connect();
 * await client.send('Hello, AI!');
 * ```
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

  constructor(options: OpenClawClientOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.deviceToken = options.deviceToken;
  }

  // ============ Connection ============

  /**
   * Connect to the OpenClaw Gateway
   */
  async connect(): Promise<void> {
    if (this.state.connectionState === 'connected') {
      return;
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

  /**
   * Disconnect from the Gateway
   */
  disconnect(): void {
    this.options.reconnect = false; // Prevent auto-reconnect
    this.clearReconnectTimer();
    this.ws?.close(1000, 'Client disconnect');
    this.ws = null;
    this.setState({ connectionState: 'disconnected' });
    this.emit('disconnected', 'Client disconnect');
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.state.connectionState === 'connected';
  }

  /**
   * Get current connection state
   */
  get connectionState(): ConnectionState {
    return this.state.connectionState;
  }

  // ============ Chat Methods ============

  /**
   * Send a message to the AI
   */
  async send(content: string, metadata?: Record<string, unknown>): Promise<void> {
    const params: ChatSendParams = { content, metadata };
    await this.request('chat.send', params);
  }

  /**
   * Get chat history
   */
  async getHistory(limit = 50, before?: string): Promise<Message[]> {
    const params: ChatHistoryParams = { limit, before };
    const response = await this.request<{ messages: Message[] }>('chat.history', params);
    return response.messages;
  }

  /**
   * Inject a system or assistant message (no agent run)
   */
  async inject(content: string, role: 'assistant' | 'system' = 'system'): Promise<void> {
    const params: ChatInjectParams = { content, role };
    await this.request('chat.inject', params);
  }

  // ============ Event Handling ============

  /**
   * Subscribe to events
   */
  on<K extends keyof OpenClawClientEvents>(event: K, callback: EventCallback<K>): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => this.off(event, callback);
  }

  /**
   * Unsubscribe from events
   */
  off<K extends keyof OpenClawClientEvents>(event: K, callback: EventCallback<K>): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  /**
   * Subscribe to an event once
   */
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
        await this.handleRequest(frame as RequestFrame);
        break;
      case 'res':
        this.handleResponse(frame as ResponseFrame, connectResolve, connectReject, connectTimeout);
        break;
      case 'event':
        this.handleEvent(frame as EventFrame);
        break;
    }
  }

  private async handleRequest(frame: RequestFrame): Promise<void> {
    // Handle server-initiated requests (e.g., connect.challenge)
    if (frame.method === 'connect.challenge') {
      this.log('Received challenge, sending connect request...');
      await this.sendConnectRequest();
    }
  }

  private handleResponse(
    frame: ResponseFrame,
    connectResolve?: (value: void) => void,
    connectReject?: (reason: Error) => void,
    connectTimeout?: ReturnType<typeof setTimeout>
  ): void {
    // Check for hello-ok (connection established)
    if (frame.ok && frame.payload && 'gateway' in (frame.payload as HelloOkPayload)) {
      const payload = frame.payload as HelloOkPayload;
      this.log('Connected to gateway:', payload.gateway.name || payload.gateway.version);

      // Save device token if provided
      if (payload.auth?.deviceToken) {
        this.deviceToken = payload.auth.deviceToken;
      }

      this.setState({ connectionState: 'connected', reconnectAttempts: 0 });
      this.emit('connected');

      if (connectTimeout) clearTimeout(connectTimeout);
      if (connectResolve) connectResolve();
      return;
    }

    // Handle pending request responses
    const pending = this.pendingRequests.get(frame.id);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(frame.id);

      if (frame.ok) {
        pending.resolve(frame.payload);
      } else {
        pending.reject(new Error(frame.error?.message || 'Request failed'));
      }
    }
  }

  private handleEvent(frame: EventFrame): void {
    switch (frame.event) {
      case 'message':
        const msgEvent = frame.payload as MessageEvent;
        this.emit('message', msgEvent.message);
        break;

      case 'stream.start':
        const startEvent = frame.payload as { messageId: string };
        this.emit('streamStart', startEvent.messageId);
        break;

      case 'stream.chunk':
        const chunkEvent = frame.payload as StreamChunkEvent;
        this.emit('streamChunk', chunkEvent.messageId, chunkEvent.chunk);
        if (chunkEvent.done) {
          this.emit('streamEnd', chunkEvent.messageId);
        }
        break;

      default:
        this.log('Unknown event:', frame.event);
    }
  }

  private async sendConnectRequest(): Promise<void> {
    const params: ConnectParams = {
      protocol: {
        version: '1.0',
        minVersion: '1.0',
      },
      client: {
        name: this.options.clientName,
        version: this.options.clientVersion,
        platform: typeof window !== 'undefined' ? 'browser' : 'node',
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write'],
      auth: {},
    };

    // Add authentication
    if (this.deviceToken) {
      params.auth!.deviceToken = this.deviceToken;
    } else if (this.options.token) {
      params.auth!.token = this.options.token;
    } else if (this.options.password) {
      params.auth!.password = this.options.password;
    }

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
      this.log('Sending frame:', frame.type, 'method' in frame ? frame.method : '');
      this.ws.send(JSON.stringify(frame));
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

    // Clear all pending requests
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Disconnected'));
    });
    this.pendingRequests.clear();

    if (wasConnected) {
      this.emit('disconnected', reason);
    }

    // Auto-reconnect if enabled
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
        // Will trigger handleDisconnect which schedules another reconnect
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

  private log(...args: unknown[]): void {
    if (this.options.debug) {
      console.log('[OpenClawClient]', ...args);
    }
  }
}
