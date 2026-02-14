# Vue ChatWidget, Unit Tests, and Demo App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Vue ChatWidget component, unit tests for core package, and demo app for real Gateway testing.

**Architecture:** Serial development - Vue ChatWidget first (leverages existing composable), then unit tests (mock WebSocket for isolated testing), finally demo app (Vite multi-page with React and Vue).

**Tech Stack:** Vue 3 (Composition API), Vitest, Vite 5, React 18

---

## Task 1: Vue ChatWidget Component

**Files:**
- Create: `packages/vue/src/components/ChatWidget.vue`
- Modify: `packages/vue/src/index.ts`

### Step 1: Create ChatWidget.vue

Create `packages/vue/src/components/ChatWidget.vue`:

```vue
<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { OpenClawClientOptions, Message } from '@openclaw/chat-core';
import { useOpenClawChat } from '../composables/useOpenClawChat';

export interface ChatWidgetProps extends OpenClawClientOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'inline';
  theme?: 'light' | 'dark' | 'auto';
  title?: string;
  placeholder?: string;
  defaultOpen?: boolean;
}

const props = withDefaults(defineProps<ChatWidgetProps>(), {
  position: 'bottom-right',
  theme: 'light',
  title: 'AI Assistant',
  placeholder: 'Type a message...',
  defaultOpen: false,
});

const emit = defineEmits<{
  send: [content: string];
  message: [message: Message];
}>();

defineSlots<{
  message?: (props: { message: Message }) => unknown;
  loading?: (props: { content: string }) => unknown;
}>();

const isOpen = ref(props.defaultOpen);
const input = ref('');
const messagesEndRef = ref<HTMLDivElement | null>(null);

const {
  messages,
  isConnected,
  isLoading,
  streamingContent,
  error,
  send: clientSend,
} = useOpenClawChat(props);

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

const resolvedTheme = computed(() => {
  if (props.theme === 'auto') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return props.theme;
});

const colors = computed(() => themes[resolvedTheme.value]);

const positionStyles = computed(() => {
  const positions = {
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-right': { top: '20px', right: '20px' },
    'top-left': { top: '20px', left: '20px' },
    inline: {},
  };
  return positions[props.position];
});

watch(
  [messages, streamingContent],
  () => {
    nextTick(() => {
      messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
    });
  },
  { deep: true }
);

watch(
  () => messages.value.length,
  (newLen, oldLen) => {
    if (newLen > oldLen) {
      emit('message', messages.value[newLen - 1]);
    }
  }
);

async function handleSend() {
  if (!input.value.trim() || !isConnected.value || isLoading.value) return;

  const content = input.value.trim();
  input.value = '';
  emit('send', content);

  try {
    await clientSend(content);
  } catch (err) {
    console.error('Failed to send message:', err);
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <!-- Inline mode -->
  <div
    v-if="position === 'inline'"
    class="openclaw-widget"
    :style="{ backgroundColor: colors.bg }"
  >
    <div class="openclaw-messages">
      <template v-for="msg in messages" :key="msg.id">
        <slot name="message" :message="msg">
          <div
            class="openclaw-message"
            :style="{
              backgroundColor: msg.role === 'user' ? colors.userBg : colors.aiBg,
              color: msg.role === 'user' ? colors.userColor : colors.aiColor,
              marginLeft: msg.role === 'user' ? 'auto' : '0',
              marginRight: msg.role === 'user' ? '0' : 'auto',
            }"
          >
            {{ msg.content }}
          </div>
        </slot>
      </template>
      <template v-if="isLoading">
        <slot name="loading" :content="streamingContent">
          <div
            class="openclaw-message"
            :style="{
              backgroundColor: colors.aiBg,
              color: colors.aiColor,
              opacity: 0.8,
            }"
          >
            {{ streamingContent || '...' }}
          </div>
        </slot>
      </template>
      <div v-if="error" class="openclaw-error">
        Error: {{ error.message }}
      </div>
      <div ref="messagesEndRef" />
    </div>
    <div class="openclaw-input" :style="{ borderColor: colors.headerBorder }">
      <input
        type="text"
        v-model="input"
        @keydown="handleKeyDown"
        :placeholder="isConnected ? placeholder : 'Connecting...'"
        :disabled="!isConnected || isLoading"
        :style="{
          backgroundColor: colors.inputBg,
          borderColor: colors.inputBorder,
          color: colors.aiColor,
        }"
      />
      <button
        @click="handleSend"
        :disabled="!isConnected || isLoading || !input.trim()"
        :style="{
          backgroundColor: colors.buttonBg,
          color: colors.buttonColor,
          opacity: !isConnected || isLoading || !input.trim() ? 0.5 : 1,
        }"
      >
        Send
      </button>
    </div>
  </div>

  <!-- Floating mode -->
  <div
    v-else
    class="openclaw-container"
    :style="positionStyles"
  >
    <div
      v-if="isOpen"
      class="openclaw-widget"
      :style="{ backgroundColor: colors.bg }"
    >
      <div
        class="openclaw-header"
        :style="{
          backgroundColor: colors.headerBg,
          borderColor: colors.headerBorder,
        }"
      >
        <span>{{ title }}</span>
        <button
          @click="isOpen = false"
          class="openclaw-close"
          :style="{ color: colors.aiColor }"
        >
          ×
        </button>
      </div>
      <div class="openclaw-messages">
        <template v-for="msg in messages" :key="msg.id">
          <slot name="message" :message="msg">
            <div
              class="openclaw-message"
              :style="{
                backgroundColor: msg.role === 'user' ? colors.userBg : colors.aiBg,
                color: msg.role === 'user' ? colors.userColor : colors.aiColor,
                marginLeft: msg.role === 'user' ? 'auto' : '0',
                marginRight: msg.role === 'user' ? '0' : 'auto',
              }"
            >
              {{ msg.content }}
            </div>
          </slot>
        </template>
        <template v-if="isLoading">
          <slot name="loading" :content="streamingContent">
            <div
              class="openclaw-message"
              :style="{
                backgroundColor: colors.aiBg,
                color: colors.aiColor,
                opacity: 0.8,
              }"
            >
              {{ streamingContent || '...' }}
            </div>
          </slot>
        </template>
        <div v-if="error" class="openclaw-error">
          Error: {{ error.message }}
        </div>
        <div ref="messagesEndRef" />
      </div>
      <div class="openclaw-input" :style="{ borderColor: colors.headerBorder }">
        <input
          type="text"
          v-model="input"
          @keydown="handleKeyDown"
          :placeholder="isConnected ? placeholder : 'Connecting...'"
          :disabled="!isConnected || isLoading"
          :style="{
            backgroundColor: colors.inputBg,
            borderColor: colors.inputBorder,
            color: colors.aiColor,
          }"
        />
        <button
          @click="handleSend"
          :disabled="!isConnected || isLoading || !input.trim()"
          :style="{
            backgroundColor: colors.buttonBg,
            color: colors.buttonColor,
            opacity: !isConnected || isLoading || !input.trim() ? 0.5 : 1,
          }"
        >
          Send
        </button>
      </div>
    </div>
    <button
      v-else
      @click="isOpen = true"
      class="openclaw-toggle"
      :style="{
        backgroundColor: colors.buttonBg,
        color: colors.buttonColor,
      }"
    >
      💬
    </button>
  </div>
</template>

<style scoped>
.openclaw-container {
  position: fixed;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.openclaw-widget {
  width: 380px;
  height: 500px;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.openclaw-header {
  padding: 16px 20px;
  font-weight: 600;
  font-size: 16px;
  border-bottom: 1px solid;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.openclaw-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 20px;
}

.openclaw-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.openclaw-message {
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  max-width: 80%;
  word-break: break-word;
}

.openclaw-error {
  color: #dc3545;
  padding: 8px 12px;
  font-size: 14px;
}

.openclaw-input {
  display: flex;
  padding: 12px;
  border-top: 1px solid;
  gap: 8px;
}

.openclaw-input input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid;
  font-size: 14px;
  outline: none;
}

.openclaw-input button {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.openclaw-toggle {
  width: 56px;
  height: 56px;
  border-radius: 28px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}
</style>
```

### Step 2: Update Vue package index.ts

Modify `packages/vue/src/index.ts` to export ChatWidget:

```typescript
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
```

### Step 3: Build and verify

Run: `pnpm build`
Expected: Build succeeds with no errors

### Step 4: Commit

```bash
git add packages/vue/src/components/ChatWidget.vue packages/vue/src/index.ts
git commit -m "feat(vue): add ChatWidget component"
```

---

## Task 2: Unit Tests for Core Package

**Files:**
- Create: `packages/core/src/__tests__/client.test.ts`
- Create: `packages/core/src/__tests__/MockWebSocket.ts`
- Modify: `packages/core/tsup.config.ts` (exclude tests)

### Step 1: Create MockWebSocket helper

Create `packages/core/src/__tests__/MockWebSocket.ts`:

```typescript
type WebSocketCallback = (event: { data: string }) => void;

export class MockWebSocket {
  static instances: MockWebSocket[] = [];

  url: string;
  readyState: number = 0; // CONNECTING
  onopen: (() => void) | null = null;
  onmessage: WebSocketCallback | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onclose: ((event: { code: number; reason: string }) => void) | null = null;

  private sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(code = 1000, reason = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  simulateMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }

  simulateError(error: unknown): void {
    this.onerror?.(error);
  }

  simulateClose(code = 1000, reason = ''): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }

  getSentMessages(): unknown[] {
    return this.sentMessages.map((m) => JSON.parse(m));
  }

  getLastSentMessage(): unknown {
    const messages = this.getSentMessages();
    return messages[messages.length - 1];
  }

  static reset(): void {
    MockWebSocket.instances = [];
  }

  static getLastInstance(): MockWebSocket | undefined {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }
}
```

### Step 2: Create client tests

Create `packages/core/src/__tests__/client.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenClawClient } from '../client';
import { MockWebSocket } from './MockWebSocket';

// Mock WebSocket globally
vi.stubGlobal('WebSocket', MockWebSocket);

describe('OpenClawClient', () => {
  beforeEach(() => {
    MockWebSocket.reset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('connection', () => {
    it('should connect successfully with handshake', async () => {
      const client = new OpenClawClient({
        gateway: 'ws://localhost:18789',
        token: 'test-token',
        connectionTimeout: 5000,
      });

      const connectPromise = client.connect();

      // Get WebSocket instance
      const ws = MockWebSocket.getLastInstance()!;
      expect(ws).toBeDefined();

      // Simulate connection open
      ws.simulateOpen();

      // Server sends challenge
      ws.simulateMessage({
        type: 'req',
        id: 'challenge-1',
        method: 'connect.challenge',
        params: { nonce: 'abc123', timestamp: Date.now() },
      });

      // Client should send connect request
      await vi.waitFor(() => {
        const messages = ws.getSentMessages();
        expect(messages.length).toBeGreaterThan(0);
      });

      const connectReq = ws.getLastSentMessage() as {
        type: string;
        method: string;
        params: { auth: { token: string } };
      };
      expect(connectReq.type).toBe('req');
      expect(connectReq.method).toBe('connect');
      expect(connectReq.params.auth.token).toBe('test-token');

      // Server sends hello-ok
      ws.simulateMessage({
        type: 'res',
        id: connectReq.id,
        ok: true,
        payload: {
          protocol: { version: '1.0' },
          gateway: { version: '1.0.0', name: 'Test Gateway' },
        },
      });

      await connectPromise;
      expect(client.isConnected).toBe(true);
      expect(client.connectionState).toBe('connected');
    });

    it('should handle connection timeout', async () => {
      vi.useFakeTimers();

      const client = new OpenClawClient({
        gateway: 'ws://localhost:18789',
        connectionTimeout: 1000,
      });

      const connectPromise = client.connect();

      // Don't simulate open - let it timeout
      vi.advanceTimersByTime(1500);

      await expect(connectPromise).rejects.toThrow('Connection timeout');

      vi.useRealTimers();
    });

    it('should handle authentication failure', async () => {
      const client = new OpenClawClient({
        gateway: 'ws://localhost:18789',
        token: 'invalid-token',
      });

      const connectPromise = client.connect();
      const ws = MockWebSocket.getLastInstance()!;

      ws.simulateOpen();

      // Server sends challenge
      ws.simulateMessage({
        type: 'req',
        id: 'challenge-1',
        method: 'connect.challenge',
        params: { nonce: 'abc123', timestamp: Date.now() },
      });

      await vi.waitFor(() => ws.getSentMessages().length > 0);

      // Server rejects connection
      ws.simulateMessage({
        type: 'res',
        id: (ws.getLastSentMessage() as { id: string }).id,
        ok: false,
        error: { code: 'AUTH_FAILED', message: 'Invalid token' },
      });

      await expect(connectPromise).rejects.toThrow('Invalid token');
    });
  });

  describe('messaging', () => {
    async function createConnectedClient(): Promise<{
      client: OpenClawClient;
      ws: MockWebSocket;
    }> {
      const client = new OpenClawClient({
        gateway: 'ws://localhost:18789',
        token: 'test-token',
      });

      const connectPromise = client.connect();
      const ws = MockWebSocket.getLastInstance()!;

      ws.simulateOpen();
      ws.simulateMessage({
        type: 'req',
        id: 'challenge-1',
        method: 'connect.challenge',
        params: { nonce: 'abc', timestamp: Date.now() },
      });

      await vi.waitFor(() => ws.getSentMessages().length > 0);

      ws.simulateMessage({
        type: 'res',
        id: (ws.getLastSentMessage() as { id: string }).id,
        ok: true,
        payload: {
          protocol: { version: '1.0' },
          gateway: { version: '1.0.0' },
        },
      });

      await connectPromise;
      return { client, ws };
    }

    it('should send message correctly', async () => {
      const { client, ws } = await createConnectedClient();

      const sendPromise = client.send('Hello, AI!');

      await vi.waitFor(() => {
        const messages = ws.getSentMessages();
        return messages.some(
          (m) => (m as { method?: string }).method === 'chat.send'
        );
      });

      const sendReq = ws.getSentMessages().find(
        (m) => (m as { method?: string }).method === 'chat.send'
      ) as { id: string; params: { content: string } };

      expect(sendReq.params.content).toBe('Hello, AI!');

      // Server acknowledges
      ws.simulateMessage({
        type: 'res',
        id: sendReq.id,
        ok: true,
        payload: {},
      });

      await sendPromise;
    });

    it('should emit message event on server message', async () => {
      const { client, ws } = await createConnectedClient();

      const messageHandler = vi.fn();
      client.on('message', messageHandler);

      ws.simulateMessage({
        type: 'event',
        event: 'message',
        payload: {
          message: {
            id: 'msg-1',
            role: 'assistant',
            content: 'Hello!',
            timestamp: Date.now(),
          },
        },
      });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'msg-1',
          role: 'assistant',
          content: 'Hello!',
        })
      );
    });

    it('should handle streaming response', async () => {
      const { client, ws } = await createConnectedClient();

      const streamStartHandler = vi.fn();
      const streamChunkHandler = vi.fn();
      const streamEndHandler = vi.fn();

      client.on('streamStart', streamStartHandler);
      client.on('streamChunk', streamChunkHandler);
      client.on('streamEnd', streamEndHandler);

      // Stream start
      ws.simulateMessage({
        type: 'event',
        event: 'stream.start',
        payload: { messageId: 'msg-1' },
      });

      expect(streamStartHandler).toHaveBeenCalledWith('msg-1');

      // Stream chunks
      ws.simulateMessage({
        type: 'event',
        event: 'stream.chunk',
        payload: { messageId: 'msg-1', chunk: 'Hello', done: false },
      });

      expect(streamChunkHandler).toHaveBeenCalledWith('msg-1', 'Hello');

      ws.simulateMessage({
        type: 'event',
        event: 'stream.chunk',
        payload: { messageId: 'msg-1', chunk: ' World!', done: true },
      });

      expect(streamChunkHandler).toHaveBeenCalledWith('msg-1', ' World!');
      expect(streamEndHandler).toHaveBeenCalledWith('msg-1');
    });
  });

  describe('reconnection', () => {
    it('should auto-reconnect on disconnect', async () => {
      vi.useFakeTimers();

      const client = new OpenClawClient({
        gateway: 'ws://localhost:18789',
        token: 'test-token',
        reconnect: true,
        reconnectInterval: 1000,
        maxReconnectAttempts: 3,
      });

      // Initial connection
      const connectPromise = client.connect();
      let ws = MockWebSocket.getLastInstance()!;

      ws.simulateOpen();
      ws.simulateMessage({
        type: 'req',
        id: 'c1',
        method: 'connect.challenge',
        params: { nonce: 'abc', timestamp: Date.now() },
      });

      await vi.waitFor(() => ws.getSentMessages().length > 0);

      ws.simulateMessage({
        type: 'res',
        id: (ws.getLastSentMessage() as { id: string }).id,
        ok: true,
        payload: {
          protocol: { version: '1.0' },
          gateway: { version: '1.0.0' },
        },
      });

      await connectPromise;
      expect(client.isConnected).toBe(true);

      const reconnectingHandler = vi.fn();
      client.on('reconnecting', reconnectingHandler);

      // Simulate disconnect
      ws.simulateClose(1006, 'Connection lost');

      // Wait for reconnect timer
      vi.advanceTimersByTime(1000);

      expect(reconnectingHandler).toHaveBeenCalledWith(1);

      vi.useRealTimers();
    });

    it('should not reconnect when manually disconnected', async () => {
      const client = new OpenClawClient({
        gateway: 'ws://localhost:18789',
        reconnect: true,
      });

      const connectPromise = client.connect();
      const ws = MockWebSocket.getLastInstance()!;

      ws.simulateOpen();
      ws.simulateMessage({
        type: 'req',
        id: 'c1',
        method: 'connect.challenge',
        params: { nonce: 'abc', timestamp: Date.now() },
      });

      await vi.waitFor(() => ws.getSentMessages().length > 0);

      ws.simulateMessage({
        type: 'res',
        id: (ws.getLastSentMessage() as { id: string }).id,
        ok: true,
        payload: {
          protocol: { version: '1.0' },
          gateway: { version: '1.0.0' },
        },
      });

      await connectPromise;

      const initialInstanceCount = MockWebSocket.instances.length;

      // Manual disconnect
      client.disconnect();

      expect(client.connectionState).toBe('disconnected');
      // No new WebSocket instance should be created
      expect(MockWebSocket.instances.length).toBe(initialInstanceCount);
    });
  });
});
```

### Step 3: Run tests to verify they pass

Run: `pnpm test`
Expected: All tests pass

### Step 4: Commit

```bash
git add packages/core/src/__tests__/
git commit -m "test(core): add unit tests for OpenClawClient"
```

---

## Task 3: Demo Application

**Files:**
- Create: `apps/demo/package.json`
- Create: `apps/demo/vite.config.ts`
- Create: `apps/demo/tsconfig.json`
- Create: `apps/demo/index.html`
- Create: `apps/demo/react.html`
- Create: `apps/demo/vue.html`
- Create: `apps/demo/src/main.ts`
- Create: `apps/demo/src/react-demo.tsx`
- Create: `apps/demo/src/vue-demo.ts`
- Create: `apps/demo/src/style.css`

### Step 1: Create demo package.json

Create `apps/demo/package.json`:

```json
{
  "name": "@openclaw/demo",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@openclaw/chat-core": "workspace:*",
    "@openclaw/chat-react": "workspace:*",
    "@openclaw/chat-vue": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "vue": "^3.5.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "@vitejs/plugin-vue": "^5.1.0",
    "typescript": "^5.7.0",
    "vite": "^5.4.0"
  }
}
```

### Step 2: Create vite.config.ts

Create `apps/demo/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react(), vue()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        react: resolve(__dirname, 'react.html'),
        vue: resolve(__dirname, 'vue.html'),
      },
    },
  },
});
```

### Step 3: Create tsconfig.json

Create `apps/demo/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
```

### Step 4: Create index.html (home page)

Create `apps/demo/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OpenClaw WebChat Demo</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <div class="home">
    <h1>OpenClaw WebChat SDK Demo</h1>
    <p>Choose a framework to test:</p>
    <div class="links">
      <a href="/react.html" class="link-card">
        <h2>React Demo</h2>
        <p>Test ChatWidget component with React</p>
      </a>
      <a href="/vue.html" class="link-card">
        <h2>Vue Demo</h2>
        <p>Test ChatWidget component with Vue</p>
      </a>
    </div>
  </div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

### Step 5: Create react.html

Create `apps/demo/react.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>React Demo - OpenClaw WebChat</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/react-demo.tsx"></script>
</body>
</html>
```

### Step 6: Create vue.html

Create `apps/demo/vue.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Vue Demo - OpenClaw WebChat</title>
  <link rel="stylesheet" href="/src/style.css" />
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/src/vue-demo.ts"></script>
</body>
</html>
```

### Step 7: Create style.css

Create `apps/demo/src/style.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f5f5f5;
  min-height: 100vh;
}

.home {
  max-width: 800px;
  margin: 0 auto;
  padding: 60px 20px;
  text-align: center;
}

.home h1 {
  font-size: 2.5rem;
  margin-bottom: 16px;
  color: #1a1a1a;
}

.home p {
  font-size: 1.1rem;
  color: #666;
  margin-bottom: 40px;
}

.links {
  display: flex;
  gap: 24px;
  justify-content: center;
  flex-wrap: wrap;
}

.link-card {
  display: block;
  background: white;
  border-radius: 12px;
  padding: 32px;
  text-decoration: none;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transition: transform 0.2s, box-shadow 0.2s;
  width: 280px;
}

.link-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.link-card h2 {
  color: #007bff;
  margin-bottom: 8px;
}

.link-card p {
  color: #666;
  font-size: 0.95rem;
  margin-bottom: 0;
}

.demo-page {
  padding: 20px;
  max-width: 600px;
  margin: 0 auto;
}

.demo-page h1 {
  margin-bottom: 20px;
}

.config-form {
  background: white;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.config-form label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
}

.config-form input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 16px;
  font-size: 14px;
}

.config-form button {
  background: #007bff;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.config-form button:hover {
  background: #0056b3;
}

.back-link {
  display: inline-block;
  margin-bottom: 20px;
  color: #007bff;
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}
```

### Step 8: Create main.ts

Create `apps/demo/src/main.ts`:

```typescript
// Home page - no JS needed
console.log('OpenClaw WebChat Demo');
```

### Step 9: Create react-demo.tsx

Create `apps/demo/src/react-demo.tsx`:

```tsx
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from '@openclaw/chat-react';

function App() {
  const [gateway, setGateway] = useState(
    localStorage.getItem('openclaw-gateway') || 'ws://localhost:18789'
  );
  const [token, setToken] = useState(
    localStorage.getItem('openclaw-token') || ''
  );
  const [isConfigured, setIsConfigured] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem('openclaw-gateway', gateway);
    localStorage.setItem('openclaw-token', token);
    setIsConfigured(true);
  }

  return (
    <div className="demo-page">
      <a href="/" className="back-link">← Back to Home</a>
      <h1>React ChatWidget Demo</h1>

      {!isConfigured ? (
        <form className="config-form" onSubmit={handleSubmit}>
          <label>
            Gateway URL:
            <input
              type="text"
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              placeholder="ws://localhost:18789"
            />
          </label>
          <label>
            Token (optional):
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="your-auth-token"
            />
          </label>
          <button type="submit">Connect</button>
        </form>
      ) : (
        <>
          <p>Connected to: {gateway}</p>
          <button
            onClick={() => setIsConfigured(false)}
            style={{ marginBottom: 20 }}
          >
            Change Config
          </button>
          <ChatWidget
            gateway={gateway}
            token={token || undefined}
            position="inline"
            theme="light"
            title="AI Assistant"
            debug
          />
        </>
      )}
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
```

### Step 10: Create vue-demo.ts

Create `apps/demo/src/vue-demo.ts`:

```typescript
import { createApp, ref, defineComponent, h } from 'vue';
import { ChatWidget } from '@openclaw/chat-vue';

const App = defineComponent({
  setup() {
    const gateway = ref(
      localStorage.getItem('openclaw-gateway') || 'ws://localhost:18789'
    );
    const token = ref(localStorage.getItem('openclaw-token') || '');
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
```

### Step 11: Install dependencies and run dev server

Run:
```bash
cd apps/demo
pnpm install
pnpm dev
```

Expected: Dev server starts at http://localhost:5173

### Step 12: Test with real Gateway

1. Open http://localhost:5173
2. Click "React Demo" or "Vue Demo"
3. Enter your Gateway URL and Token
4. Click "Connect"
5. Test sending messages

### Step 13: Commit

```bash
git add apps/demo/
git commit -m "feat: add demo app for React and Vue testing"
```

---

## Final Step: Push all changes

```bash
git push origin main
```

---

## Success Criteria

1. ✅ `pnpm build` succeeds with no errors
2. ✅ `pnpm test` passes all unit tests
3. ✅ Demo app connects to real Gateway
4. ✅ Both React and Vue widgets display messages correctly
