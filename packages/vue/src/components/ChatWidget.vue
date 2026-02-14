<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { OpenClawClientOptions, Message } from '@openclaw/chat-core';
import { useOpenClawChat } from '../composables/useOpenClawChat';

export interface ChatWidgetProps extends /* @vue-ignore */ OpenClawClientOptions {
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'inline';
  theme?: 'light' | 'dark' | 'auto';
  title?: string;
  placeholder?: string;
  defaultOpen?: boolean;
}

const props = withDefaults(defineProps<ChatWidgetProps>(), {
  position: 'bottom-right',
  theme: 'light',
  title: 'AI Assistant',
  placeholder: 'Type a message...',
  defaultOpen: false,
});

const emit = defineEmits<{
  send: [content: string];
  message: [message: Message];
}>();

defineSlots<{
  message?: (props: { message: Message }) => unknown;
  loading?: (props: { content: string }) => unknown;
}>();

const isOpen = ref(props.defaultOpen);
const input = ref('');
const messagesEndRef = ref<HTMLDivElement | null>(null);

const {
  messages,
  isConnected,
  isLoading,
  streamingContent,
  error,
  send: clientSend,
} = useOpenClawChat(props);

const themes = {
  light: {
    bg: '#ffffff',
    headerBg: '#f8f9fa',
    headerBorder: '#e9ecef',
    userBg: '#007bff',
    userColor: '#ffffff',
    aiBg: '#f1f3f4',
    aiColor: '#1a1a1a',
    inputBg: '#ffffff',
    inputBorder: '#dee2e6',
    buttonBg: '#007bff',
    buttonColor: '#ffffff',
  },
  dark: {
    bg: '#1a1a1a',
    headerBg: '#2d2d2d',
    headerBorder: '#404040',
    userBg: '#0066cc',
    userColor: '#ffffff',
    aiBg: '#2d2d2d',
    aiColor: '#ffffff',
    inputBg: '#2d2d2d',
    inputBorder: '#404040',
    buttonBg: '#0066cc',
    buttonColor: '#ffffff',
  },
};

const resolvedTheme = computed(() => {
  if (props.theme === 'auto') {
    return typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return props.theme;
});

const colors = computed(() => themes[resolvedTheme.value]);

const positionStyles = computed(() => {
  const positions = {
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-right': { top: '20px', right: '20px' },
    'top-left': { top: '20px', left: '20px' },
    inline: {},
  };
  return positions[props.position];
});

watch(
  [messages, streamingContent],
  () => {
    nextTick(() => {
      messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
    });
  },
  { deep: true }
);

watch(
  () => messages.value.length,
  (newLen, oldLen) => {
    if (newLen > oldLen) {
      emit('message', messages.value[newLen - 1]);
    }
  }
);

async function handleSend() {
  if (!input.value.trim() || !isConnected.value || isLoading.value) return;

  const content = input.value.trim();
  input.value = '';
  emit('send', content);

  try {
    await clientSend(content);
  } catch (err) {
    console.error('Failed to send message:', err);
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}
</script>

<template>
  <!-- Inline mode -->
  <div
    v-if="position === 'inline'"
    class="openclaw-widget"
    :style="{ backgroundColor: colors.bg }"
  >
    <div class="openclaw-messages">
      <template v-for="msg in messages" :key="msg.id">
        <slot name="message" :message="msg">
          <div
            class="openclaw-message"
            :style="{
              backgroundColor: msg.role === 'user' ? colors.userBg : colors.aiBg,
              color: msg.role === 'user' ? colors.userColor : colors.aiColor,
              marginLeft: msg.role === 'user' ? 'auto' : '0',
              marginRight: msg.role === 'user' ? '0' : 'auto',
            }"
          >
            {{ msg.content }}
          </div>
        </slot>
      </template>
      <template v-if="isLoading">
        <slot name="loading" :content="streamingContent">
          <div
            class="openclaw-message"
            :style="{
              backgroundColor: colors.aiBg,
              color: colors.aiColor,
              opacity: 0.8,
            }"
          >
            {{ streamingContent || '...' }}
          </div>
        </slot>
      </template>
      <div v-if="error" class="openclaw-error">
        Error: {{ error.message }}
      </div>
      <div ref="messagesEndRef" />
    </div>
    <div class="openclaw-input" :style="{ borderColor: colors.headerBorder }">
      <input
        type="text"
        v-model="input"
        @keydown="handleKeyDown"
        :placeholder="isConnected ? placeholder : 'Connecting...'"
        :disabled="!isConnected || isLoading"
        :style="{
          backgroundColor: colors.inputBg,
          borderColor: colors.inputBorder,
          color: colors.aiColor,
        }"
      />
      <button
        @click="handleSend"
        :disabled="!isConnected || isLoading || !input.trim()"
        :style="{
          backgroundColor: colors.buttonBg,
          color: colors.buttonColor,
          opacity: !isConnected || isLoading || !input.trim() ? 0.5 : 1,
        }"
      >
        Send
      </button>
    </div>
  </div>

  <!-- Floating mode -->
  <div
    v-else
    class="openclaw-container"
    :style="positionStyles"
  >
    <div
      v-if="isOpen"
      class="openclaw-widget"
      :style="{ backgroundColor: colors.bg }"
    >
      <div
        class="openclaw-header"
        :style="{
          backgroundColor: colors.headerBg,
          borderColor: colors.headerBorder,
        }"
      >
        <span>{{ title }}</span>
        <button
          @click="isOpen = false"
          class="openclaw-close"
          :style="{ color: colors.aiColor }"
        >
          ×
        </button>
      </div>
      <div class="openclaw-messages">
        <template v-for="msg in messages" :key="msg.id">
          <slot name="message" :message="msg">
            <div
              class="openclaw-message"
              :style="{
                backgroundColor: msg.role === 'user' ? colors.userBg : colors.aiBg,
                color: msg.role === 'user' ? colors.userColor : colors.aiColor,
                marginLeft: msg.role === 'user' ? 'auto' : '0',
                marginRight: msg.role === 'user' ? '0' : 'auto',
              }"
            >
              {{ msg.content }}
            </div>
          </slot>
        </template>
        <template v-if="isLoading">
          <slot name="loading" :content="streamingContent">
            <div
              class="openclaw-message"
              :style="{
                backgroundColor: colors.aiBg,
                color: colors.aiColor,
                opacity: 0.8,
              }"
            >
              {{ streamingContent || '...' }}
            </div>
          </slot>
        </template>
        <div v-if="error" class="openclaw-error">
          Error: {{ error.message }}
        </div>
        <div ref="messagesEndRef" />
      </div>
      <div class="openclaw-input" :style="{ borderColor: colors.headerBorder }">
        <input
          type="text"
          v-model="input"
          @keydown="handleKeyDown"
          :placeholder="isConnected ? placeholder : 'Connecting...'"
          :disabled="!isConnected || isLoading"
          :style="{
            backgroundColor: colors.inputBg,
            borderColor: colors.inputBorder,
            color: colors.aiColor,
          }"
        />
        <button
          @click="handleSend"
          :disabled="!isConnected || isLoading || !input.trim()"
          :style="{
            backgroundColor: colors.buttonBg,
            color: colors.buttonColor,
            opacity: !isConnected || isLoading || !input.trim() ? 0.5 : 1,
          }"
        >
          Send
        </button>
      </div>
    </div>
    <button
      v-else
      @click="isOpen = true"
      class="openclaw-toggle"
      :style="{
        backgroundColor: colors.buttonBg,
        color: colors.buttonColor,
      }"
    >
      💬
    </button>
  </div>
</template>

<style scoped>
.openclaw-container {
  position: fixed;
  z-index: 9999;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.openclaw-widget {
  width: 380px;
  height: 500px;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.openclaw-header {
  padding: 16px 20px;
  font-weight: 600;
  font-size: 16px;
  border-bottom: 1px solid;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.openclaw-close {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 20px;
}

.openclaw-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.openclaw-message {
  margin-bottom: 12px;
  padding: 10px 14px;
  border-radius: 12px;
  max-width: 80%;
  word-break: break-word;
}

.openclaw-error {
  color: #dc3545;
  padding: 8px 12px;
  font-size: 14px;
}

.openclaw-input {
  display: flex;
  padding: 12px;
  border-top: 1px solid;
  gap: 8px;
}

.openclaw-input input {
  flex: 1;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid;
  font-size: 14px;
  outline: none;
}

.openclaw-input button {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.openclaw-toggle {
  width: 56px;
  height: 56px;
  border-radius: 28px;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
}
</style>
