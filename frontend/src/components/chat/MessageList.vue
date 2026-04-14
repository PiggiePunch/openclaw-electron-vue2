<template>
  <div ref="containerRef" class="message-list">
    <div v-if="loading" class="message-list-loading">
      <div class="spinner"></div>
      <div>加载消息中...</div>
    </div>

    <div v-else-if="messages.length === 0" class="message-list-empty">
      <p>暂无消息</p>
    </div>

    <div v-else class="message-list-content">
      <MessageItem
        v-for="message in messages"
        :key="message.id"
        :message="message"
        :is-streaming="message.id === streamingMessageId"
      />

      <!-- 思考指示器 -->
      <div v-if="showThinking" class="thinking-indicator">
        <div class="thinking-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span>AI 正在思考...</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from 'vue'
import type { Message } from '@/types'
import MessageItem from './MessageItem.vue'

export default {
  name: 'MessageList',

  components: {
    MessageItem
  },

  props: {
    messages: {
      type: Array as PropType<Message[]>,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    thinkingMessageId: {
      type: String as PropType<string | null>,
      default: null
    },
    streamingMessageId: {
      type: String as PropType<string | null>,
      default: null
    }
  },

  data() {
    return {
      previousMessageCount: 0
    }
  },

  computed: {
    showThinking(): boolean {
      return !!this.thinkingMessageId
    },

    isUserScrolledUp(): boolean {
      const containerRef = this.$refs.containerRef as HTMLElement
      if (!containerRef) return false
      const threshold = 150
      return containerRef.scrollHeight - containerRef.scrollTop - containerRef.clientHeight > threshold
    }
  },

  methods: {
    scrollToBottom(force = false) {
      this.$nextTick(() => {
        const containerRef = this.$refs.containerRef as HTMLElement
        if (containerRef) {
          // force=true时强制滚动（新消息、流式状态变化等）
          // force=false时，只在用户没有向上滚动时才滚动
          if (force || !this.isUserScrolledUp) {
            containerRef.scrollTop = containerRef.scrollHeight
          }
        }
      })
    }
  },

  watch: {
    messages(newMessages: Message[], oldMessages: Message[]) {
      const currentCount = newMessages.length
      const previousCount = this.previousMessageCount

      // 消息数量增加（新消息），强制滚动
      if (currentCount > previousCount) {
        console.log('📜 New message added, forcing scroll to bottom')
        this.scrollToBottom(true)
      } else if (currentCount === previousCount && this.streamingMessageId) {
        // 消息数量未变但有流式消息，说明是内容更新
        // 只在用户没有向上滚动时滚动
        console.log('📜 Streaming content update, conditional scroll')
        this.scrollToBottom(false)
      }

      this.previousMessageCount = currentCount
    },

    streamingMessageId() {
      this.scrollToBottom()
    },

    thinkingMessageId() {
      this.scrollToBottom()
    }
  }
}
</script>

<style scoped>
.message-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
}

.message-list-loading,
.message-list-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: hsl(var(--muted-foreground));
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid hsl(var(--muted) / 0.3);
  border-top-color: hsl(var(--primary));
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.message-list-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0.5rem 0;
  align-items: flex-start; /* 确保所有子元素左对齐 */
}

.thinking-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background: hsl(var(--muted) / 0.3);
  border-radius: calc(var(--radius) - 2px);
  margin-bottom: 0.5rem;
}

.thinking-dots {
  display: flex;
  gap: 0.25rem;
}

.thinking-dots span {
  width: 8px;
  height: 8px;
  background: hsl(var(--primary));
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}

.thinking-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.thinking-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}
</style>
