export { OpenClawClient } from './client';
export { createBrowserDeviceAuthProvider } from './deviceAuth';
export type {
  // Client Options
  OpenClawClientOptions,
  OpenClawClientEvents,
  ConnectionState,
  ClientState,

  // Protocol Types
  Frame,
  FrameType,
  RequestFrame,
  ResponseFrame,
  EventFrame,
  ErrorPayload,

  // Connection
  ConnectChallenge,
  ConnectParams,
  HelloOkPayload,
  DeviceIdentity,
  DeviceProof,
  DeviceAuthProvider,
  OpenClawErrorCode,

  // Chat
  Message,
  ChatSendParams,
  ChatHistoryParams,
  ChatInjectParams,
  MessageEvent,
  StreamChunkEvent,
} from './types';
