# Repository Guidelines

## Project Structure & Module Organization
This repository is a `pnpm` monorepo for the OpenClaw WebChat SDK.
- `packages/core`: framework-agnostic WebSocket client (`OpenClawClient`).
- `packages/react`: React hooks/components (for example `ChatWidget.tsx`, `useOpenClawChat.ts`).
- `packages/vue`: Vue composables/components (for example `ChatWidget.vue`, `useOpenClawChat.ts`).
- `apps/demo`: Vite demo app used for manual validation.
- `docs/`: docs assets and planning docs.
- `scripts/`: release/version scripts (for example `check-versions.js`).

## Build, Test, and Development Commands
Use Node `>=22` and `pnpm@9`.
- `pnpm install`: install workspace dependencies.
- `pnpm build`: build all packages via `pnpm -r build`.
- `pnpm dev`: run package and demo dev tasks in parallel.
- `pnpm test`: run unit tests with Vitest.
- `pnpm lint`: lint source under `packages/*/src` with ESLint.
- `pnpm version:check`: verify package version consistency before release.

## Coding Style & Naming Conventions
TypeScript-first with strict compiler settings (`strict`, `noUnusedLocals`, `noUnusedParameters`).
- Indentation: 2 spaces.
- File naming: components in PascalCase (for example `ChatWidget.tsx`, `ChatWidget.vue`), composables/hooks in camelCase starting with `use` (for example `useOpenClawChat.ts`).
- Keep public exports centralized in each package `src/index.ts`.
- Run `pnpm lint` before opening a PR.

## Testing Guidelines
- Framework: Vitest.
- Current tests live in `packages/core/src/__tests__`.
- Test files should use `*.test.ts` naming (for example `client.test.ts`).
- Add or update tests for behavioral changes in client logic, connection state, and protocol handling.
- Run `pnpm test` locally and ensure all tests pass before pushing.

## Commit & Pull Request Guidelines
Follow Conventional Commit style seen in history:
- Examples: `feat(demo): ...`, `fix(vue): ...`, `ci: ...`, `chore(release): ...`.
- Keep subject lines imperative and scoped when useful.

For PRs:
- Provide a concise summary, changed packages, and testing notes.
- Link related issues.
- Include screenshots/GIFs for UI/demo changes (`apps/demo`).
- Ensure CI passes (`build`, `version:check`, `test`).
