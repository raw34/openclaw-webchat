# Design: Vue ChatWidget, Unit Tests, and Demo App

**Date**: 2026-02-14
**Status**: Approved

## Overview

This document describes the design for three features:
1. Vue ChatWidget component
2. Unit tests for core package
3. Demo application for testing

## Implementation Order

Serial development approach:
```
Vue ChatWidget → Unit Tests → Demo App → Real Gateway Testing
```

---

## 1. Vue ChatWidget Component

**Location**: `packages/vue/src/components/ChatWidget.vue`

### Props

```typescript
interface ChatWidgetProps extends OpenClawClientOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'inline'
  theme?: 'light' | 'dark' | 'auto'
  title?: string
  placeholder?: string
  defaultOpen?: boolean
}
```

### Design Decisions

- Use `<script setup>` + Composition API
- Same styles and theme colors as React version (light/dark)
- Expose `send` and `message` events via `defineEmits`
- Reuse existing `useOpenClawChat` composable
- Use Vue slots (`#message`, `#loading`) instead of render props

### Differences from React

| Feature | React | Vue |
|---------|-------|-----|
| Custom message rendering | `renderMessage` prop | `#message` slot |
| Custom loading rendering | `renderLoading` prop | `#loading` slot |

---

## 2. Unit Tests

**Framework**: Vitest (already in devDependencies)

**Location**: `packages/core/src/__tests__/client.test.ts`

### Test Cases

| Test Case | Description |
|-----------|-------------|
| Connection success | Mock WebSocket, verify handshake (challenge → connect → hello-ok) |
| Connection failure | Verify timeout and auth error handling |
| Send message | Verify `send()` constructs correct request frame |
| Receive message | Verify `message` event fires correctly |
| Streaming response | Verify `streamStart` / `streamChunk` / `streamEnd` events |
| Auto reconnect | Verify reconnection based on config |
| Manual disconnect | Verify `disconnect()` prevents reconnection |

### Mock Strategy

- Create `MockWebSocket` class to simulate WebSocket behavior
- Controllable: connection delay, server responses, disconnect timing

**Estimated code**: ~200-300 lines

---

## 3. Demo Application

**Location**: `apps/demo/`

### Tech Stack

- Vite 5 + TypeScript
- React 18 + Vue 3 (same project)
- `@vitejs/plugin-react` and `@vitejs/plugin-vue`

### File Structure

```
apps/demo/
├── index.html          # Entry, links to both demos
├── react.html          # React demo entry
├── vue.html            # Vue demo entry
├── src/
│   ├── react-demo.tsx  # React ChatWidget demo
│   ├── vue-demo.ts     # Vue ChatWidget demo
│   └── style.css       # Shared styles (layout)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### Features

- Home page: Simple navigation to React / Vue demos
- Demo pages: Display ChatWidget, configurable Gateway URL and Token
- Config via URL params or input fields (for easy testing)

### Usage

```bash
cd apps/demo
pnpm install
pnpm dev
# Visit http://localhost:5173
```

---

## Success Criteria

1. Vue ChatWidget renders and functions identically to React version
2. All unit tests pass with mocked WebSocket
3. Demo app successfully connects to real Gateway and exchanges messages
