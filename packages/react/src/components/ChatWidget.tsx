import React, { useState, useRef, useEffect } from 'react';
import type { OpenClawClientOptions, Message } from 'openclaw-webchat';
import { useOpenClawChat } from '../hooks/useOpenClawChat';

export interface ChatWidgetProps extends OpenClawClientOptions {
  /** Widget position */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'inline';

  /** Theme */
  theme?: 'light' | 'dark' | 'auto';

  /** Widget title */
  title?: string;

  /** Placeholder text for input */
  placeholder?: string;

  /** Initial open state */
  defaultOpen?: boolean;

  /** Custom styles */
  className?: string;

  /** Custom message renderer */
  renderMessage?: (message: Message) => React.ReactNode;

  /** Custom loading indicator */
  renderLoading?: (streamingContent: string) => React.ReactNode;

  /** On send callback */
  onSend?: (content: string) => void;

  /** On message received callback */
  onMessage?: (message: Message) => void;
}

const defaultStyles = {
  container: {
    position: 'fixed' as const,
    zIndex: 9999,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  positions: {
    'bottom-right': { bottom: 20, right: 20 },
    'bottom-left': { bottom: 20, left: 20 },
    'top-right': { top: 20, right: 20 },
    'top-left': { top: 20, left: 20 },
    inline: { position: 'relative' as const },
  },
  widget: {
    width: 380,
    height: 500,
    borderRadius: 12,
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    fontWeight: 600,
    fontSize: 16,
    borderBottom: '1px solid',
  },
  messages: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: 16,
  },
  message: {
    marginBottom: 12,
    padding: '10px 14px',
    borderRadius: 12,
    maxWidth: '80%',
    wordBreak: 'break-word' as const,
  },
  input: {
    display: 'flex',
    padding: 12,
    borderTop: '1px solid',
    gap: 8,
  },
  inputField: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid',
    fontSize: 14,
    outline: 'none',
  },
  sendButton: {
    padding: '10px 16px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
  },
  toggleButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    border: 'none',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
  },
};

const themes = {
  light: {
    bg: '#ffffff',
    headerBg: '#f8f9fa',
    headerBorder: '#e9ecef',
    userBg: '#007bff',
    userColor: '#ffffff',
    aiBg: '#f1f3f4',
    aiColor: '#1a1a1a',
    inputBg: '#ffffff',
    inputBorder: '#dee2e6',
    buttonBg: '#007bff',
    buttonColor: '#ffffff',
  },
  dark: {
    bg: '#1a1a1a',
    headerBg: '#2d2d2d',
    headerBorder: '#404040',
    userBg: '#0066cc',
    userColor: '#ffffff',
    aiBg: '#2d2d2d',
    aiColor: '#ffffff',
    inputBg: '#2d2d2d',
    inputBorder: '#404040',
    buttonBg: '#0066cc',
    buttonColor: '#ffffff',
  },
};

/**
 * Ready-to-use Chat Widget component
 *
 * @example
 * ```tsx
 * <ChatWidget
 *   gateway="wss://ai.example.com:18789"
 *   token="your-token"
 *   position="bottom-right"
 *   theme="light"
 *   title="AI Assistant"
 * />
 * ```
 */
export function ChatWidget({
  position = 'bottom-right',
  theme = 'light',
  title = 'AI Assistant',
  placeholder = 'Type a message...',
  defaultOpen = false,
  className,
  renderMessage,
  renderLoading,
  onSend,
  onMessage,
  ...clientOptions
}: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isConnected,
    isLoading,
    streamingContent,
    error,
    send,
  } = useOpenClawChat(clientOptions);

  // Get current theme colors
  const resolvedTheme = theme === 'auto'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;
  const colors = themes[resolvedTheme];

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Notify on new messages
  useEffect(() => {
    if (messages.length > 0 && onMessage) {
      onMessage(messages[messages.length - 1]);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!input.trim() || !isConnected || isLoading) return;

    const content = input.trim();
    setInput('');
    onSend?.(content);

    try {
      await send(content);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const renderDefaultMessage = (message: Message) => (
    <div
      key={message.id}
      style={{
        ...defaultStyles.message,
        backgroundColor: message.role === 'user' ? colors.userBg : colors.aiBg,
        color: message.role === 'user' ? colors.userColor : colors.aiColor,
        marginLeft: message.role === 'user' ? 'auto' : 0,
        marginRight: message.role === 'user' ? 0 : 'auto',
      }}
    >
      {message.content}
    </div>
  );

  const renderDefaultLoading = (content: string) => (
    <div
      style={{
        ...defaultStyles.message,
        backgroundColor: colors.aiBg,
        color: colors.aiColor,
        opacity: 0.8,
      }}
    >
      {content || '...'}
    </div>
  );

  // Inline mode - render directly
  if (position === 'inline') {
    return (
      <div
        className={className}
        style={{
          ...defaultStyles.widget,
          backgroundColor: colors.bg,
        }}
      >
        {renderChatContent()}
      </div>
    );
  }

  // Floating mode
  return (
    <div
      className={className}
      style={{
        ...defaultStyles.container,
        ...defaultStyles.positions[position],
      }}
    >
      {isOpen ? (
        <div
          style={{
            ...defaultStyles.widget,
            backgroundColor: colors.bg,
          }}
        >
          {/* Header */}
          <div
            style={{
              ...defaultStyles.header,
              backgroundColor: colors.headerBg,
              borderColor: colors.headerBorder,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{title}</span>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 20,
                color: colors.aiColor,
              }}
            >
              ×
            </button>
          </div>

          {renderChatContent()}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            ...defaultStyles.toggleButton,
            backgroundColor: colors.buttonBg,
            color: colors.buttonColor,
          }}
        >
          💬
        </button>
      )}
    </div>
  );

  function renderChatContent() {
    return (
      <>
        {/* Messages */}
        <div style={defaultStyles.messages}>
          {messages.map((msg) =>
            renderMessage ? renderMessage(msg) : renderDefaultMessage(msg)
          )}
          {isLoading && (
            renderLoading
              ? renderLoading(streamingContent)
              : renderDefaultLoading(streamingContent)
          )}
          {error && (
            <div style={{ color: '#dc3545', padding: '8px 12px', fontSize: 14 }}>
              Error: {error.message}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div
          style={{
            ...defaultStyles.input,
            borderColor: colors.headerBorder,
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConnected ? placeholder : 'Connecting...'}
            disabled={!isConnected || isLoading}
            style={{
              ...defaultStyles.inputField,
              backgroundColor: colors.inputBg,
              borderColor: colors.inputBorder,
              color: colors.aiColor,
            }}
          />
          <button
            onClick={handleSend}
            disabled={!isConnected || isLoading || !input.trim()}
            style={{
              ...defaultStyles.sendButton,
              backgroundColor: colors.buttonBg,
              color: colors.buttonColor,
              opacity: !isConnected || isLoading || !input.trim() ? 0.5 : 1,
            }}
          >
            Send
          </button>
        </div>
      </>
    );
  }
}
