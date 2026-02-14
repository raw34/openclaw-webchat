# OpenClaw WebChat SDK

Embeddable WebChat SDK for [OpenClaw](https://openclaw.ai) Gateway. Build custom AI chat interfaces for your applications.

## Packages

| Package | Description |
|---------|-------------|
| [`@raw34/openclaw-webchat`](./packages/core) | Core WebSocket client (framework-agnostic) |
| [`@raw34/openclaw-webchat-react`](./packages/react) | React hooks and components |
| [`@raw34/openclaw-webchat-vue`](./packages/vue) | Vue composables and components |

## Quick Start

### React

```bash
npm install @raw34/openclaw-webchat-react
```

```tsx
import { ChatWidget } from '@raw34/openclaw-webchat-react';

function App() {
  return (
    <ChatWidget
      gateway="wss://ai.example.com:18789"
      token="your-token"
      position="bottom-right"
      theme="light"
      title="AI Assistant"
    />
  );
}
```

Or use the hook for custom UI:

```tsx
import { useOpenClawChat } from '@raw34/openclaw-webchat-react';

function CustomChat() {
  const { messages, isConnected, isLoading, streamingContent, send } = useOpenClawChat({
    gateway: 'wss://ai.example.com:18789',
    token: 'your-token',
  });

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.role}: {msg.content}
        </div>
      ))}
      {isLoading && <div>AI is typing: {streamingContent}</div>}
      <input
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            send(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
        disabled={!isConnected}
      />
    </div>
  );
}
```

### Vue

```bash
npm install @raw34/openclaw-webchat-vue
```

```vue
<script setup>
import { ChatWidget } from '@raw34/openclaw-webchat-vue';
import '@raw34/openclaw-webchat-vue/style.css';  // Required for styles
</script>

<template>
  <ChatWidget
    gateway="wss://ai.example.com:18789"
    token="your-token"
    position="bottom-right"
    theme="light"
    title="AI Assistant"
  />
</template>
```

Or use the composable for custom UI:

```vue
<script setup>
import { ref } from 'vue';
import { useOpenClawChat } from '@raw34/openclaw-webchat-vue';

const { messages, isConnected, isLoading, streamingContent, send } = useOpenClawChat({
  gateway: 'wss://ai.example.com:18789',
  token: 'your-token',
});

const input = ref('');

function handleSend() {
  if (input.value.trim()) {
    send(input.value);
    input.value = '';
  }
}
</script>

<template>
  <div>
    <div v-for="msg in messages" :key="msg.id">{{ msg.role }}: {{ msg.content }}</div>
    <div v-if="isLoading">AI is typing: {{ streamingContent }}</div>
    <input v-model="input" @keydown.enter="handleSend" :disabled="!isConnected" />
  </div>
</template>
```

### Core (Vanilla JS / Any Framework)

```bash
npm install @raw34/openclaw-webchat
```

```typescript
import { OpenClawClient } from '@raw34/openclaw-webchat';

const client = new OpenClawClient({
  gateway: 'wss://ai.example.com:18789',
  token: 'your-token',
});

client.on('message', (msg) => {
  console.log('AI:', msg.content);
});

client.on('streamChunk', (id, chunk) => {
  process.stdout.write(chunk);
});

await client.connect();
await client.send('Hello, AI!');
```

## API Reference

### OpenClawClient Options

```typescript
interface OpenClawClientOptions {
  gateway: string;              // WebSocket URL
  token?: string;               // Auth token
  password?: string;            // Auth password (alternative)
  deviceToken?: string;         // Device token for persistent sessions
  reconnect?: boolean;          // Auto-reconnect (default: true)
  reconnectInterval?: number;   // Reconnect interval in ms (default: 3000)
  maxReconnectAttempts?: number; // Max attempts (default: 10, -1 for infinite)
  connectionTimeout?: number;   // Timeout in ms (default: 10000)
  debug?: boolean;              // Debug logging (default: false)
}
```

### Client Methods

```typescript
// Connection
await client.connect();
client.disconnect();
client.isConnected;           // boolean
client.connectionState;       // 'disconnected' | 'connecting' | 'connected' | ...

// Chat
await client.send(content);
const history = await client.getHistory(limit);
await client.inject(content, role);

// Events
client.on('connected', () => {});
client.on('disconnected', (reason) => {});
client.on('message', (msg) => {});
client.on('streamStart', (messageId) => {});
client.on('streamChunk', (messageId, chunk) => {});
client.on('streamEnd', (messageId) => {});
client.on('error', (error) => {});
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Development mode
pnpm dev

# Run tests
pnpm test
```

## License

MIT
