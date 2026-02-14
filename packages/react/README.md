# @raw34/openclaw-webchat-react

React hooks and components for OpenClaw Gateway. Build AI chat interfaces with ease.

## Installation

```bash
npm install @raw34/openclaw-webchat-react
# or
pnpm add @raw34/openclaw-webchat-react
# or
yarn add @raw34/openclaw-webchat-react
```

## Quick Start

### Using ChatWidget (Easiest)

Drop-in chat widget with built-in UI:

```tsx
import { ChatWidget } from '@raw34/openclaw-webchat-react';

function App() {
  return (
    <ChatWidget
      gateway="wss://your-gateway.example.com/ws"
      token="your-auth-token"
      position="bottom-right"
      theme="light"
      title="AI Assistant"
    />
  );
}
```

### Using Hook (Custom UI)

Build your own chat interface:

```tsx
import { useOpenClawChat } from '@raw34/openclaw-webchat-react';

function CustomChat() {
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

  const [input, setInput] = useState('');

  const handleSend = async () => {
    if (!input.trim() || !isConnected) return;
    await send(input);
    setInput('');
  };

  return (
    <div>
      {/* Messages */}
      {messages.map((msg) => (
        <div key={msg.id} className={msg.role}>
          {msg.content}
        </div>
      ))}

      {/* Streaming indicator */}
      {isLoading && <div className="typing">{streamingContent || '...'}</div>}

      {/* Error display */}
      {error && <div className="error">{error.message}</div>}

      {/* Input */}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        disabled={!isConnected || isLoading}
        placeholder={isConnected ? 'Type a message...' : 'Connecting...'}
      />
      <button onClick={handleSend} disabled={!isConnected || isLoading}>
        Send
      </button>
    </div>
  );
}
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

  /** Custom CSS class */
  className?: string;

  /** Enable debug logging */
  debug?: boolean;

  // ... all OpenClawClientOptions are also supported
}
```

### ChatWidget Render Props

```tsx
<ChatWidget
  gateway="..."
  token="..."
  // Custom message renderer
  renderMessage={(message) => (
    <div className={`message ${message.role}`}>
      <strong>{message.role}:</strong> {message.content}
    </div>
  )}
  // Custom loading indicator
  renderLoading={(streamingContent) => (
    <div className="loading">
      AI is typing: {streamingContent}
    </div>
  )}
  // Callbacks
  onSend={(content) => console.log('Sent:', content)}
  onMessage={(message) => console.log('Received:', message)}
/>
```

### useOpenClawChat Hook

```typescript
const {
  messages,          // Message[] - all messages
  connectionState,   // ConnectionState - current connection state
  isConnected,       // boolean - is connected
  isLoading,         // boolean - is sending/receiving
  streamingContent,  // string - current streaming content
  error,             // Error | null - last error
  send,              // (content: string) => Promise<void>
  connect,           // () => Promise<void>
  disconnect,        // () => void
  clearMessages,     // () => void
  loadHistory,       // (limit?: number) => Promise<void>
  client,            // OpenClawClient | null - underlying client
} = useOpenClawChat(options);
```

### Hook Options

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

```tsx
<ChatWidget
  gateway="wss://your-gateway.example.com/ws"
  token="your-token"
  position="inline"  // Renders inline, not floating
  theme="light"
/>
```

### Dark Mode

```tsx
<ChatWidget
  gateway="wss://your-gateway.example.com/ws"
  token="your-token"
  theme="dark"
/>

{/* Or auto-detect system preference */}
<ChatWidget
  gateway="wss://your-gateway.example.com/ws"
  token="your-token"
  theme="auto"
/>
```

### Custom Positioning

```tsx
<ChatWidget
  gateway="wss://your-gateway.example.com/ws"
  token="your-token"
  position="bottom-left"  // or 'top-right', 'top-left'
/>
```

### With Manual Connection

```tsx
function App() {
  const { isConnected, connect, disconnect, send } = useOpenClawChat({
    gateway: 'wss://your-gateway.example.com/ws',
    token: 'your-token',
    autoConnect: false,  // Don't connect automatically
  });

  return (
    <div>
      {isConnected ? (
        <button onClick={disconnect}>Disconnect</button>
      ) : (
        <button onClick={connect}>Connect</button>
      )}
    </div>
  );
}
```

## TypeScript

Full TypeScript support with exported types:

```typescript
import type {
  OpenClawClientOptions,
  Message,
  ConnectionState,
} from '@raw34/openclaw-webchat-react';
```

## License

MIT
