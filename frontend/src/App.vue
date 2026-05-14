<template>
  <div id="app" class="h-screen flex flex-col pt-9">
    <!-- Title Bar -->
    <TitleBar />

    <!-- Main App Panel -->
    <div id="app-panel" class="h-full flex flex-col">
      <div class="flex h-full overflow-hidden">
        <!-- Sidebar -->
        <div
          id="sidebar"
          class="sidebar"
          :style="{ width: `${sidebarWidth}px` }"
        >
          <!-- Resizer handle -->
          <div
            class="resizer"
            title="Drag to resize"
            @mousedown="startResize"
          ></div>

          <!-- Sidebar Header -->
          <div class="sidebar-header">
            <h2 class="text-lg font-semibold">OpenClaw</h2>
            <div
              class="connection-indicator"
              :class="{ online: connected, offline: !connected }"
            ></div>
          </div>

          <!-- Sidebar Content -->
          <SessionList />
        </div>

        <!-- Main Content Area -->
        <div class="flex-1 flex flex-col bg-background min-w-0 overflow-hidden">
          <!-- Chat View -->
          <div id="chat-view" class="flex-1 flex flex-col overflow-hidden">
            <div class="chat-header">
              <h3>{{ currentSessionTitle }}</h3>
              <div class="flex items-center gap-4">
                <div class="text-xs text-muted-foreground">{{ sessionStatus }}</div>
                <button
                  class="settings-btn"
                  title="设置"
                  @click="openSettings"
                >
                  <Icon name="settings" :size="18" />
                </button>
              </div>
            </div>

            <div class="chat-messages">
              <WelcomeScreen v-if="!currentSessionKey" />
              <MessageList
                v-else
                :messages="currentMessages"
                :loading="loading"
                :thinking-message-id="thinkingMessageId"
                :streaming-message-id="streamingMessageId"
                ref="messageListRef"
              />
            </div>

            <MessageInput
              v-if="currentSessionKey"
              :disabled="!canSend"
              :can-abort="canAbort"
              :is-sending="isSending"
              @send="handleSendMessage"
              @abort="handleAbort"
              ref="messageInputRef"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Settings Dialog -->
    <SettingsDialog />

    <!-- Common Components -->
    <Toast />
    <Loading />
    <ConfirmDialog ref="confirmDialogRef" />
  </div>
</template>

<script lang="ts">
import { mapState, mapGetters, mapActions } from 'vuex'
import Vue from 'vue'

// Components
import TitleBar from '@/components/common/TitleBar.vue'
import SessionList from '@/components/session/SessionList.vue'
import WelcomeScreen from '@/components/chat/WelcomeScreen.vue'
import MessageList from '@/components/chat/MessageList.vue'
import MessageInput from '@/components/chat/MessageInput.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import Toast from '@/components/common/Toast.vue'
import Loading from '@/components/common/Loading.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import Icon from '@/components/common/Icon.vue'

export default {
  name: 'App',

  components: {
    TitleBar,
    SessionList,
    WelcomeScreen,
    MessageList,
    MessageInput,
    SettingsDialog,
    Toast,
    Loading,
    ConfirmDialog,
    Icon
  },

  data() {
    return {
      isResizing: false
    }
  },

  computed: {
    ...mapState('config', ['sidebarWidth']),
    ...mapState('gateway', ['connected']),
    ...mapState('chat', ['sessions', 'currentSessionKey', 'loading', 'thinkingMessageId', 'streamingMessageId', 'isSending', 'currentRunId']),
    ...mapGetters('chat', ['currentMessages']),

    currentSessionTitle(): string {
      if (!this.currentSessionKey) return '选择或创建一个对话'
      const session = this.sessions.find((s: any) => s.key === this.currentSessionKey)
      return session?.label || '未知会话'
    },

    sessionStatus(): string {
      return this.connected ? '已连接' : '离线'
    },

    canSend(): boolean {
      return this.currentSessionKey && this.connected && !this.loading && !this.isSending
    },

    canAbort(): boolean {
      // 只要正在发送就允许停止，不管是否有runId
      // 如果没有runId（还在等待服务器响应），前端只清理状态不发送abort消息
      return this.isSending
    }
  },

  methods: {
    ...mapActions('chat', ['sendMessage', 'abortCurrentChat', 'loadMessages', 'setCurrentSession', 'loadSessions']),
    ...mapActions('config', ['loadConfig', 'setSidebarWidth']),
    ...mapActions('gateway', ['connect', 'initializeEventListeners']),
    ...mapActions('ui', ['showToast', 'openSettings']),

    async handleSendMessage(message: string) {
      if (!this.canSend || !this.currentSessionKey) return

      try {
        await this.sendMessage({ sessionKey: this.currentSessionKey, content: message })
      } catch (error: any) {
        this.showToast({ message: error.message || '发送消息失败', type: 'error' })
      }
    },

    async handleAbort() {
      console.log('🛑 App handleAbort called')
      console.log('   - canAbort:', this.canAbort)
      console.log('   - currentRunId:', this.currentRunId)
      console.log('   - isSending:', this.isSending)

      if (!this.canAbort) {
        console.log('   ❌ Abort blocked: canAbort is false')
        return
      }

      try {
        await this.abortCurrentChat()
        this.showToast({ message: '已停止生成', type: 'success' })
      } catch (error: any) {
        this.showToast({ message: error.message || '停止生成失败', type: 'error' })
      }
    },

    startResize(event: MouseEvent) {
      this.isResizing = true
      document.addEventListener('mousemove', this.handleResize)
      document.addEventListener('mouseup', this.stopResize)
    },

    handleResize(event: MouseEvent) {
      if (!this.isResizing) return
      const newWidth = event.clientX
      this.setSidebarWidth(newWidth)
    },

    stopResize() {
      this.isResizing = false
      document.removeEventListener('mousemove', this.handleResize)
      document.removeEventListener('mouseup', this.stopResize)
    }
  },

  watch: {
    async currentSessionKey(newSessionKey: string, oldSessionKey: string) {
      if (newSessionKey && newSessionKey !== oldSessionKey) {
        try {
          await this.loadMessages(newSessionKey)
        } catch (error: any) {
          console.error('Failed to load messages:', error)
          this.showToast({ message: error.message || '加载消息失败', type: 'error' })
        }
      }
    },

    async connected(newConnected: boolean, oldConnected: boolean) {
      if (newConnected && !oldConnected) {
        try {
          await this.loadSessions()
        } catch (error: any) {
          console.error('Failed to reload sessions after connection:', error)
        }
      }
    }
  },

  async mounted() {
    // 初始化
    await this.loadConfig()
    this.initializeEventListeners()

    // 如果有保存的配置，尝试连接
    const gateway = (this as any).$store.state.config.gateway
    if (gateway && gateway.url) {
      try {
        await this.connect({
          url: gateway.url,
          token: gateway.token,
          password: gateway.password
        })

        // 等待一小段时间确保连接建立后再加载会话
        setTimeout(async () => {
          if (this.connected) {
            try {
              await this.loadSessions()
            } catch (error: any) {
              console.error('Failed to load sessions after connection:', error)
            }
          }
        }, 1000)
      } catch (error: any) {
        console.error('Failed to connect:', error)
      }
    }
  },

  beforeDestroy() {
    // 清理
  }
}
</script>

<style scoped>
#app {
  font-family: var(--font-sans);
}

.sidebar {
  min-width: 200px;
  max-width: 800px;
  flex-shrink: 0;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
  display: flex;
  flex-direction: column;
  border-right: 1px solid hsl(var(--border));
  position: relative;
}

.resizer {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  cursor: col-resize;
  background: transparent;
  transition: background 0.15s ease;
}

.resizer:hover {
  background: hsl(var(--primary));
}

.sidebar-header {
  padding: 1.25rem;
  border-bottom: 1px solid hsl(var(--border));
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.connection-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: hsl(var(--destructive));
}

.connection-indicator.online {
  background: hsl(142, 76%, 36%);
}

.chat-header {
  padding: 1rem 1.25rem;
  background: hsl(var(--background));
  border-bottom: 1px solid hsl(var(--border));
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.settings-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 0.375rem;
  color: hsl(var(--foreground));
  transition: background-color 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-btn:hover {
  background: hsl(var(--muted));
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  background: hsl(var(--background));
}
</style>
