# ChatWidget Session Isolation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ensure WebChat sessions are isolated by default so browser chat does not mix with Telegram/other channels.

**Architecture:** Add component-level session key resolver in React/Vue ChatWidget. If `sessionKey` is provided, use it; otherwise derive a persistent browser-local key from `localStorage`. Keep demo thin and unchanged in business behavior.

**Tech Stack:** TypeScript, React 18, Vue 3, Vitest.

---

### Task 1: Add shared session key resolver utility in React package

**Files:**
- Create: `packages/react/src/components/sessionKey.ts`
- Modify: `packages/react/src/components/ChatWidget.tsx`

**Step 1: Write utility for browser-local stable key**

Implement helper:
- storage key constant, e.g. `openclaw-webchat:session-stable-id`
- `getOrCreateStableSessionKey(prefix = 'webchat')`
- uses `crypto.getRandomValues` fallback to `Math.random`
- returns `webchat:<stableId>`

**Step 2: Wire into ChatWidget options**

Before calling `useOpenClawChat`, resolve session key:
- if `props.sessionKey` exists: keep it
- else set resolved `sessionKey` to generated stable key

**Step 3: Validate types/build for react package**

Run: `pnpm --filter openclaw-webchat-react build`
Expected: PASS.

**Step 4: Commit**

```bash
git add packages/react/src/components/sessionKey.ts packages/react/src/components/ChatWidget.tsx
git commit -m "feat(react): default to isolated browser session key"
```

### Task 2: Add shared session key resolver utility in Vue package

**Files:**
- Create: `packages/vue/src/components/sessionKey.ts`
- Modify: `packages/vue/src/components/ChatWidget.vue`

**Step 1: Write Vue-side utility matching React behavior**

Implement same storage key and generation strategy.

**Step 2: Apply resolved session key in ChatWidget.vue**

When constructing client options:
- use explicit `props.sessionKey` if provided
- otherwise include resolved stable session key

**Step 3: Validate types/build for vue package**

Run: `pnpm --filter openclaw-webchat-vue build`
Expected: PASS.

**Step 4: Commit**

```bash
git add packages/vue/src/components/sessionKey.ts packages/vue/src/components/ChatWidget.vue
git commit -m "feat(vue): default to isolated browser session key"
```

### Task 3: Add tests for session isolation behavior

**Files:**
- Create: `packages/react/src/components/__tests__/ChatWidget.sessionKey.test.tsx`
- Create: `packages/vue/src/components/__tests__/ChatWidget.sessionKey.test.ts`

**Step 1: React tests**

Cover:
- no prop `sessionKey` => hook receives generated `webchat:<id>`
- with prop `sessionKey` => hook receives explicit value unchanged

**Step 2: Vue tests**

Cover same two assertions for composable call params.

**Step 3: Run targeted tests**

Run:
- `pnpm test -- --run packages/react/src/components/__tests__/ChatWidget.sessionKey.test.tsx`
- `pnpm test -- --run packages/vue/src/components/__tests__/ChatWidget.sessionKey.test.ts`
Expected: PASS.

**Step 4: Commit**

```bash
git add packages/react/src/components/__tests__/ChatWidget.sessionKey.test.tsx \
  packages/vue/src/components/__tests__/ChatWidget.sessionKey.test.ts
git commit -m "test(widget): cover default isolated session key behavior"
```

### Task 4: Documentation and full verification

**Files:**
- Modify: `packages/react/README.md`
- Modify: `packages/vue/README.md`

**Step 1: Document default session behavior**

Add note under ChatWidget props:
- default uses isolated browser-local session key
- pass `sessionKey` to intentionally share/override

**Step 2: Run workspace checks**

Run:
- `pnpm lint`
- `pnpm test -- --run`
- `pnpm build`
Expected: all PASS.

**Step 3: Commit**

```bash
git add packages/react/README.md packages/vue/README.md
git commit -m "docs(widget): document default session isolation behavior"
```

### Task 5: Push and verification guidance

**Step 1: Push branch**

Run: `git push origin feat/device-auth-strict-adaptation`

**Step 2: Provide user verification checklist**

- same browser reload keeps conversation
- different browser has separate conversation
- telegram/webchat no cross-reply mixing

## Skill References

- `@superpowers:executing-plans`
- `@superpowers:brainstorming`
