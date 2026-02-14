// Hooks
export { useOpenClawChat } from './hooks/useOpenClawChat';
export type { UseOpenClawChatOptions, UseOpenClawChatReturn } from './hooks/useOpenClawChat';

// Components
export { ChatWidget } from './components/ChatWidget';
export type { ChatWidgetProps } from './components/ChatWidget';

// Re-export core types
export type {
  OpenClawClientOptions,
  Message,
  ConnectionState,
} from '@raw34/openclaw-webchat';
