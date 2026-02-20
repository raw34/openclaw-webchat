# WebChat Pairing UX Improvement Design

## Context
Current `openclaw-webchat` already supports strict device auth at protocol level, but first-time pairing UX is still easy to misunderstand:
- users can get `PAIRING_REQUIRED` and think reset is ineffective
- reset behavior is not explicit enough in demo
- troubleshooting path between local/private and public/reverse-proxy flows is not obvious

## Decisions (Confirmed)
- Scope: both protocol alignment hardening and demo UX improvements (`C`)
- Pairing UX style: conservative manual retry (`A`)
- Reset behavior: clear local identity/token and prompt manual reconnect (`A`)
- Diagnose script default: `device-auth=true` with optional fallback switch (`A`)

## Architecture Boundary
- `packages/core` remains the single source of truth for gateway protocol behavior:
  - connect/auth/device payload shape
  - device identity/signature/token persistence behavior
  - normalized error mapping
- `apps/demo` only consumes core behavior and focuses on user guidance/actions
- `scripts/diagnose-openclaw-ws.mjs` mirrors real webchat handshake semantics for reproducible diagnosis

## UX Flow (First Pairing)
1. User connects from demo.
2. If gateway returns `PAIRING_REQUIRED`, demo shows clear guidance and two actions:
   - `Retry Connection`
   - `Reset Device Identity`
3. `Reset Device Identity` only clears local identity/token for the current gateway bucket.
4. Demo shows explicit notice: identity reset completed; user should click retry.
5. After server-side approval, user retries and enters normal chat flow.

## Protocol Alignment Requirements
- Do not send `auth.deviceToken` in connect params.
- Use `auth.token` for both shared token and persisted device token path.
- Device proof must match current gateway schema (`id/publicKey/signature/signedAt/nonce`).
- Device ID must be derived from public key, not random UUID.
- Keep one-time token-mismatch fallback and stale token clearing behavior.

## Testing Strategy
- Unit tests: core handshake + browser device auth provider.
- Script validation:
  - local direct gateway URL should reach `chat_send_ok`
  - public URL may return `PAIRING_REQUIRED` until approved
- Demo validation:
  - pairing-required guidance visible
  - reset action clears local identity and shows explicit next-step notice
  - retry path succeeds after approval

## Risks
- Gateway schema drift can break proof generation quickly.
- Public deployment may enforce stricter pairing/origin policies than local loopback.
- Users can still confuse pairing approval ownership (client-side cannot self-approve).

## Success Criteria
- Local direct diagnostic succeeds with write scope.
- Public diagnostic returns classified errors deterministically (including pairing-required).
- Demo makes first-pairing + reset + retry behavior understandable without reading source code.
