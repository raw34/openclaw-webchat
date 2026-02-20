import type { DefineComponent } from 'vue';
import type { OpenClawClientOptions, Message, ConnectionState } from 'openclaw-webchat';
import type { Ref, ComputedRef } from 'vue';

// Re-export core types
export type { OpenClawClientOptions, Message, ConnectionState } from 'openclaw-webchat';

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
  client: Ref<import('openclaw-webchat').OpenClawClient | null>;
}

export declare function useOpenClawChat(options: UseOpenClawChatOptions): UseOpenClawChatReturn;

// ChatWidget component
export interface ChatWidgetAuthTexts {
  pairingRequiredTitle?: string;
  pairingRequiredBody?: string;
  scopeMissingWriteTitle?: string;
  scopeMissingWriteBody?: string;
  retryConnectionButton?: string;
  retryingConnectionButton?: string;
}

export interface ChatWidgetProps extends OpenClawClientOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'inline';
  theme?: 'light' | 'dark' | 'auto';
  title?: string;
  placeholder?: string;
  defaultOpen?: boolean;
  authTexts?: ChatWidgetAuthTexts;
}

export declare const ChatWidget: DefineComponent<ChatWidgetProps, object, unknown>;
