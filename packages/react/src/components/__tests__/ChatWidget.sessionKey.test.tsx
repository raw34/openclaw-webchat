import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UseOpenClawChatReturn } from '../../hooks/useOpenClawChat';
import { ChatWidget } from '../ChatWidget';
import { useOpenClawChat } from '../../hooks/useOpenClawChat';

vi.mock('../../hooks/useOpenClawChat', () => ({
  useOpenClawChat: vi.fn(),
}));

const mockedUseOpenClawChat = vi.mocked(useOpenClawChat);

function createHookReturn(): UseOpenClawChatReturn {
  return {
    messages: [],
    connectionState: 'disconnected',
    isConnected: false,
    isLoading: false,
    streamingContent: '',
    error: null,
    send: vi.fn(async () => {}),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    clearMessages: vi.fn(),
    loadHistory: vi.fn(async () => {}),
    client: null,
  };
}

describe('ChatWidget session key resolution', () => {
  beforeEach(() => {
    mockedUseOpenClawChat.mockReset();
    mockedUseOpenClawChat.mockReturnValue(createHookReturn());
    window.localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('uses stable browser-local session key when not provided', () => {
    render(<ChatWidget gateway="ws://localhost:18789" defaultOpen />);

    const args = mockedUseOpenClawChat.mock.calls[0]?.[0];
    expect(args.sessionKey).toMatch(/^webchat:[a-f0-9]+$/);
  });

  it('uses explicit sessionKey override when provided', () => {
    render(
      <ChatWidget
        gateway="ws://localhost:18789"
        sessionKey="custom-session"
        defaultOpen
      />
    );

    const args = mockedUseOpenClawChat.mock.calls[0]?.[0];
    expect(args.sessionKey).toBe('custom-session');
  });
});
