const STORAGE_KEY = 'openclaw-webchat:session-stable-id';
const SESSION_PREFIX = 'webchat';

function randomHex(size = 16): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(size);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateStableSessionKey(prefix = SESSION_PREFIX): string {
  if (typeof window === 'undefined' || !window.localStorage) {
    return `${prefix}:${randomHex()}`;
  }

  const existing = window.localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return `${prefix}:${existing}`;
  }

  const stableId = randomHex();
  window.localStorage.setItem(STORAGE_KEY, stableId);
  return `${prefix}:${stableId}`;
}
