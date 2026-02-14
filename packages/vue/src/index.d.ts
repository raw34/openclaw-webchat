import type { DefineComponent } from 'vue';
import type { OpenClawClientOptions, Message, ConnectionState } from '@raw34/openclaw-webchat';
import type { Ref, ComputedRef } from 'vue';

// Re-export core types
export type { OpenClawClientOptions, Message, ConnectionState } from '@raw34/openclaw-webchat';

// Composable types
export interface UseOpenClawChatOptions extends OpenClawClientOptions {
  autoConnect?: boolean;
}

export interface UseOpenClawChatReturn {
  messages: Ref<Message[]>;
  connectionState: Ref<ConnectionState>;
  isConnected: ComputedRef<boolean>;
  isLoading: Ref<boolean>;
  streamingContent: Ref<string>;
  error: Ref<Error | null>;
  send: (content: string) => Promise<void>;
  connect: () => Promise<void>;
  disconnect: () => void;
  clearMessages: () => void;
  loadHistory: (limit?: number) => Promise<void>;
  client: Ref<import('@raw34/openclaw-webchat').OpenClawClient | null>;
}

export declare function useOpenClawChat(options: UseOpenClawChatOptions): UseOpenClawChatReturn;

// ChatWidget component
export interface ChatWidgetProps extends OpenClawClientOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'inline';
  theme?: 'light' | 'dark' | 'auto';
  title?: string;
  placeholder?: string;
  defaultOpen?: boolean;
}

export declare const ChatWidget: DefineComponent<ChatWidgetProps, object, unknown>;
