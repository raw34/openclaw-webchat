import { useState, useEffect, useCallback, useRef } from 'react';
import {
  OpenClawClient,
  OpenClawClientOptions,
  Message,
  ConnectionState,
} from '@raw34/chat-core';

export interface UseOpenClawChatOptions extends OpenClawClientOptions {
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
}

export interface UseOpenClawChatReturn {
  /** All messages in the conversation */
  messages: Message[];

  /** Current connection state */
  connectionState: ConnectionState;

  /** Whether connected to the gateway */
  isConnected: boolean;

  /** Whether currently loading (sending message or waiting for response) */
  isLoading: boolean;

  /** Current streaming content (while AI is responding) */
  streamingContent: string;

  /** Last error if any */
  error: Error | null;

  /** Send a message to the AI */
  send: (content: string) => Promise<void>;

  /** Connect to the gateway */
  connect: () => Promise<void>;

  /** Disconnect from the gateway */
  disconnect: () => void;

  /** Clear all messages */
  clearMessages: () => void;

  /** Load chat history */
  loadHistory: (limit?: number) => Promise<void>;

  /** The underlying client instance */
  client: OpenClawClient | null;
}

/**
 * React hook for OpenClaw WebChat
 *
 * @example
 * ```tsx
 * function Chat() {
 *   const {
 *     messages,
 *     isConnected,
 *     isLoading,
 *     streamingContent,
 *     send
 *   } = useOpenClawChat({
 *     gateway: 'wss://ai.example.com:18789',
 *     token: 'your-token'
 *   });
 *
 *   return (
 *     <div>
 *       {messages.map(m => (
 *         <div key={m.id}>{m.role}: {m.content}</div>
 *       ))}
 *       {isLoading && <div>AI is typing: {streamingContent}</div>}
 *       <input
 *         onKeyDown={e => {
 *           if (e.key === 'Enter') {
 *             send(e.currentTarget.value);
 *             e.currentTarget.value = '';
 *           }
 *         }}
 *         disabled={!isConnected}
 *       />
 *     </div>
 *   );
 * }
 * ```
 */
export function useOpenClawChat(options: UseOpenClawChatOptions): UseOpenClawChatReturn {
  const { autoConnect = true, ...clientOptions } = options;

  const clientRef = useRef<OpenClawClient | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<Error | null>(null);

  // Initialize client when gateway changes
  useEffect(() => {
    // Skip if no gateway provided
    if (!clientOptions.gateway) {
      return;
    }

    const client = new OpenClawClient(clientOptions);
    clientRef.current = client;

    // Set up event listeners
    client.on('connected', () => {
      setConnectionState('connected');
      setError(null);
    });

    client.on('disconnected', () => {
      setConnectionState('disconnected');
    });

    client.on('reconnecting', () => {
      setConnectionState('reconnecting');
    });

    client.on('error', (err) => {
      setError(err);
    });

    client.on('stateChange', (state) => {
      setConnectionState(state.connectionState);
      if (state.error) {
        setError(state.error);
      }
    });

    client.on('message', (message) => {
      setMessages((prev) => [...prev, message]);
      setIsLoading(false);
      setStreamingContent('');
    });

    client.on('streamStart', () => {
      setIsLoading(true);
      setStreamingContent('');
    });

    client.on('streamChunk', (_, chunk) => {
      setStreamingContent((prev) => prev + chunk);
    });

    client.on('streamEnd', () => {
      setIsLoading(false);
    });

    // Auto-connect if enabled
    if (autoConnect) {
      client.connect().catch((err) => {
        setError(err);
      });
    }

    // Cleanup
    return () => {
      client.disconnect();
      clientRef.current = null;
    };
  }, [clientOptions.gateway, clientOptions.token, autoConnect]);  // Re-initialize when gateway or token changes

  const connect = useCallback(async () => {
    if (!clientRef.current) return;
    try {
      setError(null);
      await clientRef.current.connect();
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
  }, []);

  const send = useCallback(async (content: string) => {
    if (!clientRef.current?.isConnected) {
      throw new Error('Not connected');
    }

    try {
      setIsLoading(true);
      setError(null);

      // Add user message immediately
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMessage]);

      await clientRef.current.send(content);
    } catch (err) {
      setIsLoading(false);
      setError(err as Error);
      throw err;
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingContent('');
  }, []);

  const loadHistory = useCallback(async (limit = 50) => {
    if (!clientRef.current?.isConnected) {
      throw new Error('Not connected');
    }

    try {
      const history = await clientRef.current.getHistory(limit);
      setMessages(history);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, []);

  return {
    messages,
    connectionState,
    isConnected: connectionState === 'connected',
    isLoading,
    streamingContent,
    error,
    send,
    connect,
    disconnect,
    clearMessages,
    loadHistory,
    client: clientRef.current,
  };
}
