import type {
  ConnectChallenge,
  DeviceAuthProvider,
  DeviceIdentity,
  DeviceProof,
  DeviceSignContext,
} from '../types';

const DB_NAME = 'openclaw-webchat';
const DB_VERSION = 1;
const STORE_NAME = 'device-auth';
const ED25519_SPKI_PREFIX_HEX = '302a300506032b6570032100';

interface StoredDeviceRecord {
  key: string;
  id: string;
  privateKeyPkcs8Base64Url: string;
  publicKeyRawBase64Url: string;
  deviceToken?: string;
}

function normalizeGatewayKey(gateway: string): string {
  try {
    const url = new URL(gateway);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return gateway;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  const base64 = normalized + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function utf8(input: string): Uint8Array {
  return new TextEncoder().encode(input);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(bytes));
  const digestBytes = new Uint8Array(digest);
  return Array.from(digestBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function buildDevicePayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: 'node' | 'operator';
  role: 'operator' | 'node';
  scopes: string[];
  signedAt: number;
  token?: string | null;
  nonce?: string;
}): string {
  const version = params.nonce ? 'v2' : 'v1';
  const base = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(','),
    String(params.signedAt),
    params.token ?? '',
  ];
  if (version === 'v2') {
    base.push(params.nonce ?? '');
  }
  return base.join('|');
}

function assertSupported(): void {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available');
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto is not available');
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
}

function readRecord(db: IDBDatabase, key: string): Promise<StoredDeviceRecord | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result as StoredDeviceRecord | undefined);
    request.onerror = () => reject(request.error ?? new Error('Failed to read device auth record'));
  });
}

function writeRecord(db: IDBDatabase, record: StoredDeviceRecord): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to write device auth record'));

    store.put(record);
  });
}

function deleteRecord(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete device auth record'));

    store.delete(key);
  });
}

async function createRecord(key: string): Promise<StoredDeviceRecord> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'Ed25519',
    },
    true,
    ['sign', 'verify']
  );

  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));

  const prefix = hexToBytes(ED25519_SPKI_PREFIX_HEX);
  const rawPublic =
    spki.length === prefix.length + 32 &&
    prefix.every((v, i) => spki[i] === v)
      ? spki.slice(prefix.length)
      : spki;

  const id = await sha256Hex(rawPublic);

  return {
    key,
    id,
    publicKeyRawBase64Url: toBase64Url(rawPublic),
    privateKeyPkcs8Base64Url: toBase64Url(pkcs8),
    deviceToken: undefined,
  };
}

export function createBrowserDeviceAuthProvider(gateway: string): DeviceAuthProvider {
  const key = normalizeGatewayKey(gateway);

  async function getOrCreateRecord(): Promise<StoredDeviceRecord> {
    assertSupported();
    const db = await openDb();
    const existing = await readRecord(db, key);
    if (existing) {
      db.close();
      return existing;
    }

    const created = await createRecord(key);
    await writeRecord(db, created);
    db.close();
    return created;
  }

  return {
    isSupported(): boolean {
      return typeof indexedDB !== 'undefined' && Boolean(globalThis.crypto?.subtle);
    },

    async getOrCreateIdentity(): Promise<DeviceIdentity> {
      const record = await getOrCreateRecord();
      return {
        id: record.id,
        publicKey: record.publicKeyRawBase64Url,
      };
    },

    async signChallenge(challenge: ConnectChallenge, context: DeviceSignContext): Promise<DeviceProof> {
      const record = await getOrCreateRecord();
      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        toArrayBuffer(fromBase64Url(record.privateKeyPkcs8Base64Url)),
        { name: 'Ed25519' },
        false,
        ['sign']
      );

      const signedAt = Date.now();
      const payload = buildDevicePayload({
        deviceId: record.id,
        clientId: context.clientId,
        clientMode: context.clientMode,
        role: context.role,
        scopes: context.scopes,
        signedAt,
        token: context.token,
        nonce: challenge.nonce,
      });

      const signature = await crypto.subtle.sign('Ed25519', privateKey, toArrayBuffer(utf8(payload)));

      return {
        id: record.id,
        publicKey: record.publicKeyRawBase64Url,
        signature: toBase64Url(new Uint8Array(signature)),
        signedAt,
        nonce: challenge.nonce,
      };
    },

    async getDeviceToken(): Promise<string | undefined> {
      assertSupported();
      const db = await openDb();
      const record = await readRecord(db, key);
      db.close();
      return record?.deviceToken;
    },

    async setDeviceToken(token: string): Promise<void> {
      const record = await getOrCreateRecord();
      const db = await openDb();
      await writeRecord(db, {
        ...record,
        deviceToken: token,
      });
      db.close();
    },

    async clearDeviceToken(): Promise<void> {
      const record = await getOrCreateRecord();
      const db = await openDb();
      await writeRecord(db, {
        ...record,
        deviceToken: undefined,
      });
      db.close();
    },

    async resetIdentity(): Promise<void> {
      assertSupported();
      const db = await openDb();
      await deleteRecord(db, key);
      db.close();
    },
  };
}
