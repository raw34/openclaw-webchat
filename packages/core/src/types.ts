/**
 * OpenClaw Gateway WebSocket Protocol Types
 * Based on: https://docs.openclaw.ai/gateway/protocol
 */

// ============ Frame Types ============

export type FrameType = 'req' | 'res' | 'event';

export interface RequestFrame<T = unknown> {
  type: 'req';
  id: string;
  method: string;
  params?: T;
}

export interface ResponseFrame<T = unknown> {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: T;
  error?: ErrorPayload;
}

export interface EventFrame<T = unknown> {
  type: 'event';
  event: string;
  payload: T;
  seq?: number;
  stateVersion?: number;
}

export type Frame = RequestFrame | ResponseFrame | EventFrame;

export interface ErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

// ============ Connection ============

export interface ConnectChallenge {
  nonce: string;
  timestamp: number;
}

export interface ConnectParams {
  minProtocol: number;
  maxProtocol: number;
  client: {
    id: string;
    version: string;
    platform: string;
    mode: 'operator' | 'node';
  };
  scopes: string[];
  auth?: {
    token?: string;
    password?: string;
    deviceToken?: string;
  };
  device?: DeviceProof;
}

export interface HelloOkPayload {
  type: 'hello-ok';
  protocol: number;
  server: {
    version: string;
    host?: string;
    connId?: string;
  };
  features?: {
    methods?: string[];
    events?: string[];
  };
  snapshot?: {
    sessionDefaults?: {
      mainSessionKey?: string;
      defaultAgentId?: string;
    };
  };
  auth?: {
    deviceToken?: string;
  };
}

// ============ Chat ============

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ChatSendParams {
  sessionKey: string;
  message: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface ChatHistoryParams {
  limit?: number;
  before?: string;
}

export interface ChatInjectParams {
  content: string;
  role?: 'assistant' | 'system';
}

// ============ Events ============

export interface MessageEvent {
  message: Message;
  streaming?: boolean;
  done?: boolean;
}

export interface StreamChunkEvent {
  messageId: string;
  chunk: string;
  done: boolean;
}

// ============ Client Options ============

export interface OpenClawClientOptions {
  /** Gateway WebSocket URL, e.g. ws://localhost:18789 or wss://ai.example.com */
  gateway: string;

  /** Authentication token */
  token?: string;

  /** Authentication password (alternative to token) */
  password?: string;

  /** Device token for persistent sessions */
  deviceToken?: string;

  /** Optional override for device-auth behavior */
  deviceAuthProvider?: DeviceAuthProvider;

  /** Client name for identification */
  clientName?: string;

  /** Client version */
  clientVersion?: string;

  /** Auto-reconnect on disconnect (default: true) */
  reconnect?: boolean;

  /** Reconnect interval in ms (default: 3000) */
  reconnectInterval?: number;

  /** Max reconnect attempts (default: 10, -1 for infinite) */
  maxReconnectAttempts?: number;

  /** Connection timeout in ms (default: 10000) */
  connectionTimeout?: number;

  /** Debug logging (default: false) */
  debug?: boolean;

  /** Session key for chat (auto-detected from connection if not provided) */
  sessionKey?: string;
}

// ============ Device Auth ============

export interface DeviceIdentity {
  id: string;
  publicKey: JsonWebKey;
  algorithm: string;
}

export interface DeviceProof {
  id: string;
  nonce: string;
  timestamp: number;
  algorithm: string;
  publicKey: JsonWebKey;
  signature: string;
}

export interface DeviceAuthProvider {
  isSupported(): boolean;
  getOrCreateIdentity(): Promise<DeviceIdentity>;
  signChallenge(challenge: ConnectChallenge): Promise<DeviceProof>;
  getDeviceToken(): Promise<string | undefined>;
  setDeviceToken(token: string): Promise<void>;
  clearDeviceToken(): Promise<void>;
  resetIdentity?(): Promise<void>;
}

export type OpenClawErrorCode =
  | 'AUTH_FAILED'
  | 'INVALID_REQUEST'
  | 'PAIRING_REQUIRED'
  | 'DEVICE_AUTH_UNSUPPORTED'
  | 'SCOPE_MISSING_WRITE'
  | 'UNKNOWN';

// ============ Client State ============

export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface ClientState {
  connectionState: ConnectionState;
  error?: Error;
  reconnectAttempts: number;
}

// ============ Event Handlers ============

export interface OpenClawClientEvents {
  connected: () => void;
  disconnected: (reason?: string) => void;
  reconnecting: (attempt: number) => void;
  error: (error: Error) => void;
  message: (message: Message) => void;
  streamStart: (messageId: string) => void;
  streamChunk: (messageId: string, chunk: string) => void;
  streamEnd: (messageId: string) => void;
  stateChange: (state: ClientState) => void;
}
