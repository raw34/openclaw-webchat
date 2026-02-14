import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenClawClient } from '../client';
import { MockWebSocket } from './MockWebSocket';

// Mock WebSocket globally
vi.stubGlobal('WebSocket', MockWebSocket);

describe('OpenClawClient', () => {
  beforeEach(() => {
    MockWebSocket.reset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('connection', () => {
    it('should connect successfully with handshake', async () => {
      const client = new OpenClawClient({
        gateway: 'ws://localhost:18789',
        token: 'test-token',
        connectionTimeout: 5000,
      });

      const connectPromise = client.connect();

      // Get WebSocket instance
      const ws = MockWebSocket.getLastInstance()!;
      expect(ws).toBeDefined();

      // Simulate connection open
      ws.simulateOpen();

      // Server sends challenge
      ws.simulateMessage({
        type: 'req',
        id: 'challenge-1',
        method: 'connect.challenge',
        params: { nonce: 'abc123', timestamp: Date.now() },
      });

      // Client should send connect request
      await vi.waitFor(() => {
        const messages = ws.getSentMessages();
        expect(messages.length).toBeGreaterThan(0);
      });

      const connectReq = ws.getLastSentMessage() as {
        type: string;
        id: string;
        method: string;
        params: { auth: { token: string } };
      };
      expect(connectReq.type).toBe('req');
      expect(connectReq.method).toBe('connect');
      expect(connectReq.params.auth.token).toBe('test-token');

      // Server sends hello-ok
      ws.simulateMessage({
        type: 'res',
        id: connectReq.id,
        ok: true,
        payload: {
          protocol: { version: '1.0' },
          gateway: { version: '1.0.0', name: 'Test Gateway' },
        },
      });

      await connectPromise;
      expect(client.isConnected).toBe(true);
      expect(client.connectionState).toBe('connected');
    });

    it('should handle connection timeout', async () => {
      vi.useFakeTimers();

      const client = new OpenClawClient({
        gateway: 'ws://localhost:18789',
        connectionTimeout: 1000,
      });

      const connectPromise = client.connect();

      // Don't simulate open - let it timeout
      vi.advanceTimersByTime(1500);

      await expect(connectPromise).rejects.toThrow('Connection timeout');

      vi.useRealTimers();
    });

    it('should handle authentication failure', async () => {
      const client = new OpenClawClient({
        gateway: 'ws://localhost:18789',
        token: 'invalid-token',
      });

      const connectPromise = client.connect();
      const ws = MockWebSocket.getLastInstance()!;

      ws.simulateOpen();

      // Server sends challenge
      ws.simulateMessage({
        type: 'req',
        id: 'challenge-1',
        method: 'connect.challenge',
        params: { nonce: 'abc123', timestamp: Date.now() },
      });

      await vi.waitFor(() => ws.getSentMessages().length > 0);

      // Server rejects connection
      ws.simulateMessage({
        type: 'res',
        id: (ws.getLastSentMessage() as { id: string }).id,
        ok: false,
        error: { code: 'AUTH_FAILED', message: 'Invalid token' },
      });

      await expect(connectPromise).rejects.toThrow('Invalid token');
    });
  });

  describe('messaging', () => {
    async function createConnectedClient(): Promise<{
      client: OpenClawClient;
      ws: MockWebSocket;
    }> {
      const client = new OpenClawClient({
        gateway: 'ws://localhost:18789',
        token: 'test-token',
      });

      const connectPromise = client.connect();
      const ws = MockWebSocket.getLastInstance()!;

      ws.simulateOpen();
      ws.simulateMessage({
        type: 'req',
        id: 'challenge-1',
        method: 'connect.challenge',
        params: { nonce: 'abc', timestamp: Date.now() },
      });

      await vi.waitFor(() => ws.getSentMessages().length > 0);

      ws.simulateMessage({
        type: 'res',
        id: (ws.getLastSentMessage() as { id: string }).id,
        ok: true,
        payload: {
          protocol: { version: '1.0' },
          gateway: { version: '1.0.0' },
        },
      });

      await connectPromise;
      return { client, ws };
    }

    it('should send message correctly', async () => {
      const { client, ws } = await createConnectedClient();

      const sendPromise = client.send('Hello, AI!');

      await vi.waitFor(() => {
        const messages = ws.getSentMessages();
        return messages.some(
          (m) => (m as { method?: string }).method === 'chat.send'
        );
      });

      const sendReq = ws.getSentMessages().find(
        (m) => (m as { method?: string }).method === 'chat.send'
      ) as { id: string; params: { content: string } };

      expect(sendReq.params.content).toBe('Hello, AI!');

      // Server acknowledges
      ws.simulateMessage({
        type: 'res',
        id: sendReq.id,
        ok: true,
        payload: {},
      });

      await sendPromise;
    });

    it('should emit message event on server message', async () => {
      const { client, ws } = await createConnectedClient();

      const messageHandler = vi.fn();
      client.on('message', messageHandler);

      ws.simulateMessage({
        type: 'event',
        event: 'message',
        payload: {
          message: {
            id: 'msg-1',
            role: 'assistant',
            content: 'Hello!',
            timestamp: Date.now(),
          },
        },
      });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          role: 'assistant',
          content: 'Hello!',
        })
      );
    });

    it('should handle streaming response', async () => {
      const { client, ws } = await createConnectedClient();

      const streamStartHandler = vi.fn();
      const streamChunkHandler = vi.fn();
      const streamEndHandler = vi.fn();

      client.on('streamStart', streamStartHandler);
      client.on('streamChunk', streamChunkHandler);
      client.on('streamEnd', streamEndHandler);

      // Stream start
      ws.simulateMessage({
        type: 'event',
        event: 'stream.start',
        payload: { messageId: 'msg-1' },
      });

      expect(streamStartHandler).toHaveBeenCalledWith('msg-1');

      // Stream chunks
      ws.simulateMessage({
        type: 'event',
        event: 'stream.chunk',
        payload: { messageId: 'msg-1', chunk: 'Hello', done: false },
      });

      expect(streamChunkHandler).toHaveBeenCalledWith('msg-1', 'Hello');

      ws.simulateMessage({
        type: 'event',
        event: 'stream.chunk',
        payload: { messageId: 'msg-1', chunk: ' World!', done: true },
      });

      expect(streamChunkHandler).toHaveBeenCalledWith('msg-1', ' World!');
      expect(streamEndHandler).toHaveBeenCalledWith('msg-1');
    });
  });

  describe('reconnection', () => {
    it('should auto-reconnect on disconnect', async () => {
      vi.useFakeTimers();

      const client = new OpenClawClient({
        gateway: 'ws://localhost:18789',
        token: 'test-token',
        reconnect: true,
        reconnectInterval: 1000,
        maxReconnectAttempts: 3,
      });

      // Initial connection
      const connectPromise = client.connect();
      const ws = MockWebSocket.getLastInstance()!;

      ws.simulateOpen();
      ws.simulateMessage({
        type: 'req',
        id: 'c1',
        method: 'connect.challenge',
        params: { nonce: 'abc', timestamp: Date.now() },
      });

      await vi.waitFor(() => ws.getSentMessages().length > 0);

      ws.simulateMessage({
        type: 'res',
        id: (ws.getLastSentMessage() as { id: string }).id,
        ok: true,
        payload: {
          protocol: { version: '1.0' },
          gateway: { version: '1.0.0' },
        },
      });

      await connectPromise;
      expect(client.isConnected).toBe(true);

      const reconnectingHandler = vi.fn();
      client.on('reconnecting', reconnectingHandler);

      // Simulate disconnect
      ws.simulateClose(1006, 'Connection lost');

      // Wait for reconnect timer
      vi.advanceTimersByTime(1000);

      expect(reconnectingHandler).toHaveBeenCalledWith(1);

      vi.useRealTimers();
    });

    it('should not reconnect when manually disconnected', async () => {
      const client = new OpenClawClient({
        gateway: 'ws://localhost:18789',
        reconnect: true,
      });

      const connectPromise = client.connect();
      const ws = MockWebSocket.getLastInstance()!;

      ws.simulateOpen();
      ws.simulateMessage({
        type: 'req',
        id: 'c1',
        method: 'connect.challenge',
        params: { nonce: 'abc', timestamp: Date.now() },
      });

      await vi.waitFor(() => ws.getSentMessages().length > 0);

      ws.simulateMessage({
        type: 'res',
        id: (ws.getLastSentMessage() as { id: string }).id,
        ok: true,
        payload: {
          protocol: { version: '1.0' },
          gateway: { version: '1.0.0' },
        },
      });

      await connectPromise;

      const initialInstanceCount = MockWebSocket.instances.length;

      // Manual disconnect
      client.disconnect();

      expect(client.connectionState).toBe('disconnected');
      // No new WebSocket instance should be created
      expect(MockWebSocket.instances.length).toBe(initialInstanceCount);
    });
  });
});
