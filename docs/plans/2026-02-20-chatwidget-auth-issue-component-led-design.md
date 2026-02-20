# ChatWidget Auth-Issue Component-Led Design

## Background

The current demo still shows `missing scope: operator.write` in chat flows on some machines even when command-line diagnostics can pass. This is expected when browser and CLI device identities differ. The real gap is UX ownership: auth issue handling is partly in demo glue and not consistently owned by widget components.

## Problem

- Demo should remain thin.
- React/Vue `ChatWidget` should own auth issue state handling.
- End users need clear in-chat guidance for pairing and scope issues.
- Device identity and chat history must not be reset automatically.

## Goals

- Move auth issue interpretation into component layer.
- Keep demo as simple wiring only.
- Provide sensible default copy with optional overrides.
- Preserve current API behavior for existing integrations.

## Non-goals

- Forcing identity reset as a normal flow.
- Making browser and CLI share one device identity.
- Changing gateway authorization policy.

## Approach

### 1) Component-led auth issue state

In React/Vue `ChatWidget`, normalize `error.code` into internal auth issue states:

- `PAIRING_REQUIRED`
- `SCOPE_MISSING_WRITE`

The widget decides what to render in chat message area and what action is available.

### 2) Configurable auth copy with defaults

Expose optional `authTexts` props while keeping built-in defaults:

- `pairingRequiredTitle`
- `pairingRequiredBody`
- `scopeMissingWriteTitle`
- `scopeMissingWriteBody`
- `retryConnectionButton`
- `retryingConnectionButton`

No config required for baseline behavior; demo may override if needed.

### 3) Unified retry behavior

For both pairing and scope-missing states, `Retry Connection` triggers `connect()`.

- No device identity reset.
- No message history reset.
- Keep existing generic error fallback visible when needed.

## Data/State Model

Internal widget state:

- `authIssue: 'none' | 'pairing_required' | 'scope_missing_write'`
- `isRetryingConnect: boolean`

Derived from current `error` each render; no additional persistence needed.

## UX Specification

In chat body, render an inline status panel:

- If `pairing_required`: show pairing-required title/body + retry button.
- If `scope_missing_write`: show scope-missing title/body + retry button.
- Else: do not render auth issue panel.

Input behavior remains unchanged (disabled if not connected/loading).

## Compatibility

- `useOpenClawChat` API remains unchanged.
- Existing consumers with no `authTexts` continue working.
- Demo code becomes thinner and less business-coupled.

## Testing Strategy

### React

- Render pairing panel when `error.code=PAIRING_REQUIRED`.
- Render scope panel when `error.code=SCOPE_MISSING_WRITE`.
- Verify `authTexts` overrides default copy.

### Vue

- Same three assertions as React.

### Workspace validation

- `pnpm lint`
- `pnpm test -- --run`
- `pnpm build`

## Risks and Mitigations

- Risk: duplicate auth handling paths in demo and widget.
  - Mitigation: remove demo-side auth branching.
- Risk: copy customization API drift between React and Vue.
  - Mitigation: keep prop shape aligned and documented together.

## Rollout

- Land as non-breaking widget enhancement.
- Validate locally with paired/unpaired/scope-missing devices.
- Update README sections for both frameworks if prop surface changes.
