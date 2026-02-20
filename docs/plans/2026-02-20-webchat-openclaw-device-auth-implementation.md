# WebChat Device Auth Adaptation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement strict browser device-auth for OpenClaw WebChat so `connect` and `chat.send` work reliably with latest gateway auth requirements.

**Architecture:** Add a default browser `DeviceAuthProvider` (IndexedDB + WebCrypto) in `packages/core`, keep public API backward-compatible via optional injection override, and classify auth/scope errors for actionable UX in demo.

**Tech Stack:** TypeScript, Vitest, WebCrypto, IndexedDB, pnpm workspace

---

## Preconditions

1. Run `pnpm install` in repo root.
2. Confirm Node >= 22.
3. Use a browser that supports `IndexedDB` and `window.crypto.subtle` for manual demo validation.

---

### Task 1: Add Device Auth Contracts and Error Types

**Files:**
- Modify: `packages/core/src/types.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/__tests__/client.test.ts`

**Step 1: Write failing type-level usage test in existing client tests**

Add a compile-usage section (runtime noop assertions) that expects new optional option fields:

```ts
const client = new OpenClawClient({
  gateway: 'wss://example/ws',
  deviceAuthProvider: undefined,
});
expect(client).toBeDefined();
```

**Step 2: Run tests to verify current compile/test failure**

Run: `pnpm test -- packages/core/src/__tests__/client.test.ts`
Expected: type error for unknown `deviceAuthProvider`.

**Step 3: Add minimal contract types**

In `packages/core/src/types.ts`, add:
- `DeviceIdentity`
- `DeviceProof`
- `DeviceAuthProvider`
- `OpenClawErrorCode` union
- Optional `deviceAuthProvider?: DeviceAuthProvider` in `OpenClawClientOptions`

**Step 4: Export the new contracts from public entry**

Update `packages/core/src/index.ts` exports so downstream packages can import contracts.

**Step 5: Run tests and typecheck**

Run: `pnpm test -- packages/core/src/__tests__/client.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/index.ts packages/core/src/__tests__/client.test.ts
git commit -m "feat(core): add device auth contracts and error codes"
```

---

### Task 2: Implement Default Browser DeviceAuthProvider

**Files:**
- Create: `packages/core/src/deviceAuth/browserDeviceAuth.ts`
- Create: `packages/core/src/deviceAuth/index.ts`
- Create: `packages/core/src/__tests__/browserDeviceAuth.test.ts`
- Modify: `packages/core/src/index.ts`

**Step 1: Write failing provider tests**

Create tests for:
- `isSupported()` true/false paths
- identity creation and stable reload by gateway bucket key
- challenge signing returns required fields
- deviceToken save/get/clear behavior

Example assertion:

```ts
expect(proof).toMatchObject({ id: expect.any(String), signature: expect.any(String), nonce: 'abc' });
```

**Step 2: Run tests to verify failure**

Run: `pnpm test -- packages/core/src/__tests__/browserDeviceAuth.test.ts`
Expected: FAIL (module not found / not implemented).

**Step 3: Implement minimal provider**

In `browserDeviceAuth.ts`:
- IndexedDB db/store constants
- normalize gateway key function
- generate ECDSA keypair via WebCrypto
- persist key material + device token in IndexedDB
- sign challenge payload and return `DeviceProof`
- strict `isSupported` checks

**Step 4: Export provider factory**

Expose `createBrowserDeviceAuthProvider(gateway: string): DeviceAuthProvider` from `deviceAuth/index.ts` and public index.

**Step 5: Re-run provider tests**

Run: `pnpm test -- packages/core/src/__tests__/browserDeviceAuth.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add packages/core/src/deviceAuth packages/core/src/__tests__/browserDeviceAuth.test.ts packages/core/src/index.ts
git commit -m "feat(core): add browser device auth provider"
```

---

### Task 3: Integrate Device Auth Flow into OpenClawClient Handshake

**Files:**
- Modify: `packages/core/src/client.ts`
- Modify: `packages/core/src/__tests__/client.test.ts`
- Test: `packages/core/src/__tests__/MockWebSocket.ts` (only if needed)

**Step 1: Add failing handshake tests first**

Add/adjust tests for:
- sends `connect` with `device` proof after `connect.challenge`
- prefers `auth.deviceToken` when available
- stores `hello-ok.auth.deviceToken`
- on token mismatch clears token and retries once with shared auth
- missing browser capability throws classified `DEVICE_AUTH_UNSUPPORTED`
- `chat.send` missing write scope maps to `SCOPE_MISSING_WRITE`

**Step 2: Run failing tests**

Run: `pnpm test -- packages/core/src/__tests__/client.test.ts`
Expected: FAIL in new cases.

**Step 3: Implement handshake integration**

Update `client.ts`:
- resolve provider (injected or default browser provider)
- require provider support in strict browser mode
- on challenge: produce signed `device` proof
- include `device` in connect params
- auth priority: stored device token > token/password
- persist returned device token
- classify and map known errors

**Step 4: Add one-time mismatch retry logic**

Implement guarded retry for `gateway token/device token mismatch` category.

**Step 5: Run full core tests**

Run: `pnpm test -- packages/core/src/__tests__/client.test.ts`
Expected: PASS.

**Step 6: Commit**

```bash
git add packages/core/src/client.ts packages/core/src/__tests__/client.test.ts
git commit -m "feat(core): integrate signed device auth handshake"
```

---

### Task 4: Demo UX for Strict-Mode Errors and Identity Reset

**Files:**
- Modify: `apps/demo/src/react-demo.tsx`
- Modify: `apps/demo/src/vue-demo.ts`
- Optional Modify: `apps/demo/src/style.css`

**Step 1: Add failing UX checks (manual checklist comments in code)**

Define expected UI states:
- `PAIRING_REQUIRED` guidance shown
- `DEVICE_AUTH_UNSUPPORTED` guidance shown
- `SCOPE_MISSING_WRITE` guidance shown
- `Retry Connection` and `Reset Device Identity` actions visible

**Step 2: Implement categorized error rendering**

Map normalized errors to action hints in React/Vue demos.

**Step 3: Implement reset action**

Call client/provider reset for current gateway bucket only, then allow reconnect.

**Step 4: Run demo build**

Run: `pnpm build --filter @openclaw/demo`
Expected: PASS.

**Step 5: Commit**

```bash
git add apps/demo/src/react-demo.tsx apps/demo/src/vue-demo.ts apps/demo/src/style.css
git commit -m "feat(demo): add strict auth error UX and identity reset"
```

---

### Task 5: Align Diagnostic Script with New Error Categories

**Files:**
- Modify: `scripts/diagnose-openclaw-ws.mjs`
- Modify: `README.md`
- Modify: `README.zh-CN.md`

**Step 1: Add failing behavioral expectations in script comments**

Expected script outputs include category-level results aligned with core:
- `pairing required`
- `missing scope`
- `token mismatch`
- `device auth unsupported` (when detectable client-side)

**Step 2: Update script mapping and output schema**

Ensure normalized categories and safe logs match core naming.

**Step 3: Update docs quick troubleshooting snippets**

Add concise notes about `/ws`, strict device auth requirement, and reset flow.

**Step 4: Verify script smoke test**

Run:
- `GATEWAY_AUTH_TOKEN=*** node scripts/diagnose-openclaw-ws.mjs --url wss://gateway.example.com/ws --connect-only true`
Expected: deterministic category output (success or classified failure).

**Step 5: Commit**

```bash
git add scripts/diagnose-openclaw-ws.mjs README.md README.zh-CN.md
git commit -m "docs(scripts): align ws diagnostics with strict device auth"
```

---

### Task 6: Final Verification and Release Readiness

**Files:**
- Modify if needed: `packages/*/README.md` (only if API docs changed)

**Step 1: Run full quality gates**

Run:
- `pnpm lint`
- `pnpm test`
- `pnpm build`
- `pnpm version:check`

Expected: all PASS.

**Step 2: Manual end-to-end validation**

Checklist:
- Fresh browser profile connects, stores identity, and can chat.
- Re-open page reuses identity/token and can chat.
- Pairing-required path shows guidance.
- Reset identity forces clean reconnect flow.

**Step 3: Prepare PR summary**

Include:
- changed files by package
- test/build evidence
- migration notes (strict browser requirements)

**Step 4: Commit docs-only follow-up if needed**

```bash
git add -A
git commit -m "chore: finalize strict device auth adaptation"
```

---

## Notes for Execution

- Keep commits small and task-scoped.
- Do not introduce token-only fallback paths in strict mode.
- Preserve existing public APIs; add optional fields only.
- Prefer deterministic tests with mocked crypto/idb boundaries.
