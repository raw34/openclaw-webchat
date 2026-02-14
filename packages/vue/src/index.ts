// Composables
export { useOpenClawChat } from './composables/useOpenClawChat';
export type { UseOpenClawChatOptions, UseOpenClawChatReturn } from './composables/useOpenClawChat';

// Components
export { default as ChatWidget } from './components/ChatWidget.vue';

// Re-export core types
export type {
  OpenClawClientOptions,
  Message,
  ConnectionState,
} from '@openclaw/chat-core';
