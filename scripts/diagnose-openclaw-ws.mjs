#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import crypto from "node:crypto";

/**
 * OpenClaw Gateway WebSocket auth diagnostic.
 *
 * Usage:
 *   node scripts/diagnose-openclaw-ws.mjs \
 *     --url wss://gateway.example.com/ws
 *
 * Optional:
 *   --scopes operator.read,operator.write
 *   --timeout 10000
 *   --client-id webchat
 *   --chat-message "diagnostic ping"
 *   --session-key <sessionKey>
 *   --connect-only true
 *   --token-env GATEWAY_AUTH_TOKEN
 *   --device-auth true
 *   --reset-device true
 *   --device-store <path>
 *
 * Failure output includes:
 *   category=<token mismatch|pairing required|missing scope|...>
 *   code=<AUTH_FAILED|PAIRING_REQUIRED|SCOPE_MISSING_WRITE|...>
 */

const DEFAULT_SCOPES = ["operator.read", "operator.write"];
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_DEVICE_STORE = path.join(
  os.homedir(),
  ".openclaw",
  "diagnose-device-auth.json"
);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

function now() {
  return new Date().toISOString();
}

function usage() {
  console.log(
    [
      "OpenClaw WS Diagnostic",
      "",
      "Required:",
      "  --url <wss://.../ws>",
      "  env GATEWAY_AUTH_TOKEN=<gateway auth token>",
      "",
      "Optional:",
      "  --scopes <csv>          default: operator.read,operator.write",
      "  --timeout <ms>          default: 10000",
      "  --client-id <id>        default: webchat",
      "  --chat-message <text>   default: diagnostic ping",
      "  --session-key <key>     override sessionKey for chat.send probe",
      "  --connect-only true     stop after connect success (skip chat.send probe)",
      "  --token-env <name>      default: GATEWAY_AUTH_TOKEN",
      "",
      "Example:",
      "  GATEWAY_AUTH_TOKEN=*** node scripts/diagnose-openclaw-ws.mjs --url wss://gateway.example.com/ws",
    ].join("\n")
  );
}

function classify(message) {
  const text = String(message || "").toLowerCase();
  if (text.includes("gateway token mismatch")) {
    return { category: "token mismatch", code: "AUTH_FAILED" };
  }
  if (text.includes("device token mismatch")) {
    return { category: "token mismatch", code: "AUTH_FAILED" };
  }
  if (text.includes("token mismatch")) {
    return { category: "token mismatch", code: "AUTH_FAILED" };
  }
  if (text.includes("pairing required") || text.includes("pairing")) {
    return { category: "pairing required", code: "PAIRING_REQUIRED" };
  }
  if (text.includes("missing scope")) {
    if (text.includes("operator.write")) {
      return { category: "missing scope", code: "SCOPE_MISSING_WRITE" };
    }
    return { category: "missing scope", code: "INVALID_REQUEST" };
  }
  if (text.includes("invalid connect params")) {
    return { category: "connect schema mismatch", code: "INVALID_REQUEST" };
  }
  if (text.includes("indexeddb") || text.includes("webcrypto")) {
    return { category: "device auth unsupported", code: "DEVICE_AUTH_UNSUPPORTED" };
  }
  if (text.includes("unauthorized")) {
    return { category: "unauthorized", code: "AUTH_FAILED" };
  }
  return { category: "unknown", code: "UNKNOWN" };
}

function toBool(value) {
  return String(value || "").toLowerCase() === "true";
}

function maskUrl(raw) {
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}${u.pathname}`;
  } catch {
    return "<invalid-url>";
  }
}

function sanitizeText(input, token) {
  let text = String(input ?? "");
  if (token) {
    text = text.split(token).join("[REDACTED_TOKEN]");
  }
  return text.replace(/[A-Za-z0-9_-]{24,}/g, "[REDACTED_LONG_TOKEN]");
}

function toBase64Url(bytes) {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function normalizeGatewayKey(raw) {
  try {
    const u = new URL(raw);
    const pathname = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.protocol}//${u.host}${pathname}`;
  } catch {
    return String(raw || "");
  }
}

async function readDeviceStore(storePath) {
  try {
    const text = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeDeviceStore(storePath, store) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), {
    mode: 0o600,
  });
}

async function getOrCreateDeviceRecord(storePath, gatewayKey) {
  const store = await readDeviceStore(storePath);
  const existing = store[gatewayKey];
  if (existing?.id && existing?.privateKeyPem && existing?.publicKeyPem) {
    return { store, record: existing };
  }

  const keyPair = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = keyPair.publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  const privateKeyPem = keyPair.privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();
  const id = crypto.createHash("sha256").update(publicKeyRawFromPem(publicKeyPem)).digest("hex");

  const record = {
    id,
    publicKeyPem,
    privateKeyPem,
    deviceToken: undefined,
  };
  store[gatewayKey] = record;
  await writeDeviceStore(storePath, store);
  return { store, record };
}

function buildDevicePayload(params) {
  const version = params.nonce ? "v2" : "v1";
  const base = [
    version,
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAt),
    params.token ?? "",
  ];
  if (version === "v2") {
    base.push(params.nonce);
  }
  return base.join("|");
}

function publicKeyRawBase64UrlFromPem(publicKeyPem) {
  return toBase64Url(publicKeyRawFromPem(publicKeyPem));
}

function publicKeyRawFromPem(publicKeyPem) {
  const spki = crypto.createPublicKey(publicKeyPem).export({
    type: "spki",
    format: "der",
  });
  const ed25519Prefix = Buffer.from("302a300506032b6570032100", "hex");
  return spki.length === ed25519Prefix.length + 32 &&
    spki.subarray(0, ed25519Prefix.length).equals(ed25519Prefix)
      ? spki.subarray(ed25519Prefix.length)
      : spki;
}

function signDevicePayload(privateKeyPem, payload) {
  return toBase64Url(
    crypto.sign(null, Buffer.from(payload, "utf8"), crypto.createPrivateKey(privateKeyPem))
  );
}

function buildDeviceProof(record, challenge, params) {
  const signedAt = Date.now();
  const payload = buildDevicePayload({
    deviceId: record.id,
    clientId: params.clientId,
    clientMode: "node",
    role: "operator",
    scopes: params.scopes,
    signedAt,
    token: params.authToken,
    nonce: challenge.nonce || undefined,
  });

  return {
    id: record.id,
    publicKey: publicKeyRawBase64UrlFromPem(record.publicKeyPem),
    signature: signDevicePayload(record.privateKeyPem, payload),
    signedAt,
    nonce: challenge.nonce || undefined,
  };
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url;
  const tokenEnv = args["token-env"] || "GATEWAY_AUTH_TOKEN";
  const token = process.env[tokenEnv];
  const useDeviceAuth = args["device-auth"] === undefined ? true : toBool(args["device-auth"]);
  const resetDevice = toBool(args["reset-device"]);
  const deviceStorePath = args["device-store"] || DEFAULT_DEVICE_STORE;
  const gatewayKey = normalizeGatewayKey(url);
  const timeoutMs = Number(args.timeout || DEFAULT_TIMEOUT_MS);
  const clientId = args["client-id"] || "webchat";
  const chatMessage = args["chat-message"] || "diagnostic ping";
  const sessionKeyOverride = args["session-key"];
  const connectOnly = toBool(args["connect-only"]);
  const scopes = (args.scopes ? args.scopes.split(",") : DEFAULT_SCOPES)
    .map((x) => x.trim())
    .filter(Boolean);

  if (!url || !token) {
    if (args.token) {
      console.log(`[${now()}] warning: --token is disabled for safety, use env ${tokenEnv} instead`);
    }
    usage();
    process.exit(2);
  }

  console.log(`[${now()}] start`);
  console.log(`[${now()}] url=${maskUrl(url)}`);
  console.log(`[${now()}] client.id=${clientId}`);
  console.log(`[${now()}] scopes=${scopes.join(",")}`);
  console.log(`[${now()}] connectOnly=${connectOnly}`);
  console.log(`[${now()}] deviceAuth=${useDeviceAuth}`);

  if (resetDevice && useDeviceAuth) {
    const store = await readDeviceStore(deviceStorePath);
    if (store[gatewayKey]) {
      delete store[gatewayKey];
      await writeDeviceStore(deviceStorePath, store);
    }
    console.log(`[${now()}] device identity reset for current gateway bucket`);
  }

  const result = await new Promise((resolve) => {
    let settled = false;
    let gotChallenge = false;
    let connectOkPayload = null;
    let awaitingChatResult = false;
    let connectReqCount = 0;
    let requestId = "connect-1";
    const chatRequestId = "chat-1";
    let retryTokenMismatch = true;
    let activeChallenge = null;

    const done = (payload) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        ws.close();
      } catch {}
      resolve(payload);
    };

    const timer = setTimeout(() => {
      done({
        ok: false,
        type: "timeout",
        message: "timeout waiting for connect response",
      });
    }, timeoutMs);

    const ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      console.log(`[${now()}] websocket open`);
    });

    ws.addEventListener("error", () => {
      done({
        ok: false,
        type: "ws_error",
        message: "websocket error before connect handshake completed",
      });
    });

    ws.addEventListener("message", async (event) => {
      let frame;
      try {
        frame = JSON.parse(event.data);
      } catch {
        return;
      }

      if (frame?.type === "event" && frame?.event === "connect.challenge") {
        gotChallenge = true;
        activeChallenge = frame?.payload;
        console.log(`[${now()}] received connect.challenge`);
        const challenge = {
          nonce: frame?.payload?.nonce,
          timestamp: Number(frame?.payload?.timestamp || Date.now()),
        };
        if (!challenge.nonce) {
          done({
            ok: false,
            type: "connect_error",
            message: "invalid connect.challenge payload (missing nonce)",
            category: "connect schema mismatch",
            normalizedCode: "INVALID_REQUEST",
          });
          return;
        }
        let device;
        let auth;
        if (useDeviceAuth) {
          const { record } = await getOrCreateDeviceRecord(deviceStorePath, gatewayKey);
          const authToken = record.deviceToken || token;
          device = buildDeviceProof(record, challenge, {
            clientId,
            scopes,
            authToken,
          });
          if (record.deviceToken) {
            auth = { token: record.deviceToken };
          } else {
            auth = { token };
          }
        } else {
          auth = { token };
        }
        connectReqCount += 1;
        requestId = `connect-${connectReqCount}`;
        const connectFrame = {
          type: "req",
          id: requestId,
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: clientId,
              version: "diagnose-1.0.0",
              platform: "browser",
              mode: "node",
            },
            scopes,
            role: "operator",
            auth,
            ...(device ? { device } : {}),
          },
        };
        ws.send(JSON.stringify(connectFrame));
        console.log(`[${now()}] sent connect request`);
        return;
      }

      if (frame?.type === "res" && frame?.id === requestId) {
        if (frame.ok) {
          connectOkPayload = frame.payload || null;
          if (useDeviceAuth && frame?.payload?.auth?.deviceToken) {
            const { store, record } = await getOrCreateDeviceRecord(deviceStorePath, gatewayKey);
            store[gatewayKey] = {
              ...record,
              deviceToken: frame.payload.auth.deviceToken,
            };
            await writeDeviceStore(deviceStorePath, store);
            console.log(`[${now()}] saved device token`);
          }
          if (connectOnly) {
            done({
              ok: true,
              type: "hello_ok",
              message: "connect success (hello-ok)",
              payload: frame.payload,
            });
            return;
          }

          const mainSessionKey =
            sessionKeyOverride ||
            frame?.payload?.snapshot?.sessionDefaults?.mainSessionKey;
          if (!mainSessionKey) {
            done({
              ok: false,
              type: "chat_probe_unavailable",
              category: "missing session key",
              message:
                "connect succeeded, but no sessionKey found for chat.send probe; pass --session-key",
            });
            return;
          }

          const chatFrame = {
            type: "req",
            id: chatRequestId,
            method: "chat.send",
            params: {
              sessionKey: mainSessionKey,
              message: chatMessage,
              idempotencyKey: `diagnose-${Date.now()}`,
            },
          };
          awaitingChatResult = true;
          ws.send(JSON.stringify(chatFrame));
          console.log(`[${now()}] sent chat.send request`);
          return;
        }

        const message =
          frame?.error?.message || frame?.error?.code || "connect failed";
        const lower = String(message).toLowerCase();
        if (
          useDeviceAuth &&
          retryTokenMismatch &&
          (lower.includes("gateway token mismatch") ||
            lower.includes("device token mismatch") ||
            lower.includes("token mismatch"))
        ) {
          retryTokenMismatch = false;
          const { store, record } = await getOrCreateDeviceRecord(deviceStorePath, gatewayKey);
          store[gatewayKey] = {
            ...record,
            deviceToken: undefined,
          };
          await writeDeviceStore(deviceStorePath, store);
          connectReqCount += 1;
          requestId = `connect-${connectReqCount}`;
          const challenge = {
            nonce: activeChallenge?.nonce,
            timestamp: Number(activeChallenge?.timestamp || Date.now()),
          };
          if (challenge.nonce) {
            const device = buildDeviceProof(record, challenge, {
              clientId,
              scopes,
              authToken: token,
            });
            ws.send(
              JSON.stringify({
                type: "req",
                id: requestId,
                method: "connect",
                params: {
                  minProtocol: 3,
                  maxProtocol: 3,
                  client: {
                    id: clientId,
                    version: "diagnose-1.0.0",
                    platform: "browser",
                    mode: "node",
                  },
                  scopes,
                  role: "operator",
                  auth: { token },
                  device,
                },
              })
            );
            console.log(`[${now()}] retry connect with shared token after token mismatch`);
            return;
          }
        }
        const classified = classify(message);
        done({
          ok: false,
          type: "connect_error",
          message,
          category: classified.category,
          normalizedCode: classified.code,
          error: frame.error,
        });
        return;
      }

      if (frame?.type === "res" && frame?.id === chatRequestId) {
        if (frame.ok) {
          done({
            ok: true,
            type: "chat_send_ok",
            message: "connect + chat.send success",
            payload: {
              connect: connectOkPayload,
              chat: frame.payload,
            },
          });
          return;
        }

        const message =
          frame?.error?.message || frame?.error?.code || "chat.send failed";
        const classified = classify(message);
        done({
          ok: false,
          type: "chat_send_error",
          message,
          category: classified.category,
          normalizedCode: classified.code,
          error: frame.error,
        });
        return;
      }

      // Some gateway versions may emit events before/without a chat.send res.
      if (
        awaitingChatResult &&
        frame?.type === "event" &&
        (frame?.event === "chat" ||
          frame?.event === "message" ||
          frame?.event === "stream.start" ||
          frame?.event === "stream.chunk")
      ) {
        done({
          ok: true,
          type: "chat_event_only",
          message: `connect success; chat observed via event (${frame.event}) without explicit chat.send res`,
          payload: {
            connect: connectOkPayload,
            firstChatEvent: frame.event,
          },
        });
      }
    });

    ws.addEventListener("close", () => {
      if (!settled && !gotChallenge) {
        done({
          ok: false,
          type: "closed_early",
          message: "socket closed before challenge (path/proxy/basic-auth issue likely)",
        });
      }
    });
  });

  if (result.ok) {
    console.log(`[${now()}] result=OK type=${result.type} message="${result.message}"`);
    process.exit(0);
  }

  console.log(
    `[${now()}] result=FAIL type=${result.type} category=${result.category || "n/a"} code=${result.normalizedCode || "UNKNOWN"} message="${sanitizeText(result.message, token)}"`
  );
  if (result.error) {
    console.log(`[${now()}] error=${sanitizeText(JSON.stringify(result.error), token)}`);
  }
  process.exit(1);
}

run().catch((err) => {
  console.error(`[${now()}] fatal`, err instanceof Error ? err.message : String(err));
  process.exit(1);
});
