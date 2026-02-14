# openclaw-webchat

Core WebSocket client for OpenClaw Gateway. Framework-agnostic, works with any JavaScript environment.

## Installation

```bash
npm install openclaw-webchat
# or
pnpm add openclaw-webchat
# or
yarn add openclaw-webchat
```

## Quick Start

```typescript
import { OpenClawClient } from 'openclaw-webchat';

const client = new OpenClawClient({
  gateway: 'wss://your-gateway.example.com/ws',
  token: 'your-auth-token',
});

// Listen for messages
client.on('message', (msg) => {
  console.log(`${msg.role}: ${msg.content}`);
});

// Listen for streaming responses
client.on('streamChunk', (messageId, chunk) => {
  process.stdout.write(chunk);
});

// Connect and send message
await client.connect();
await client.send('Hello, AI!');
```

## API Reference

### Constructor Options

```typescript
interface OpenClawClientOptions {
  /** Gateway WebSocket URL (required) */
  gateway: string;

  /** Authentication token */
  token?: string;

  /** Authentication password (alternative to token) */
  password?: string;

  /** Device token for persistent sessions */
  deviceToken?: string;

  /** Session key (auto-detected if not provided) */
  sessionKey?: string;

  /** Client name for identification */
  clientName?: string;

  /** Client version */
  clientVersion?: string;

  /** Auto-reconnect on disconnect (default: true) */
  reconnect?: boolean;

  /** Reconnect interval in ms (default: 3000) */
  reconnectInterval?: number;

  /** Max reconnect attempts (default: 10, -1 for infinite) */
  maxReconnectAttempts?: number;

  /** Connection timeout in ms (default: 10000) */
  connectionTimeout?: number;

  /** Enable debug logging (default: false) */
  debug?: boolean;
}
```

### Methods

```typescript
// Connection
await client.connect();        // Connect to gateway
client.disconnect();           // Disconnect from gateway
client.isConnected;            // boolean - connection status
client.connectionState;        // 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'reconnecting' | 'error'

// Chat
await client.send(content);                    // Send message to AI
await client.send(content, metadata);          // Send with metadata
const history = await client.getHistory(50);   // Get chat history
await client.inject(content, 'system');        // Inject system message
```

### Events

```typescript
client.on('connected', () => {
  console.log('Connected to gateway');
});

client.on('disconnected', (reason) => {
  console.log('Disconnected:', reason);
});

client.on('reconnecting', (attempt) => {
  console.log(`Reconnecting... attempt ${attempt}`);
});

client.on('error', (error) => {
  console.error('Error:', error.message);
});

client.on('message', (message) => {
  // Complete message received
  console.log(message.role, message.content);
});

client.on('streamStart', (messageId) => {
  // AI started streaming response
});

client.on('streamChunk', (messageId, chunk) => {
  // Streaming chunk received
  process.stdout.write(chunk);
});

client.on('streamEnd', (messageId) => {
  // Streaming complete
});

client.on('stateChange', (state) => {
  // Connection state changed
  console.log('State:', state.connectionState);
});
```

### Message Type

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}
```

## Advanced Usage

### Manual Session Key

```typescript
const client = new OpenClawClient({
  gateway: 'wss://your-gateway.example.com/ws',
  token: 'your-token',
  sessionKey: 'custom-session-key',  // Use specific session
});
```

### Disable Auto-Reconnect

```typescript
const client = new OpenClawClient({
  gateway: 'wss://your-gateway.example.com/ws',
  token: 'your-token',
  reconnect: false,
});
```

### Custom Reconnect Strategy

```typescript
const client = new OpenClawClient({
  gateway: 'wss://your-gateway.example.com/ws',
  token: 'your-token',
  reconnect: true,
  reconnectInterval: 5000,      // 5 seconds between attempts
  maxReconnectAttempts: -1,     // Infinite retries
});
```

## License

MIT
