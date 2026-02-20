import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { mount } from '@vue/test-utils';
import ChatWidget from '../ChatWidget.vue';
import { useOpenClawChat } from '../../composables/useOpenClawChat';

vi.mock('../../composables/useOpenClawChat', () => ({
  useOpenClawChat: vi.fn(),
}));

const mockedUseOpenClawChat = vi.mocked(useOpenClawChat);

function createComposableReturn() {
  return {
    messages: ref([]),
    connectionState: ref('disconnected'),
    isConnected: computed(() => false),
    isLoading: ref(false),
    streamingContent: ref(''),
    error: ref(null),
    send: vi.fn(async () => {}),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    clearMessages: vi.fn(),
    loadHistory: vi.fn(async () => {}),
    client: ref(null),
  };
}

describe('Vue ChatWidget session key resolution', () => {
  beforeEach(() => {
    mockedUseOpenClawChat.mockReset();
    mockedUseOpenClawChat.mockReturnValue(createComposableReturn() as never);
    window.localStorage.clear();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('uses stable browser-local session key when not provided', () => {
    mount(ChatWidget, {
      props: {
        gateway: 'ws://localhost:18789',
        position: 'inline',
      },
    });

    const args = mockedUseOpenClawChat.mock.calls[0]?.[0];
    expect(args.sessionKey).toMatch(/^webchat:[a-f0-9]+$/);
  });

  it('uses explicit sessionKey override when provided', () => {
    mount(ChatWidget, {
      props: {
        gateway: 'ws://localhost:18789',
        sessionKey: 'custom-session',
        position: 'inline',
      },
    });

    const args = mockedUseOpenClawChat.mock.calls[0]?.[0];
    expect(args.sessionKey).toBe('custom-session');
  });
});
