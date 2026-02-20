# ChatWidget Session Isolation Design

## Background

WebChat currently can reuse gateway default session routing when no explicit `sessionKey` is provided. In practice this can mix WebChat replies with other channels (for example Telegram), creating cross-channel conversation leakage.

## Goal

Fix cross-channel/session mixing by making browser widget sessions isolated by default.

## Scope

In scope:

- Default isolated session behavior for React/Vue `ChatWidget`
- Demo uses component default behavior (no extra business logic)
- Keep existing pairing/scope auth UX unchanged

Out of scope (this iteration):

- "No reply" timeout/recovery UX
- Gateway-side routing changes

## Design

### 1) Component-led default session isolation

In React/Vue `ChatWidget`:

- If `sessionKey` prop is passed, use it directly.
- If `sessionKey` is not passed, generate and persist a stable browser-local session key:
  - Format: `webchat:<stableId>`
  - `stableId` is generated once and saved in `localStorage`

Behavior:

- Same browser/profile keeps continuous conversation.
- Different browsers/profiles get different sessions.
- Channel sessions (e.g. Telegram) no longer collide by default.

### 2) API behavior

- Keep `sessionKey` prop available as explicit override.
- Default behavior changes intentionally to isolated session mode.
- No backward-compatibility guarantee for legacy implicit shared-main-session behavior.

### 3) Demo behavior

- Demo remains thin; no custom session routing logic in app layer.
- Widget default session isolation does the work.

## Risks and Mitigation

- Risk: accidental session reset if localStorage is cleared.
  - Mitigation: expected behavior; new isolated session is generated.
- Risk: consumers depending on shared default session behavior.
  - Mitigation: document behavior change and advise explicit `sessionKey` for intentional sharing.

## Acceptance Criteria

1. WebChat and Telegram do not share reply stream by default.
2. Two browsers using demo have isolated conversations by default.
3. Same browser reload keeps the same WebChat conversation session.
4. Existing pairing/scope prompts continue to work.
