# ChatWidget In-Box Pairing Flow Design

## Context
Current demo has split interaction:
- connect/probe happens in config form
- pairing guidance appears outside chat widget

This causes mismatch with expected UX where pairing and retry should happen inside the chat box itself.

## Goal
Move first-pairing guidance and retry interaction into ChatWidget for both React and Vue.

## Confirmed Decisions
- Scope: React + Vue both (`A`)
- Remove config-page pre-probe gate (`A`)
- Retry button shown only for `PAIRING_REQUIRED` (`A`)
- Keep reset-device behavior unchanged for now (`C`)

## Architecture
- Component-first behavior:
  - `ChatWidget` renders pairing-required notice and retry action in message area.
  - `useOpenClawChat` / `useOpenClawChat`(vue) remains source of connection/error/connect actions.
- Demo role:
  - Config page only stores config and enters chat view.
  - No longer owns pairing decision logic.

## Interaction Flow
1. User enters chat widget.
2. Widget attempts connect (existing autoConnect behavior).
3. If `error.code === PAIRING_REQUIRED`, widget shows:
   - pairing-required guidance text
   - `Retry Connection` button
4. Admin approves pending device on gateway host.
5. User clicks `Retry Connection` in widget.
6. Connect succeeds, notice disappears, chat works.

## Non-goals
- No automatic retry loop in this iteration.
- No reset-identity UX changes in this iteration.

## Files (Planned)
- `packages/react/src/components/ChatWidget.tsx`
- `packages/react/src/hooks/useOpenClawChat.ts`
- `packages/vue/src/components/ChatWidget.vue`
- `packages/vue/src/composables/useOpenClawChat.ts`
- `apps/demo/src/react-demo.tsx`
- `apps/demo/src/vue-demo.ts`

## Verification
- Pairing-required appears in widget (not config page)
- Retry button only appears for pairing-required
- After approval, in-widget retry succeeds
- Build + tests pass
