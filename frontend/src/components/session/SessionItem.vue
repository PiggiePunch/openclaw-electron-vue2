<template>
  <div
    class="session-detail"
    :class="{ active }"
    @click="handleClick"
  >
    <div class="session-detail-header">
      <div>
        <div class="session-detail-title">{{ displayTitle }}</div>
        <div class="session-detail-key">{{ messagePreview }}</div>
      </div>
      <div class="session-detail-arrow">→</div>
    </div>
    <div class="session-detail-info">
      <span>创建时间: {{ formattedCreatedAt }}</span>
      <span> | </span>
      <span>消息数: {{ messageCount }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from 'vue'
import type { Session } from '@/types'

export default {
  name: 'SessionItem',

  props: {
    session: {
      type: Object as PropType<Session>,
      required: true
    },
    active: {
      type: Boolean,
      default: false
    }
  },

  computed: {
    displayTitle(): string {
      return this.session.label || this.session.key
    },

    messagePreview(): string {
      const count = this.session.messageCount || 0
      if (this.session.lastMessage && count > 0) {
        const preview = this.session.lastMessage.substring(0, 60)
        return this.session.lastMessage.length > 60
          ? preview + '...'
          : preview
      }
      return '暂无消息'
    },

    formattedCreatedAt(): string {
      if (this.session.createdAt) {
        return this.formatDate(this.session.createdAt)
      }
      return '未知'
    },

    messageCount(): number {
      return this.session.messageCount || 0
    }
  },

  methods: {
    handleClick() {
      this.$emit('click')
    },

    formatDate(timestamp: number): string {
      if (!timestamp) return '未知'
      const date = new Date(timestamp)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }
}
</script>

<style scoped>
.session-detail {
  cursor: pointer;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid hsl(var(--border) / 0.3);
  transition: background-color 0.15s ease;
}

.session-detail:hover {
  background: hsl(var(--sidebar-hover));
}

.session-detail.active {
  background: hsl(var(--sidebar-active));
}

.session-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 0.5rem;
}

.session-detail-title {
  font-weight: 500;
  color: hsl(var(--foreground));
  margin-bottom: 0.25rem;
}

.session-detail-key {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
}

.session-detail-arrow {
  font-size: 1.25rem;
  color: hsl(var(--muted-foreground));
  opacity: 0.5;
}

.session-detail-info {
  font-size: 0.75rem;
  color: hsl(var(--muted-foreground));
  display: flex;
  gap: 0.5rem;
}
</style>
