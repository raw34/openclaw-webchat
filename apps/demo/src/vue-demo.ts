import { createApp, ref, defineComponent, h } from 'vue';
import { ChatWidget } from '@openclaw/chat-vue';

const DEFAULT_GATEWAY = import.meta.env.VITE_GATEWAY_URL || 'ws://localhost:18789';
const DEFAULT_TOKEN = import.meta.env.VITE_TOKEN || '';

const App = defineComponent({
  setup() {
    const gateway = ref(
      localStorage.getItem('openclaw-gateway') || DEFAULT_GATEWAY
    );
    const token = ref(localStorage.getItem('openclaw-token') || DEFAULT_TOKEN);
    const isConfigured = ref(false);

    function handleSubmit(e: Event) {
      e.preventDefault();
      localStorage.setItem('openclaw-gateway', gateway.value);
      localStorage.setItem('openclaw-token', token.value);
      isConfigured.value = true;
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
                  placeholder: 'ws://localhost:18789',
                }),
              ]),
              h('label', [
                'Token (optional):',
                h('input', {
                  type: 'text',
                  value: token.value,
                  onInput: (e: Event) =>
                    (token.value = (e.target as HTMLInputElement).value),
                  placeholder: 'your-auth-token',
                }),
              ]),
              h('button', { type: 'submit' }, 'Connect'),
            ])
          : h('div', [
              h('p', `Connected to: ${gateway.value}`),
              h(
                'button',
                {
                  onClick: () => (isConfigured.value = false),
                  style: { marginBottom: '20px' },
                },
                'Change Config'
              ),
              h(ChatWidget, {
                gateway: gateway.value,
                token: token.value || undefined,
                position: 'inline',
                theme: 'light',
                title: 'AI Assistant',
                debug: true,
              }),
            ]),
      ]);
  },
});

createApp(App).mount('#app');
