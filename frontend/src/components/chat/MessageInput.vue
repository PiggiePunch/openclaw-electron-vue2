<template>
  <div class="message-input-container">
    <div class="relative">
      <textarea
        ref="textareaRef"
        v-model="messageText"
        class="textarea pr-16"
        :placeholder="placeholder"
        rows="3"
        :disabled="disabled || isSending"
        @input="handleInput"
        @keydown="handleKeydown"
      ></textarea>
      <button
        v-if="!isSending"
        class="btn btn-primary absolute bottom-3 right-3"
        :disabled="!canSend"
        @click="handleSend"
      >
        发送
      </button>
      <button
        v-else
        class="btn btn-stop absolute bottom-3 right-3"
        :disabled="!canAbort"
        @click="handleAbort"
        title="停止生成"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
        <span class="ml-1">停止</span>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from 'vue'

export default {
  name: 'MessageInput',

  props: {
    disabled: {
      type: Boolean as PropType<boolean>,
      default: true
    },
    placeholder: {
      type: String as PropType<string>,
      default: '选择或创建一个会话后开始聊天 (Ctrl+Enter 发送)'
    },
    canAbort: {
      type: Boolean as PropType<boolean>,
      default: false
    },
    isSending: {
      type: Boolean as PropType<boolean>,
      default: false
    }
  },

  data() {
    return {
      messageText: ''
    }
  },

  computed: {
    canSend(): boolean {
      return !this.disabled && !this.isSending && this.messageText.trim().length > 0
    }
  },

  methods: {
    handleInput() {
      // 自动调整高度
      const textareaRef = this.$refs.textareaRef as HTMLTextAreaElement
      if (textareaRef) {
        textareaRef.style.height = 'auto'
        textareaRef.style.height = textareaRef.scrollHeight + 'px'
      }
    },

    handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        this.handleSend()
      }
    },

    handleSend() {
      if (!this.canSend) return

      const message = this.messageText.trim()
      if (message) {
        this.$emit('send', message)
        this.messageText = ''

        // 重置高度
        const textareaRef = this.$refs.textareaRef as HTMLTextAreaElement
        if (textareaRef) {
          textareaRef.style.height = 'auto'
        }
      }
    },

    handleAbort() {
      console.log('🛑 MessageInput handleAbort called')
      console.log('   - canAbort:', this.canAbort)
      console.log('   - isSending:', this.isSending)
      if (!this.canAbort) {
        console.log('   ❌ Abort blocked: canAbort is false')
        return
      }
      console.log('   ✅ Emitting abort event')
      this.$emit('abort')
    },

    focus() {
      this.$nextTick(() => {
        const textareaRef = this.$refs.textareaRef as HTMLTextAreaElement
        textareaRef?.focus()
      })
    }
  },

  watch: {
    disabled(newVal: boolean, oldVal: boolean) {
      if (oldVal && !newVal) {
        this.focus()
      }
    }
  }
}
</script>

<style scoped>
.message-input-container {
  padding: 1rem 1.25rem;
  background: hsl(var(--background));
  border-top: 1px solid hsl(var(--border));
}

.textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid hsl(var(--input));
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  line-height: 1.25rem;
  resize: none;
  font-family: inherit;
  min-height: 76px;
  max-height: 200px;
  overflow-y: auto;
}

.textarea:focus {
  outline: none;
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
}

.textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.textarea::placeholder {
  color: hsl(var(--muted-foreground));
}

.btn-stop {
  width: auto;
  min-width: 70px;
  height: 32px;
  padding: 0.8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--destructive));
  color: white;
  border: none;
  border-radius: calc(var(--radius) - 2px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-stop:hover:not(:disabled) {
  background: hsl(var(--destructive) / 0.8);
  transform: scale(1.05);
}

.btn-stop:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
