<template>
  <div class="title-bar">
    <div class="title-bar-content" style="-webkit-app-region: drag;">
      <div class="title-bar-title">OpenClaw Desktop Client</div>
    </div>
    <div class="title-bar-controls" style="-webkit-app-region: no-drag;">
      <button
        class="title-bar-button minimize-btn"
        title="最小化"
        @click="minimize"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" stroke-width="1"/>
        </svg>
      </button>
      <button
        class="title-bar-button maximize-btn"
        :title="isMaximized ? '还原' : '最大化'"
        @click="toggleMaximize"
      >
        <svg v-if="!isMaximized" width="10" height="10" viewBox="0 0 10 10">
          <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/>
        </svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10">
          <!-- 后面的窗口（只露右上部分，左下被前面窗口遮挡） -->
          <line x1="2.5" y1="0.5" x2="9" y2="0.5" stroke="currentColor" stroke-width="0.8"/>
          <line x1="9" y1="0.5" x2="9" y2="7" stroke="currentColor" stroke-width="0.8"/>
          <!-- 前面的窗口 -->
          <rect x="0.5" y="2.5" width="6.5" height="6.5" fill="none" stroke="currentColor" stroke-width="0.8"/>
        </svg>
      </button>
      <button
        class="title-bar-button close-btn"
        title="关闭"
        @click="close"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1"/>
          <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'TitleBar',

  data() {
    return {
      isMaximized: false,
      resizeTimer: null as number | null
    }
  },

  methods: {
    async checkMaximized() {
      try {
        this.isMaximized = await (window as any).electronAPI?.isMaximized() ?? false
      } catch {
        this.isMaximized = false
      }
    },

    minimize() {
      ;(window as any).electronAPI?.minimizeWindow()
    },

    async toggleMaximize() {
      if (this.isMaximized) {
        ;(window as any).electronAPI?.unmaximizeWindow()
      } else {
        ;(window as any).electronAPI?.maximizeWindow()
      }
      // 立即检查状态
      await this.checkMaximized()
    },

    close() {
      ;(window as any).electronAPI?.closeWindow()
    },

    onResize() {
      if (this.resizeTimer) clearTimeout(this.resizeTimer)
      this.resizeTimer = window.setTimeout(() => {
        this.checkMaximized()
      }, 100) as unknown as number
    }
  },

  mounted() {
    this.checkMaximized()
    window.addEventListener('resize', this.onResize)
    ;(window as any).electronAPI?.onWindowMaximizeChanged?.((maximized: boolean) => {
      this.isMaximized = maximized
    })
  },

  beforeDestroy() {
    window.removeEventListener('resize', this.onResize)
    if (this.resizeTimer) clearTimeout(this.resizeTimer)
    ;(window as any).electronAPI?.removeAllListeners?.('window-maximize-changed')
  }
}
</script>

<style scoped>
.title-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  background: hsl(var(--muted) / 0.8);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid hsl(var(--border));
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 100;
}

.title-bar-content {
  display: flex;
  align-items: center;
  padding: 0 0.625rem;
  flex: 1;
  height: 100%;
}

.title-bar-title {
  font-size: 0.75rem;
  font-weight: 500;
  color: hsl(var(--foreground) / 0.7);
  letter-spacing: 0.05em;
}

.title-bar-controls {
  display: flex;
  height: 100%;
}

.title-bar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  background: none;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.title-bar-button:hover {
  background: hsl(var(--muted) / 0.5);
}

.title-bar-button.close-btn:hover {
  background: hsl(var(--destructive));
}

.title-bar-button svg {
  color: hsl(var(--foreground) / 0.8);
  transition: color 0.15s ease;
}

.title-bar-button:hover svg {
  color: hsl(var(--foreground));
}
</style>
