import { ref, shallowRef, onMounted, onUnmounted, computed, watch, toRefs } from 'vue';
import type { Ref, ComputedRef } from 'vue';
import {
  OpenClawClient,
  OpenClawClientOptions,
  Message,
  ConnectionState,
} from 'openclaw-webchat';

export interface UseOpenClawChatOptions extends OpenClawClientOptions {
  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;
}

export interface UseOpenClawChatReturn {
  /** All messages in the conversation */
  messages: Ref<Message[]>;

  /** Current connection state */
  connectionState: Ref<ConnectionState>;

  /** Whether connected to the gateway */
  isConnected: ComputedRef<boolean>;

  /** Whether currently loading (sending message or waiting for response) */
  isLoading: Ref<boolean>;

  /** Current streaming content (while AI is responding) */
  streamingContent: Ref<string>;

  /** Last error if any */
  error: Ref<Error | null>;

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
  client: Ref<OpenClawClient | null>;
}

/**
 * Vue composable for OpenClaw WebChat
 *
 * @example
 * ```vue
 * <script setup>
 * import { useOpenClawChat } from 'openclaw-webchat-vue';
 *
 * const {
 *   messages,
 *   isConnected,
 *   isLoading,
 *   streamingContent,
 *   send
 * } = useOpenClawChat({
 *   gateway: 'wss://ai.example.com:18789',
 *   token: 'your-token'
 * });
 *
 * const input = ref('');
 *
 * function handleSend() {
 *   if (input.value.trim()) {
 *     send(input.value);
 *     input.value = '';
 *   }
 * }
 * </script>
 *
 * <template>
 *   <div>
 *     <div v-for="msg in messages" :key="msg.id">
 *       {{ msg.role }}: {{ msg.content }}
 *     </div>
 *     <div v-if="isLoading">AI is typing: {{ streamingContent }}</div>
 *     <input v-model="input" @keydown.enter="handleSend" :disabled="!isConnected" />
 *   </div>
 * </template>
 * ```
 */
export function useOpenClawChat(options: UseOpenClawChatOptions): UseOpenClawChatReturn {
  const { autoConnect = true, ...clientOptions } = options;

  const client = shallowRef<OpenClawClient | null>(null);
  const messages = ref<Message[]>([]);
  const connectionState = ref<ConnectionState>('disconnected');
  const isLoading = ref(false);
  const streamingContent = ref('');
  const error = ref<Error | null>(null);

  const isConnected = computed(() => connectionState.value === 'connected');

  function initializeClient() {
    // Skip if no gateway provided
    if (!clientOptions.gateway) {
      return;
    }

    // Cleanup existing client
    if (client.value) {
      client.value.disconnect();
      client.value = null;
    }

    const newClient = new OpenClawClient(clientOptions);
    client.value = newClient;

    // Set up event listeners
    newClient.on('connected', () => {
      connectionState.value = 'connected';
      error.value = null;
    });

    newClient.on('disconnected', () => {
      connectionState.value = 'disconnected';
    });

    newClient.on('reconnecting', () => {
      connectionState.value = 'reconnecting';
    });

    newClient.on('error', (err) => {
      error.value = err;
    });

    newClient.on('stateChange', (state) => {
      connectionState.value = state.connectionState;
      if (state.error) {
        error.value = state.error;
      }
    });

    newClient.on('message', (message) => {
      messages.value = [...messages.value, message];
      isLoading.value = false;
      streamingContent.value = '';
    });

    newClient.on('streamStart', () => {
      isLoading.value = true;
      streamingContent.value = '';
    });

    newClient.on('streamChunk', (_, chunk) => {
      streamingContent.value += chunk;
    });

    newClient.on('streamEnd', () => {
      isLoading.value = false;
    });

    // Auto-connect if enabled
    if (autoConnect) {
      newClient.connect().catch((err) => {
        error.value = err;
      });
    }
  }

  onMounted(() => {
    initializeClient();
  });

  onUnmounted(() => {
    client.value?.disconnect();
    client.value = null;
  });

  async function connect(): Promise<void> {
    if (!client.value) return;
    try {
      error.value = null;
      await client.value.connect();
    } catch (err) {
      error.value = err as Error;
      throw err;
    }
  }

  function disconnect(): void {
    client.value?.disconnect();
  }

  async function send(content: string): Promise<void> {
    if (!client.value?.isConnected) {
      throw new Error('Not connected');
    }

    try {
      isLoading.value = true;
      error.value = null;

      // Add user message immediately
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };
      messages.value = [...messages.value, userMessage];

      await client.value.send(content);
    } catch (err) {
      isLoading.value = false;
      error.value = err as Error;
      throw err;
    }
  }

  function clearMessages(): void {
    messages.value = [];
    streamingContent.value = '';
  }

  async function loadHistory(limit = 50): Promise<void> {
    if (!client.value?.isConnected) {
      throw new Error('Not connected');
    }

    try {
      const history = await client.value.getHistory(limit);
      messages.value = history;
    } catch (err) {
      error.value = err as Error;
      throw err;
    }
  }

  return {
    messages,
    connectionState,
    isConnected,
    isLoading,
    streamingContent,
    error,
    send,
    connect,
    disconnect,
    clearMessages,
    loadHistory,
    client,
  };
}
