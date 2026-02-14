# OpenClaw WebChat SDK

[![npm version](https://img.shields.io/npm/v/@raw34/openclaw-webchat.svg)](https://www.npmjs.com/package/@raw34/openclaw-webchat)
[![npm downloads](https://img.shields.io/npm/dm/@raw34/openclaw-webchat.svg)](https://www.npmjs.com/package/@raw34/openclaw-webchat)
[![license](https://img.shields.io/npm/l/@raw34/openclaw-webchat.svg)](https://github.com/raw34/openclaw-webchat/blob/main/LICENSE)
[![CI](https://github.com/raw34/openclaw-webchat/actions/workflows/ci.yml/badge.svg)](https://github.com/raw34/openclaw-webchat/actions/workflows/ci.yml)

[English](./README.md)

可嵌入式 WebChat SDK，用于连接 [OpenClaw](https://openclaw.ai) Gateway。为你的应用快速构建 AI 聊天界面。

## 效果展示

| React | Vue |
|-------|-----|
| ![React Demo](./docs/images/demo-react-light.png) | ![Vue Demo](./docs/images/demo-vue-light.png) |

## 特性

- **开箱即用** - 提供 React 和 Vue 的 ChatWidget 组件，一行代码接入
- **流式响应** - 支持 AI 回复的实时流式输出
- **高度可定制** - 提供 Hooks/Composables，方便构建自定义 UI
- **主题切换** - 支持亮色、暗色和自动主题模式
- **灵活定位** - 支持浮动窗口或内嵌模式
- **自动重连** - 断线自动重连，保证连接稳定性
- **TypeScript** - 完整的 TypeScript 类型支持
- **轻量级** - 依赖少，支持 Tree Shaking

## 包列表

| 包名 | 版本 | 说明 |
|------|------|------|
| [`@raw34/openclaw-webchat`](./packages/core) | [![npm](https://img.shields.io/npm/v/@raw34/openclaw-webchat.svg)](https://www.npmjs.com/package/@raw34/openclaw-webchat) | 核心 WebSocket 客户端（框架无关） |
| [`@raw34/openclaw-webchat-react`](./packages/react) | [![npm](https://img.shields.io/npm/v/@raw34/openclaw-webchat-react.svg)](https://www.npmjs.com/package/@raw34/openclaw-webchat-react) | React Hooks 和组件 |
| [`@raw34/openclaw-webchat-vue`](./packages/vue) | [![npm](https://img.shields.io/npm/v/@raw34/openclaw-webchat-vue.svg)](https://www.npmjs.com/package/@raw34/openclaw-webchat-vue) | Vue Composables 和组件 |

## 快速开始

### React

```bash
npm install @raw34/openclaw-webchat-react
```

```tsx
import { ChatWidget } from '@raw34/openclaw-webchat-react';

function App() {
  return (
    <ChatWidget
      gateway="wss://ai.example.com:18789"
      token="your-token"
      position="bottom-right"
      theme="light"
      title="AI 助手"
    />
  );
}
```

使用 Hook 自定义 UI：

```tsx
import { useOpenClawChat } from '@raw34/openclaw-webchat-react';

function CustomChat() {
  const { messages, isConnected, isLoading, streamingContent, send } = useOpenClawChat({
    gateway: 'wss://ai.example.com:18789',
    token: 'your-token',
  });

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.role}: {msg.content}
        </div>
      ))}
      {isLoading && <div>AI 正在输入: {streamingContent}</div>}
      <input
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            send(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
        disabled={!isConnected}
      />
    </div>
  );
}
```

### Vue

```bash
npm install @raw34/openclaw-webchat-vue
```

```vue
<script setup>
import { ChatWidget } from '@raw34/openclaw-webchat-vue';
import '@raw34/openclaw-webchat-vue/style.css';  // 必须引入样式
</script>

<template>
  <ChatWidget
    gateway="wss://ai.example.com:18789"
    token="your-token"
    position="bottom-right"
    theme="light"
    title="AI 助手"
  />
</template>
```

使用 Composable 自定义 UI：

```vue
<script setup>
import { ref } from 'vue';
import { useOpenClawChat } from '@raw34/openclaw-webchat-vue';

const { messages, isConnected, isLoading, streamingContent, send } = useOpenClawChat({
  gateway: 'wss://ai.example.com:18789',
  token: 'your-token',
});

const input = ref('');

function handleSend() {
  if (input.value.trim()) {
    send(input.value);
    input.value = '';
  }
}
</script>

<template>
  <div>
    <div v-for="msg in messages" :key="msg.id">{{ msg.role }}: {{ msg.content }}</div>
    <div v-if="isLoading">AI 正在输入: {{ streamingContent }}</div>
    <input v-model="input" @keydown.enter="handleSend" :disabled="!isConnected" />
  </div>
</template>
```

### Core（原生 JS / 任意框架）

```bash
npm install @raw34/openclaw-webchat
```

```typescript
import { OpenClawClient } from '@raw34/openclaw-webchat';

const client = new OpenClawClient({
  gateway: 'wss://ai.example.com:18789',
  token: 'your-token',
});

client.on('message', (msg) => {
  console.log('AI:', msg.content);
});

client.on('streamChunk', (id, chunk) => {
  process.stdout.write(chunk);
});

await client.connect();
await client.send('你好，AI！');
```

## API 参考

### OpenClawClient 配置项

```typescript
interface OpenClawClientOptions {
  gateway: string;              // WebSocket 地址
  token?: string;               // 认证令牌
  password?: string;            // 认证密码（可选方式）
  deviceToken?: string;         // 设备令牌（用于持久会话）
  reconnect?: boolean;          // 自动重连（默认: true）
  reconnectInterval?: number;   // 重连间隔，单位毫秒（默认: 3000）
  maxReconnectAttempts?: number; // 最大重连次数（默认: 10，-1 为无限）
  connectionTimeout?: number;   // 连接超时，单位毫秒（默认: 10000）
  debug?: boolean;              // 调试日志（默认: false）
}
```

### 客户端方法

```typescript
// 连接管理
await client.connect();       // 连接到网关
client.disconnect();          // 断开连接
client.isConnected;           // boolean - 是否已连接
client.connectionState;       // 'disconnected' | 'connecting' | 'connected' | ...

// 聊天
await client.send(content);                  // 发送消息
const history = await client.getHistory(50); // 获取历史记录
await client.inject(content, role);          // 注入消息

// 事件监听
client.on('connected', () => {});                    // 连接成功
client.on('disconnected', (reason) => {});           // 断开连接
client.on('message', (msg) => {});                   // 收到完整消息
client.on('streamStart', (messageId) => {});         // 开始流式响应
client.on('streamChunk', (messageId, chunk) => {});  // 收到流式片段
client.on('streamEnd', (messageId) => {});           // 流式响应结束
client.on('error', (error) => {});                   // 发生错误
```

## 本地开发

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 开发模式
pnpm dev

# 运行测试
pnpm test
```

## 参与贡献

欢迎提交 Pull Request！

## 开源协议

[MIT](./LICENSE)
