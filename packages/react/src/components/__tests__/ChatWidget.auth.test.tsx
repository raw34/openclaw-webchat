import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UseOpenClawChatReturn } from '../../hooks/useOpenClawChat';
import { ChatWidget } from '../ChatWidget';
import { useOpenClawChat } from '../../hooks/useOpenClawChat';

vi.mock('../../hooks/useOpenClawChat', () => ({
  useOpenClawChat: vi.fn(),
}));

const mockedUseOpenClawChat = vi.mocked(useOpenClawChat);

function createHookReturn(code?: string): UseOpenClawChatReturn {
  return {
    messages: [],
    connectionState: 'disconnected',
    isConnected: false,
    isLoading: false,
    streamingContent: '',
    error: code ? ({ message: 'auth error', code } as Error & { code: string }) : null,
    send: vi.fn(async () => {}),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    clearMessages: vi.fn(),
    loadHistory: vi.fn(async () => {}),
    client: null,
  };
}

describe('ChatWidget auth issue panel', () => {
  beforeEach(() => {
    mockedUseOpenClawChat.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('shows pairing required panel when error code is PAIRING_REQUIRED', () => {
    mockedUseOpenClawChat.mockReturnValue(createHookReturn('PAIRING_REQUIRED'));

    render(<ChatWidget gateway="ws://localhost:18789" defaultOpen />);

    expect(screen.getByText('Pairing Required')).toBeDefined();
    expect(screen.getByText('Retry Connection')).toBeDefined();
  });

  it('shows missing write scope panel when error code is SCOPE_MISSING_WRITE', () => {
    mockedUseOpenClawChat.mockReturnValue(createHookReturn('SCOPE_MISSING_WRITE'));

    render(<ChatWidget gateway="ws://localhost:18789" defaultOpen />);

    expect(screen.getByText('Permission Required')).toBeDefined();
    expect(screen.getByText(/missing operator.write/i)).toBeDefined();
  });

  it('uses authTexts overrides and retries connection', () => {
    const hook = createHookReturn('PAIRING_REQUIRED');
    mockedUseOpenClawChat.mockReturnValue(hook);

    render(
      <ChatWidget
        gateway="ws://localhost:18789"
        defaultOpen
        authTexts={{
          pairingRequiredTitle: 'Need Approval',
          pairingRequiredBody: 'Please pair first.',
          retryConnectionButton: 'Try Again',
          retryingConnectionButton: 'Trying...',
        }}
      />
    );

    expect(screen.getByText('Need Approval')).toBeDefined();
    expect(screen.getByText('Please pair first.')).toBeDefined();

    fireEvent.click(screen.getByText('Try Again'));
    expect(hook.connect).toHaveBeenCalledTimes(1);
  });
});
