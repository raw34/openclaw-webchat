# ChatWidget In-Box Pairing Flow Implementation Plan

## Task 1: Remove Demo Pre-Probe Gate
- Files:
  - `apps/demo/src/react-demo.tsx`
  - `apps/demo/src/vue-demo.ts`
- Steps:
  1. Remove connect probe call before showing chat widget.
  2. Keep config form as parameter input only.
  3. Enter chat view immediately after submit.

## Task 2: React Widget In-Box Pairing Notice
- Files:
  - `packages/react/src/components/ChatWidget.tsx`
  - `packages/react/src/hooks/useOpenClawChat.ts` (if needed)
- Steps:
  1. Detect `error?.code === 'PAIRING_REQUIRED'` in widget.
  2. Render in-widget pairing notice + `Retry Connection` button.
  3. Bind retry to hook `connect()` with local loading guard.

## Task 3: Vue Widget In-Box Pairing Notice
- Files:
  - `packages/vue/src/components/ChatWidget.vue`
  - `packages/vue/src/composables/useOpenClawChat.ts` (if needed)
- Steps:
  1. Add same pairing-required detection.
  2. Add in-widget pairing notice + retry button.
  3. Bind retry to composable `connect()` with local loading guard.

## Task 4: Validation
- Run:
  - `pnpm test -- --run`
  - `pnpm build`
- Manual:
  - pairing-required shown in widget
  - approval + in-widget retry succeeds
