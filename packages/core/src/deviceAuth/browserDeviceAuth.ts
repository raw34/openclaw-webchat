import type {
  ConnectChallenge,
  DeviceAuthProvider,
  DeviceIdentity,
  DeviceProof,
} from '../types';

const DB_NAME = 'openclaw-webchat';
const DB_VERSION = 1;
const STORE_NAME = 'device-auth';

interface StoredDeviceRecord {
  key: string;
  id: string;
  privateKeyJwk: JsonWebKey;
  publicKeyJwk: JsonWebKey;
  algorithm: string;
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

function fromUtf8(text: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(text);
  return encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength
  ) as ArrayBuffer;
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

function assertSupported(): void {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available');
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('WebCrypto is not available');
  }
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

    const id = globalThis.crypto.randomUUID();
    const algorithm = 'ECDSA_P256_SHA256';

    const keyPair = await globalThis.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign', 'verify']
    );

    const privateKeyJwk = (await globalThis.crypto.subtle.exportKey(
      'jwk',
      keyPair.privateKey
    )) as JsonWebKey;

    const publicKeyJwk = (await globalThis.crypto.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    )) as JsonWebKey;

    const created: StoredDeviceRecord = {
      key,
      id,
      privateKeyJwk,
      publicKeyJwk,
      algorithm,
    };

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
        publicKey: record.publicKeyJwk,
        algorithm: record.algorithm,
      };
    },

    async signChallenge(challenge: ConnectChallenge): Promise<DeviceProof> {
      const record = await getOrCreateRecord();

      const signingKey = await globalThis.crypto.subtle.importKey(
        'jwk',
        record.privateKeyJwk,
        {
          name: 'ECDSA',
          namedCurve: 'P-256',
        },
        false,
        ['sign']
      );

      const payloadToSign = JSON.stringify({
        id: record.id,
        nonce: challenge.nonce,
        timestamp: challenge.timestamp,
      });

      const sigBuffer = await globalThis.crypto.subtle.sign(
        {
          name: 'ECDSA',
          hash: 'SHA-256',
        },
        signingKey,
        fromUtf8(payloadToSign)
      );

      return {
        id: record.id,
        nonce: challenge.nonce,
        timestamp: challenge.timestamp,
        algorithm: record.algorithm,
        publicKey: record.publicKeyJwk,
        signature: toBase64Url(new Uint8Array(sigBuffer)),
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
