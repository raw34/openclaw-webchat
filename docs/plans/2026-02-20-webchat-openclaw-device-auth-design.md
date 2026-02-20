# WebChat OpenClaw Device Auth Adaptation Design

Date: 2026-02-20
Scope: `packages/core` + `apps/demo`
Mode: Strict security-first adaptation for latest OpenClaw Gateway auth model

## 1. Context and Goals

The latest OpenClaw Gateway enforces role/scope checks with device identity and pairing as part of practical authorization. Existing WebChat flow can connect but fail on `chat.send` with `missing scope: operator.write` when effective scopes are downgraded.

Goals:
- Keep existing public APIs compatible for React/Vue users.
- Add browser-side device identity flow (`IndexedDB + WebCrypto`) in core.
- Persist and reuse `deviceToken` per gateway URL bucket.
- Provide deterministic error classification and actionable demo UX.

Non-goals:
- No in-demo pairing approval workflow.
- No breaking API changes in `packages/react` and `packages/vue`.

## 2. Architecture

### 2.1 Core strategy (recommended option C)

Use a hybrid approach:
- Built-in browser default provider for device auth.
- Optional override provider for advanced/custom integrations.

Provider resolution order:
1. `clientOptions.deviceAuthProvider` if supplied.
2. Built-in browser provider if capabilities are available.
3. Hard fail with `DEVICE_AUTH_UNSUPPORTED` (strict mode).

### 2.2 Compatibility boundary

Keep existing `OpenClawClientOptions` fields valid and behavior-compatible where possible.
Only add optional fields/types; do not remove/rename existing fields.

### 2.3 Storage boundary

Persist identity and `deviceToken` by normalized gateway URL key.
No cross-origin sharing.
No cross-gateway reuse by default.

## 3. Runtime Data Flow

1. Open WS connection.
2. Receive `connect.challenge`.
3. Resolve provider and load/create device identity.
4. Sign challenge payload and build `device` proof.
5. Build `connect` request with:
   - `auth.deviceToken` (preferred) OR `auth.token/password` fallback.
   - requested `scopes`.
   - signed `device` payload.
6. On `hello-ok`:
   - save returned `auth.deviceToken` if present.
   - mark connected.
7. On `chat.send`:
   - if missing write scope, classify as `SCOPE_MISSING_WRITE` while preserving raw gateway error.

Recovery behavior:
- On `device token mismatch`: clear stored device token and retry connect once with shared auth + device proof.
- On `pairing required`: fail fast with classified error, no polling.

## 4. Error Model and Observability

Normalized error codes:
- `DEVICE_AUTH_UNSUPPORTED`
- `PAIRING_REQUIRED`
- `TOKEN_MISMATCH`
- `SCOPE_MISSING_WRITE`
- `WS_ENDPOINT_ERROR`
- `CONNECT_SCHEMA_ERROR`

Each normalized error keeps raw gateway fields for diagnostics:
- `rawCode`
- `rawMessage`
- `details` when available

Debug logs (`debug=true`) should emit phase markers without sensitive values:
- `challenge_received`
- `device_identity_loaded|created`
- `connect_sent`
- `hello_ok`
- `device_token_saved`
- `chat_send_failed_with_scope`

## 5. Demo UX (strict mode)

Demo behavior:
- Show explicit action hints by normalized error code.
- Provide:
  - `Retry Connection`
  - `Reset Device Identity (current gateway)`

No in-demo pairing approval flow.
No token-only fallback.

## 6. Testing Strategy

Core tests:
- successful connect with signed device proof.
- `hello-ok` stores `deviceToken`.
- reconnect prefers stored `deviceToken`.
- `device token mismatch` clears token and retries once.
- missing browser capability returns `DEVICE_AUTH_UNSUPPORTED`.
- `chat.send` scope failure maps to `SCOPE_MISSING_WRITE`.

Demo checks:
- categorized error banners render correctly.
- reset action clears only current gateway bucket.

## 7. Risks and Mitigations

Risk: Browser capability variance (`IndexedDB`/`WebCrypto`).
Mitigation: explicit strict-mode failure + clear user guidance.

Risk: Gateway policy differences across environments.
Mitigation: normalized error mapping and ws diagnostic script alignment.

Risk: stale or invalid persisted auth state.
Mitigation: token mismatch one-time recovery + explicit reset action.

## 8. Acceptance Criteria

- Connect handshake includes signed device identity.
- `deviceToken` is persisted and reused per gateway URL.
- No silent token-only downgrade in strict mode.
- `chat.send` succeeds for properly paired/scoped clients.
- Failures are actionable via normalized error code + raw details.
