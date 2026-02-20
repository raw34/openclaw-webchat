# ChatWidget Auth-Issue Component-Led Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move pairing/scope auth UX ownership into React/Vue ChatWidget so demo stays thin while users get in-chat guidance and retry actions.

**Architecture:** Keep `useOpenClawChat` API unchanged and implement auth issue normalization in both widget components from existing `error.code`. Add optional `authTexts` props with defaults in each component and render issue-specific panels in the chat area. Remove demo-side auth branching so app code only wires config and renders widget.

**Tech Stack:** TypeScript, React 18, Vue 3, Vitest, Testing Library (`@testing-library/react`), Vue Test Utils (`@vue/test-utils`), jsdom.

---

### Task 1: Add test infrastructure for React/Vue widget auth UX

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Step 1: Add missing test deps (root)**

```json
{
  "devDependencies": {
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.3",
    "@vue/test-utils": "^2.4.6",
    "jsdom": "^26.0.0"
  }
}
```

**Step 2: Install deps**

Run: `pnpm install`
Expected: lockfile updates, install succeeds.

**Step 3: Add Vitest config for jsdom + package include**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/**/src/**/*.test.ts',
      'packages/**/src/**/*.test.tsx',
    ],
    environment: 'jsdom',
  },
});
```

**Step 4: Verify baseline tests still run**

Run: `pnpm test -- --run packages/core/src/__tests__/client.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "test: add widget test infrastructure"
```

### Task 2: Implement and test React ChatWidget auth issue states

**Files:**
- Modify: `packages/react/src/components/ChatWidget.tsx`
- Create: `packages/react/src/components/__tests__/ChatWidget.auth.test.tsx`
- Modify: `packages/react/src/index.ts`

**Step 1: Write failing React tests for auth panel rendering**

```tsx
it('shows pairing required panel when error code is PAIRING_REQUIRED', async () => {
  // mock useOpenClawChat return with error.code = 'PAIRING_REQUIRED'
  // expect Pairing Required text and Retry Connection button
});

it('shows missing write scope panel when error code is SCOPE_MISSING_WRITE', async () => {
  // mock error.code = 'SCOPE_MISSING_WRITE'
  // expect scope message and retry button
});

it('uses authTexts overrides', async () => {
  // pass custom authTexts and assert custom copy appears
});
```

**Step 2: Run React test file to confirm failure**

Run: `pnpm test -- --run packages/react/src/components/__tests__/ChatWidget.auth.test.tsx`
Expected: FAIL (feature not implemented yet).

**Step 3: Add `authTexts` prop type + defaults in `ChatWidget.tsx`**

```ts
export interface ChatWidgetAuthTexts {
  pairingRequiredTitle?: string;
  pairingRequiredBody?: string;
  scopeMissingWriteTitle?: string;
  scopeMissingWriteBody?: string;
  retryConnectionButton?: string;
  retryingConnectionButton?: string;
}
```

**Step 4: Add auth issue mapping + panel rendering**

```ts
const authIssue = errorCode === 'PAIRING_REQUIRED'
  ? 'pairing_required'
  : errorCode === 'SCOPE_MISSING_WRITE'
    ? 'scope_missing_write'
    : 'none';
```

Render panel with default copy and retry action for both issue types.

**Step 5: Export new types from package index**

Update `packages/react/src/index.ts` to export `ChatWidgetAuthTexts`.

**Step 6: Run React tests and package tests**

Run: `pnpm test -- --run packages/react/src/components/__tests__/ChatWidget.auth.test.tsx`
Expected: PASS.

**Step 7: Commit**

```bash
git add packages/react/src/components/ChatWidget.tsx \
  packages/react/src/components/__tests__/ChatWidget.auth.test.tsx \
  packages/react/src/index.ts
git commit -m "feat(react): add component auth issue states and configurable copy"
```

### Task 3: Implement and test Vue ChatWidget auth issue states

**Files:**
- Modify: `packages/vue/src/components/ChatWidget.vue`
- Create: `packages/vue/src/components/__tests__/ChatWidget.auth.test.ts`
- Modify: `packages/vue/src/index.d.ts`

**Step 1: Write failing Vue tests for auth panel and copy override**

```ts
it('renders pairing required panel for PAIRING_REQUIRED');
it('renders scope missing panel for SCOPE_MISSING_WRITE');
it('renders custom authTexts copy when provided');
```

**Step 2: Run Vue test file to verify fail-first**

Run: `pnpm test -- --run packages/vue/src/components/__tests__/ChatWidget.auth.test.ts`
Expected: FAIL.

**Step 3: Add `authTexts` prop and defaults in `ChatWidget.vue`**

Define typed prop object matching React keys and default copy.

**Step 4: Add computed `authIssue` and render branch**

Use `error?.code` mapping and panel UI equivalent to React behavior.

**Step 5: Update public typings**

Add optional `authTexts` in `packages/vue/src/index.d.ts` `ChatWidgetProps`.

**Step 6: Run Vue tests**

Run: `pnpm test -- --run packages/vue/src/components/__tests__/ChatWidget.auth.test.ts`
Expected: PASS.

**Step 7: Commit**

```bash
git add packages/vue/src/components/ChatWidget.vue \
  packages/vue/src/components/__tests__/ChatWidget.auth.test.ts \
  packages/vue/src/index.d.ts
git commit -m "feat(vue): add component auth issue states and configurable copy"
```

### Task 4: Thin demo wiring + docs + full verification

**Files:**
- Modify: `apps/demo/src/react-demo.tsx`
- Modify: `apps/demo/src/vue-demo.ts`
- Modify: `packages/react/README.md`
- Modify: `packages/vue/README.md`

**Step 1: Remove demo-side auth branching**

Delete auth-state inference logic from demo files; keep only gateway/token form and `ChatWidget` render.

**Step 2: (Optional) pass copy override example from demo**

Keep demo minimal; if override shown, only pass static `authTexts` prop.

**Step 3: Document new `authTexts` prop**

Add prop sections in both READMEs with defaults and usage snippet.

**Step 4: Run full checks**

Run:
- `pnpm lint`
- `pnpm test -- --run`
- `pnpm build`

Expected: all PASS.

**Step 5: Commit**

```bash
git add apps/demo/src/react-demo.tsx apps/demo/src/vue-demo.ts \
  packages/react/README.md packages/vue/README.md
git commit -m "refactor(demo): keep demo thin and document widget authTexts"
```

### Task 5: Final review commit and PR update

**Files:**
- Modify: `docs/plans/2026-02-20-chatwidget-auth-issue-component-led-design.md` (if needed for implementation notes)

**Step 1: Validate no sensitive info leakage**

Run: `rg -n "raw34\.xyz|GATEWAY_AUTH_TOKEN|token=" docs apps packages -S`
Expected: no sensitive runtime values committed.

**Step 2: Review changeset coherence**

Run: `git log --oneline -n 5` and `git diff --name-only origin/feat/device-auth-strict-adaptation...HEAD`
Expected: only intended files.

**Step 3: Push and update PR summary**

Run:
- `git push origin feat/device-auth-strict-adaptation`
- update PR body with behavior change and test evidence.

**Step 4: Commit (if plan/doc tweak needed)**

```bash
git add docs/plans/2026-02-20-chatwidget-auth-issue-component-led-design.md
git commit -m "docs(plans): sync design notes after implementation"
```

## Skill References

- `@superpowers:executing-plans` for task-by-task implementation handoff.
- `@superpowers:brainstorming` already completed for design validation.
