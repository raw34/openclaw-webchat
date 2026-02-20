#!/usr/bin/env node

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
 */

const DEFAULT_SCOPES = ["operator.read", "operator.write"];
const DEFAULT_TIMEOUT_MS = 10000;

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
    return "token mismatch";
  }
  if (text.includes("missing scope")) {
    return "missing scope";
  }
  if (text.includes("invalid connect params")) {
    return "connect schema mismatch";
  }
  if (text.includes("unauthorized")) {
    return "unauthorized";
  }
  return "unknown";
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

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const url = args.url;
  const tokenEnv = args["token-env"] || "GATEWAY_AUTH_TOKEN";
  const token = process.env[tokenEnv];
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

  const result = await new Promise((resolve) => {
    let settled = false;
    let gotChallenge = false;
    let connectOkPayload = null;
    let awaitingChatResult = false;
    const requestId = "connect-1";
    const chatRequestId = "chat-1";

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

    ws.addEventListener("message", (event) => {
      let frame;
      try {
        frame = JSON.parse(event.data);
      } catch {
        return;
      }

      if (frame?.type === "event" && frame?.event === "connect.challenge") {
        gotChallenge = true;
        console.log(`[${now()}] received connect.challenge`);
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
            auth: {
              token,
            },
          },
        };
        ws.send(JSON.stringify(connectFrame));
        console.log(`[${now()}] sent connect request`);
        return;
      }

      if (frame?.type === "res" && frame?.id === requestId) {
        if (frame.ok) {
          connectOkPayload = frame.payload || null;
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
        done({
          ok: false,
          type: "connect_error",
          message,
          category: classify(message),
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
        done({
          ok: false,
          type: "chat_send_error",
          message,
          category: classify(message),
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
    `[${now()}] result=FAIL type=${result.type} category=${result.category || "n/a"} message="${sanitizeText(result.message, token)}"`
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
