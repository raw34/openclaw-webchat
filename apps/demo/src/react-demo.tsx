import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatWidget } from '@raw34/openclaw-webchat-react';

const DEFAULT_GATEWAY = import.meta.env.VITE_GATEWAY_URL || 'ws://localhost:18789';
const DEFAULT_TOKEN = import.meta.env.VITE_TOKEN || '';

function App() {
  const [gateway, setGateway] = useState(
    localStorage.getItem('openclaw-gateway') || DEFAULT_GATEWAY
  );
  const [token, setToken] = useState(
    localStorage.getItem('openclaw-token') || DEFAULT_TOKEN
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
            position="bottom-right"
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
