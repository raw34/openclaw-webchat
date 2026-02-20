import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { mount } from '@vue/test-utils';
import ChatWidget from '../ChatWidget.vue';
import { useOpenClawChat } from '../../composables/useOpenClawChat';

vi.mock('../../composables/useOpenClawChat', () => ({
  useOpenClawChat: vi.fn(),
}));

const mockedUseOpenClawChat = vi.mocked(useOpenClawChat);

function createComposableReturn(code?: string) {
  return {
    messages: ref([]),
    connectionState: ref('disconnected'),
    isConnected: computed(() => false),
    isLoading: ref(false),
    streamingContent: ref(''),
    error: ref(code ? ({ message: 'auth error', code } as Error & { code: string }) : null),
    send: vi.fn(async () => {}),
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    clearMessages: vi.fn(),
    loadHistory: vi.fn(async () => {}),
    client: ref(null),
  };
}

describe('Vue ChatWidget auth issue panel', () => {
  beforeEach(() => {
    mockedUseOpenClawChat.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders pairing required panel for PAIRING_REQUIRED', () => {
    mockedUseOpenClawChat.mockReturnValue(createComposableReturn('PAIRING_REQUIRED') as never);

    const wrapper = mount(ChatWidget, {
      props: {
        gateway: 'ws://localhost:18789',
        position: 'inline',
      },
    });

    expect(wrapper.text()).toContain('Pairing Required');
    expect(wrapper.text()).toContain('Retry Connection');
  });

  it('renders scope missing panel for SCOPE_MISSING_WRITE', () => {
    mockedUseOpenClawChat.mockReturnValue(createComposableReturn('SCOPE_MISSING_WRITE') as never);

    const wrapper = mount(ChatWidget, {
      props: {
        gateway: 'ws://localhost:18789',
        position: 'inline',
      },
    });

    expect(wrapper.text()).toContain('Permission Required');
    expect(wrapper.text()).toContain('missing operator.write');
  });

  it('renders custom authTexts copy when provided and retries', async () => {
    const composable = createComposableReturn('PAIRING_REQUIRED');
    mockedUseOpenClawChat.mockReturnValue(composable as never);

    const wrapper = mount(ChatWidget, {
      props: {
        gateway: 'ws://localhost:18789',
        position: 'inline',
        authTexts: {
          pairingRequiredTitle: 'Need Approval',
          pairingRequiredBody: 'Pair this device first.',
          retryConnectionButton: 'Try Again',
          retryingConnectionButton: 'Trying...',
        },
      },
    });

    expect(wrapper.text()).toContain('Need Approval');
    expect(wrapper.text()).toContain('Pair this device first.');

    const retryButton = wrapper.findAll('button').find((node) => node.text() === 'Try Again');
    expect(retryButton).toBeDefined();
    await retryButton!.trigger('click');
    expect(composable.connect).toHaveBeenCalledTimes(1);
  });
});
