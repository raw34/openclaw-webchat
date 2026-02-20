import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { createBrowserDeviceAuthProvider } from '../deviceAuth';

const DB_NAME = 'openclaw-webchat';

describe('createBrowserDeviceAuthProvider', () => {
  beforeEach(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(DB_NAME);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error ?? new Error('failed to clear db'));
      req.onblocked = () => resolve();
    });
  });

  it('reports supported when IndexedDB and WebCrypto are available', () => {
    const provider = createBrowserDeviceAuthProvider('wss://gateway.example/ws');
    expect(provider.isSupported()).toBe(true);
  });

  it('reports unsupported when IndexedDB is missing', () => {
    const previous = (globalThis as Record<string, unknown>).indexedDB;
    delete (globalThis as Record<string, unknown>).indexedDB;
    try {
      const provider = createBrowserDeviceAuthProvider('wss://gateway.example/ws');
      expect(provider.isSupported()).toBe(false);
    } finally {
      (globalThis as Record<string, unknown>).indexedDB = previous;
    }
  });

  it('creates stable identity per gateway key', async () => {
    const gateway = 'wss://gateway.example/ws';
    const providerA = createBrowserDeviceAuthProvider(gateway);
    const identityA = await providerA.getOrCreateIdentity();

    const providerB = createBrowserDeviceAuthProvider(gateway);
    const identityB = await providerB.getOrCreateIdentity();

    expect(identityB.id).toBe(identityA.id);
    expect(identityB.publicKey).toEqual(identityA.publicKey);
    expect(identityB.publicKey.length).toBeGreaterThan(12);
  });

  it('signs challenge and returns proof fields', async () => {
    const provider = createBrowserDeviceAuthProvider('wss://gateway.example/ws');
    const proof = await provider.signChallenge(
      { nonce: 'abc', timestamp: 1700000000000 },
      {
        clientId: 'webchat',
        clientMode: 'node',
        role: 'operator',
        scopes: ['operator.read', 'operator.write'],
        token: 'token-1',
      }
    );

    expect(proof).toMatchObject({
      id: expect.any(String),
      publicKey: expect.any(String),
      signedAt: expect.any(Number),
      nonce: 'abc',
      signature: expect.any(String),
    });
    expect(proof.signature.length).toBeGreaterThan(12);
  });

  it('supports token save/get/clear lifecycle', async () => {
    const provider = createBrowserDeviceAuthProvider('wss://gateway.example/ws');
    expect(await provider.getDeviceToken()).toBeUndefined();

    await provider.setDeviceToken('device-token-1');
    expect(await provider.getDeviceToken()).toBe('device-token-1');

    await provider.clearDeviceToken();
    expect(await provider.getDeviceToken()).toBeUndefined();
  });
});
