# WebChat Pairing UX Improvement Implementation Plan

## Goal
Complete first-pairing usability for demo while keeping core protocol behavior aligned with latest OpenClaw gateway schema.

## Task 1: Core Protocol Conformance Audit
- Files:
  - `packages/core/src/types.ts`
  - `packages/core/src/client.ts`
  - `packages/core/src/deviceAuth/browserDeviceAuth.ts`
  - `packages/core/src/__tests__/client.test.ts`
  - `packages/core/src/__tests__/browserDeviceAuth.test.ts`
- Steps:
  1. Ensure connect params and device proof shape match gateway schema.
  2. Ensure persisted device token is passed via `auth.token` path.
  3. Keep token mismatch one-time retry behavior.
  4. Update/expand tests to assert schema-aligned fields.
- Validation:
  - `pnpm test -- --run packages/core/src/__tests__/client.test.ts packages/core/src/__tests__/browserDeviceAuth.test.ts`

## Task 2: Demo Pairing UX Tightening
- Files:
  - `apps/demo/src/react-demo.tsx`
  - `apps/demo/src/vue-demo.ts`
  - `apps/demo/src/style.css` (if needed)
- Steps:
  1. Preserve categorized errors (`PAIRING_REQUIRED`, `SCOPE_MISSING_WRITE`, etc.).
  2. On reset success, display explicit “reset done, click retry” notice.
  3. Keep reconnect manual (`Retry Connection`) without auto-loop.
- Validation:
  - manual run in demo with pairing-required and post-approval retry path.

## Task 3: Diagnose Script Consistency
- Files:
  - `scripts/diagnose-openclaw-ws.mjs`
  - `README.md`
  - `README.zh-CN.md`
- Steps:
  1. Keep default `--device-auth true` behavior.
  2. Keep deterministic category/code output.
  3. Document first-pairing expected behavior and approval/retry flow.
- Validation:
  - local direct URL: `chat_send_ok`
  - public URL before approval: `PAIRING_REQUIRED`

## Task 4: Final Verification
- Commands:
  - `pnpm lint`
  - `pnpm test -- --run`
  - `pnpm build`
  - `pnpm version:check`
- Manual:
  - local direct connect success
  - public pairing-required classification
  - post-approval retry success

## Commit Strategy
1. `docs(plans): add pairing UX improvement design and implementation plan`
2. `fix(core): ...` (if core adjustments are needed)
3. `feat(demo): pairing-required retry/reset notice improvements`
4. `docs/scripts): ...` (if docs/script updates are needed)
