# @raw34/chat-vue

Vue 3 composables and components for OpenClaw Gateway. Build AI chat interfaces with ease.

## Installation

```bash
npm install @raw34/chat-vue
# or
pnpm add @raw34/chat-vue
# or
yarn add @raw34/chat-vue
```

## Quick Start

### Using ChatWidget (Easiest)

Drop-in chat widget with built-in UI:

```vue
<script setup>
import { ChatWidget } from '@raw34/chat-vue';
import '@raw34/chat-vue/style.css';  // Required for styles
</script>

<template>
  <ChatWidget
    gateway="wss://your-gateway.example.com/ws"
    token="your-auth-token"
    position="bottom-right"
    theme="light"
    title="AI Assistant"
  />
</template>
```

**Important:** You must import the CSS file for styles to work.

### Using Composable (Custom UI)

Build your own chat interface:

```vue
<script setup>
import { ref } from 'vue';
import { useOpenClawChat } from '@raw34/chat-vue';

const {
  messages,
  isConnected,
  isLoading,
  streamingContent,
  error,
  send,
} = useOpenClawChat({
  gateway: 'wss://your-gateway.example.com/ws',
  token: 'your-auth-token',
});

const input = ref('');

async function handleSend() {
  if (!input.value.trim() || !isConnected.value) return;
  await send(input.value);
  input.value = '';
}
</script>

<template>
  <div class="chat">
    <!-- Messages -->
    <div v-for="msg in messages" :key="msg.id" :class="msg.role">
      {{ msg.content }}
    </div>

    <!-- Streaming indicator -->
    <div v-if="isLoading" class="typing">
      {{ streamingContent || '...' }}
    </div>

    <!-- Error display -->
    <div v-if="error" class="error">
      {{ error.message }}
    </div>

    <!-- Input -->
    <input
      v-model="input"
      @keydown.enter="handleSend"
      :disabled="!isConnected || isLoading"
      :placeholder="isConnected ? 'Type a message...' : 'Connecting...'"
    />
    <button @click="handleSend" :disabled="!isConnected || isLoading">
      Send
    </button>
  </div>
</template>
```

## API Reference

### ChatWidget Props

```typescript
interface ChatWidgetProps {
  /** Gateway WebSocket URL (required) */
  gateway: string;

  /** Authentication token */
  token?: string;

  /** Authentication password (alternative to token) */
  password?: string;

  /** Widget position */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'inline';

  /** Color theme */
  theme?: 'light' | 'dark' | 'auto';

  /** Widget title */
  title?: string;

  /** Input placeholder text */
  placeholder?: string;

  /** Start with widget open (floating mode only) */
  defaultOpen?: boolean;

  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;

  /** Enable debug logging */
  debug?: boolean;

  // ... all OpenClawClientOptions are also supported
}
```

### ChatWidget Events

```vue
<ChatWidget
  gateway="..."
  token="..."
  @send="(content) => console.log('Sent:', content)"
  @message="(message) => console.log('Received:', message)"
/>
```

### ChatWidget Slots

```vue
<ChatWidget gateway="..." token="...">
  <!-- Custom message template -->
  <template #message="{ message }">
    <div :class="['message', message.role]">
      <strong>{{ message.role }}:</strong>
      {{ message.content }}
    </div>
  </template>

  <!-- Custom loading template -->
  <template #loading="{ content }">
    <div class="loading">
      AI is typing: {{ content }}
    </div>
  </template>
</ChatWidget>
```

### useOpenClawChat Composable

```typescript
const {
  messages,          // Ref<Message[]> - all messages
  connectionState,   // Ref<ConnectionState> - current connection state
  isConnected,       // ComputedRef<boolean> - is connected
  isLoading,         // Ref<boolean> - is sending/receiving
  streamingContent,  // Ref<string> - current streaming content
  error,             // Ref<Error | null> - last error
  send,              // (content: string) => Promise<void>
  connect,           // () => Promise<void>
  disconnect,        // () => void
  clearMessages,     // () => void
  loadHistory,       // (limit?: number) => Promise<void>
  client,            // Ref<OpenClawClient | null> - underlying client
} = useOpenClawChat(options);
```

### Composable Options

```typescript
interface UseOpenClawChatOptions {
  /** Gateway WebSocket URL (required) */
  gateway: string;

  /** Authentication token */
  token?: string;

  /** Auto-connect on mount (default: true) */
  autoConnect?: boolean;

  // ... all OpenClawClientOptions are also supported
}
```

## Examples

### Inline Chat

```vue
<ChatWidget
  gateway="wss://your-gateway.example.com/ws"
  token="your-token"
  position="inline"
  theme="light"
/>
```

### Dark Mode

```vue
<ChatWidget
  gateway="wss://your-gateway.example.com/ws"
  token="your-token"
  theme="dark"
/>

<!-- Or auto-detect system preference -->
<ChatWidget
  gateway="wss://your-gateway.example.com/ws"
  token="your-token"
  theme="auto"
/>
```

### Custom Positioning

```vue
<ChatWidget
  gateway="wss://your-gateway.example.com/ws"
  token="your-token"
  position="bottom-left"
/>
```

### With Manual Connection

```vue
<script setup>
import { useOpenClawChat } from '@raw34/chat-vue';

const { isConnected, connect, disconnect } = useOpenClawChat({
  gateway: 'wss://your-gateway.example.com/ws',
  token: 'your-token',
  autoConnect: false,  // Don't connect automatically
});
</script>

<template>
  <button v-if="isConnected" @click="disconnect">Disconnect</button>
  <button v-else @click="connect">Connect</button>
</template>
```

### Reactive Gateway URL

```vue
<script setup>
import { ref, watch } from 'vue';
import { useOpenClawChat } from '@raw34/chat-vue';

const gateway = ref('wss://gateway1.example.com/ws');

const chat = useOpenClawChat({
  gateway: gateway.value,
  token: 'your-token',
});

// Note: To switch gateways, you'll need to create a new composable instance
// or manually disconnect and reconnect
</script>
```

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  OpenClawClientOptions,
  Message,
  ConnectionState,
} from '@raw34/chat-vue';
```

## CSS Import

The ChatWidget component uses scoped CSS. You **must** import the styles:

```typescript
// Option 1: In your main entry file
import '@raw34/chat-vue/style.css';

// Option 2: In your component
import '@raw34/chat-vue/dist/index.css';
```

If styles are not showing, make sure you've imported the CSS file.

## License

MIT
