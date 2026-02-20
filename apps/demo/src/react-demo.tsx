import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OpenClawClient } from 'openclaw-webchat';
import { ChatWidget } from 'openclaw-webchat-react';

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

function App() {
  const [gateway, setGateway] = useState(
    localStorage.getItem('openclaw-gateway') || DEFAULT_GATEWAY
  );
  const [token, setToken] = useState(localStorage.getItem('openclaw-token') || DEFAULT_TOKEN);
  const [isConfigured, setIsConfigured] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleConnect() {
    localStorage.setItem('openclaw-gateway', gateway);
    localStorage.setItem('openclaw-token', token);
    setNotice(null);
    setIsConfigured(true);
  }

  async function handleResetDeviceIdentity() {
    const client = new OpenClawClient({
      gateway,
      token: token || undefined,
      reconnect: false,
    });

    try {
      await client.resetDeviceIdentity();
      setNotice('Device identity reset. Click "Retry Connection" to connect again.');
    } catch (err) {
      const mapped = normalizeError(err);
      setNotice(`${mapped.title}: ${mapped.hint}`);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void handleConnect();
  }

  return (
    <div className="demo-page">
      <a href="/" className="back-link">
        ← Back to Home
      </a>
      <h1>React ChatWidget Demo</h1>

      {!isConfigured ? (
        <form className="config-form" onSubmit={handleSubmit}>
          <label>
            Gateway URL:
            <input
              type="text"
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              placeholder="wss://example.com/ws"
            />
          </label>
          <label>
            Token (optional):
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="gateway auth token"
            />
          </label>
          <button type="submit">Connect</button>

          {notice ? <div className="notice-card">{notice}</div> : null}
        </form>
      ) : (
        <>
          <p>Connected to: {gateway}</p>
          <div className="action-row" style={{ marginBottom: 20 }}>
            <button onClick={() => setIsConfigured(false)}>Change Config</button>
            <button onClick={() => void handleResetDeviceIdentity()}>Reset Device Identity</button>
          </div>
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
