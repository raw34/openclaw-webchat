import { createApp, ref, defineComponent, h } from 'vue';
import { OpenClawClient } from 'openclaw-webchat';
import { ChatWidget } from 'openclaw-webchat-vue';
import 'openclaw-webchat-vue/dist/index.css';

const DEFAULT_GATEWAY = import.meta.env.VITE_GATEWAY_URL || 'ws://localhost:18789';
const DEFAULT_TOKEN = import.meta.env.VITE_TOKEN || '';

type ErrorViewModel = {
  code: string;
  title: string;
  hint: string;
  message: string;
};

function normalizeError(err: unknown): ErrorViewModel {
  const error = err as { code?: string; message?: string };
  const message = error?.message || 'Unknown error';
  const code = error?.code || 'UNKNOWN';

  if (code === 'PAIRING_REQUIRED') {
    return {
      code,
      title: 'Pairing Required',
      hint: 'This device is not paired yet. Pair it in OpenClaw, then retry.',
      message,
    };
  }

  if (code === 'DEVICE_AUTH_UNSUPPORTED') {
    return {
      code,
      title: 'Device Auth Unsupported',
      hint: 'Current browser must support IndexedDB and WebCrypto. Try a modern browser.',
      message,
    };
  }

  if (code === 'SCOPE_MISSING_WRITE') {
    return {
      code,
      title: 'Missing Write Scope',
      hint: 'Token is missing operator.write. Update gateway auth scopes and retry.',
      message,
    };
  }

  return {
    code,
    title: 'Connection Failed',
    hint: 'Confirm URL includes /ws and token is valid for this gateway.',
    message,
  };
}

const App = defineComponent({
  setup() {
    const gateway = ref(localStorage.getItem('openclaw-gateway') || DEFAULT_GATEWAY);
    const token = ref(localStorage.getItem('openclaw-token') || DEFAULT_TOKEN);
    const isConfigured = ref(false);
    const isConnecting = ref(false);
    const error = ref<ErrorViewModel | null>(null);

    async function probeConnection(): Promise<void> {
      const probe = new OpenClawClient({
        gateway: gateway.value,
        token: token.value || undefined,
        reconnect: false,
        connectionTimeout: 8000,
      });

      try {
        await probe.connect();
      } finally {
        probe.disconnect();
      }
    }

    async function handleConnect() {
      localStorage.setItem('openclaw-gateway', gateway.value);
      localStorage.setItem('openclaw-token', token.value);

      isConnecting.value = true;
      error.value = null;

      try {
        await probeConnection();
        isConfigured.value = true;
      } catch (err) {
        isConfigured.value = false;
        error.value = normalizeError(err);
      } finally {
        isConnecting.value = false;
      }
    }

    async function handleResetDeviceIdentity() {
      const client = new OpenClawClient({
        gateway: gateway.value,
        token: token.value || undefined,
        reconnect: false,
      });

      try {
        await client.resetDeviceIdentity();
        error.value = null;
      } catch (err) {
        error.value = normalizeError(err);
      }
    }

    function handleSubmit(e: Event) {
      e.preventDefault();
      void handleConnect();
    }

    return () =>
      h('div', { class: 'demo-page' }, [
        h('a', { href: '/', class: 'back-link' }, '← Back to Home'),
        h('h1', 'Vue ChatWidget Demo'),
        !isConfigured.value
          ? h('form', { class: 'config-form', onSubmit: handleSubmit }, [
              h('label', [
                'Gateway URL:',
                h('input', {
                  type: 'text',
                  value: gateway.value,
                  onInput: (e: Event) =>
                    (gateway.value = (e.target as HTMLInputElement).value),
                  placeholder: 'wss://example.com/ws',
                }),
              ]),
              h('label', [
                'Token (optional):',
                h('input', {
                  type: 'text',
                  value: token.value,
                  onInput: (e: Event) =>
                    (token.value = (e.target as HTMLInputElement).value),
                  placeholder: 'gateway auth token',
                }),
              ]),
              h(
                'button',
                { type: 'submit', disabled: isConnecting.value },
                isConnecting.value ? 'Connecting...' : 'Connect'
              ),
              error.value
                ? h('div', { class: 'error-card' }, [
                    h(
                      'div',
                      { class: 'error-title' },
                      `${error.value.title} (${error.value.code})`
                    ),
                    h('div', { class: 'error-message' }, error.value.message),
                    h('div', { class: 'error-hint' }, error.value.hint),
                    h('div', { class: 'action-row' }, [
                      h(
                        'button',
                        {
                          type: 'button',
                          disabled: isConnecting.value,
                          onClick: () => void handleConnect(),
                        },
                        'Retry Connection'
                      ),
                      h(
                        'button',
                        {
                          type: 'button',
                          onClick: () => void handleResetDeviceIdentity(),
                        },
                        'Reset Device Identity'
                      ),
                    ]),
                  ])
                : null,
            ])
          : h('div', [
              h('p', `Connected to: ${gateway.value}`),
              h('div', { class: 'action-row', style: { marginBottom: '20px' } }, [
                h(
                  'button',
                  {
                    onClick: () => {
                      isConfigured.value = false;
                    },
                  },
                  'Change Config'
                ),
                h(
                  'button',
                  { onClick: () => void handleResetDeviceIdentity() },
                  'Reset Device Identity'
                ),
              ]),
              h(ChatWidget, {
                gateway: gateway.value,
                token: token.value || undefined,
                position: 'bottom-right',
                theme: 'light',
                title: 'AI Assistant',
                debug: true,
              }),
            ]),
      ]);
  },
});

createApp(App).mount('#app');
