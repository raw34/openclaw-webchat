# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Embeddable WebChat SDK for OpenClaw Gateway - provides React and Vue components/hooks for building AI chat interfaces that connect via WebSocket.

## Commands

```bash
# Development
pnpm install           # Install dependencies
pnpm dev               # Run all packages in dev mode (parallel watch)
pnpm build             # Build all packages

# Testing
pnpm test              # Run all tests (vitest)
pnpm test -- --watch   # Watch mode
pnpm test -- packages/core  # Single package

# Linting
pnpm lint              # Lint all packages

# Demo app
cd apps/demo && pnpm dev  # Run demo with React/Vue examples
```

## Architecture

### Monorepo Structure (pnpm workspace)

```
packages/
├── core/     # openclaw-webchat - Framework-agnostic WebSocket client
├── react/    # openclaw-webchat-react - React hooks + ChatWidget
└── vue/      # openclaw-webchat-vue - Vue composables + ChatWidget
apps/
└── demo/     # Vite dev server with React/Vue demos
```

### Package Hierarchy

- **core**: `OpenClawClient` class - handles WebSocket connection, authentication handshake, message streaming, reconnection
- **react**: Depends on core. Exports `useOpenClawChat` hook and `ChatWidget` component
- **vue**: Depends on core. Exports `useOpenClawChat` composable and `ChatWidget` component

### Core Client (`packages/core/src/client.ts`)

Key concepts:
- Uses OpenClaw Gateway WebSocket protocol (connect challenge → hello response)
- Event emitter pattern: `client.on('message'|'streamChunk'|'connected'|etc)`
- Streaming support: chunks arrive via `streamChunk` events, final message via `message`
- Auto-reconnect with configurable attempts/interval

### React/Vue Wrappers

Both follow the same pattern:
- Hook/composable wraps `OpenClawClient`, manages state (messages, connectionState, isLoading, streamingContent)
- ChatWidget is a drop-in component with position modes: `inline`, `bottom-right`, `bottom-left`, `top-right`, `top-left`
- Vue requires CSS import: `import 'openclaw-webchat-vue/style.css'`

### Protocol Types (`packages/core/src/types.ts`)

Frame types: `req` (request), `res` (response), `event`
Key interfaces: `Message`, `OpenClawClientOptions`, `OpenClawClientEvents`

## Build System

- **tsup** for all package builds (outputs ESM + CJS + .d.ts)
- **vite** for demo app
- Each package has independent `tsup.config.ts`

## Testing

Tests use vitest with a `MockWebSocket` helper (`packages/core/src/__tests__/MockWebSocket.ts`) for simulating WebSocket behavior.
