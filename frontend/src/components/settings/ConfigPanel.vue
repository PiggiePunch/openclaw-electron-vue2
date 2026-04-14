<template>
  <div class="config-panel">
    <h4 class="text-base font-semibold mb-4">配置</h4>

    <ConfirmDialog
      ref="confirmDialogRef"
      title="重新连接确认"
      message="配置已更改。是否使用新设置重新连接？"
      confirm-text="重新连接"
      cancel-text="取消"
      @confirm="onConfirmReconnect"
    />

    <div class="config-content">
      <div class="form-group">
        <label for="gateway-url" class="form-label">网关地址</label>
        <input
          id="gateway-url"
          v-model="localConfig.url"
          type="text"
          class="input"
          placeholder="ws://localhost:18789"
        />
      </div>
      <div class="form-group">
        <label for="gateway-token" class="form-label">网关令牌（可选）</label>
        <input
          id="gateway-token"
          v-model="localConfig.token"
          type="password"
          class="input"
          placeholder="输入网关令牌"
        />
      </div>
      <div class="form-group">
        <label for="gateway-password" class="form-label">网关密码（可选）</label>
        <input
          id="gateway-password"
          v-model="localConfig.password"
          type="password"
          class="input"
          placeholder="输入网关密码"
        />
      </div>
      <div class="button-group">
        <button class="btn btn-secondary" @click="handleTestConnection">
          测试连接
        </button>
        <button class="btn btn-primary" @click="handleSaveAndConnect">
          保存并连接
        </button>
      </div>
      <div v-if="status" class="status" :class="`status-${status.type}`">
        {{ status.message }}
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { mapState, mapActions } from 'vuex'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

export default {
  name: 'ConfigPanel',

  components: {
    ConfirmDialog
  },

  data() {
    return {
      localConfig: {
        url: '',
        token: '',
        password: ''
      },
      status: null as { type: 'success' | 'error' | 'info'; message: string } | null,
      pendingConfig: null as any
    }
  },

  computed: {
    ...mapState('config', ['gateway']),
    ...mapState('gateway', ['connected'])
  },

  watch: {
    gateway: {
      immediate: true,
      handler(newGateway) {
        if (newGateway) {
          this.localConfig = {
            url: newGateway.url,
            token: newGateway.token || '',
            password: newGateway.password || ''
          }
        }
      }
    }
  },

  methods: {
    ...mapActions('config', ['updateGateway']),
    ...mapActions('gateway', ['connect']),
    ...mapActions('ui', ['showToast']),
    ...mapActions('chat', ['loadSessions']),

    showConfigStatus(message: string, type: 'success' | 'error' | 'info') {
      this.status = { type, message }
    },

    async handleTestConnection() {
      const config = {
        url: this.localConfig.url,
        token: this.localConfig.token || '',
        password: this.localConfig.password || ''
      }

      if (!config.url) {
        this.showConfigStatus('请输入 Gateway URL', 'error')
        return
      }

      // 检查是否已经连接
      if (this.connected) {
        const configChanged =
          config.url !== this.gateway.url ||
          config.token !== this.gateway.token ||
          config.password !== this.gateway.password

        if (!configChanged) {
          this.showConfigStatus('✅ 已经使用这些设置连接！', 'success')
          return
        }

        // Store config and show dialog
        this.pendingConfig = config
        const confirmDialogRef = this.$refs.confirmDialogRef as any
        confirmDialogRef?.show()
        return
      }

      await this.doTestConnection(config)
    },

    async onConfirmReconnect() {
      if (this.pendingConfig) {
        await this.doTestConnection(this.pendingConfig)
        this.pendingConfig = null
      }
    },

    async doTestConnection(config: any) {
      this.showConfigStatus('正在测试连接...', 'info')

      try {
        // 测试连接
        const result = await (window as any).electronAPI.connectGateway(config)

        if (result.success) {
          // 更新配置
          await this.updateGateway(config)

          this.showConfigStatus('✅ 连接测试成功！', 'success')
          this.showToast({ message: '连接成功', type: 'success' })

          // 加载会话列表
          try {
            await this.loadSessions()
          } catch (error: any) {
            console.error('Failed to load sessions:', error)
          }
        } else {
          this.showConfigStatus(`❌ 连接失败: ${result.error}`, 'error')
          this.showToast({ message: result.error || '连接失败', type: 'error' })
        }
      } catch (error: any) {
        this.showConfigStatus(`❌ 连接测试错误: ${error.message}`, 'error')
        this.showToast({ message: error.message || '连接测试失败', type: 'error' })
      }
    },

    async handleSaveAndConnect() {
      const config = {
        url: this.localConfig.url,
        token: this.localConfig.token || '',
        password: this.localConfig.password || ''
      }

      if (!config.url) {
        this.showConfigStatus('请输入 Gateway URL', 'error')
        return
      }

      // 检查是否已经连接
      if (this.connected) {
        const configChanged =
          config.url !== this.gateway.url ||
          config.token !== this.gateway.token ||
          config.password !== this.gateway.password

        if (!configChanged) {
          this.showConfigStatus('✅ 已连接！配置已保存。', 'success')
          return
        }
      }

      this.showConfigStatus('正在保存配置...', 'info')

      try {
        // 先保存配置
        const saved = await this.updateGateway(config)
        if (!saved) {
          throw new Error('保存配置失败')
        }

        this.showConfigStatus('正在连接...', 'info')

        // 连接到 Gateway
        const result = await (window as any).electronAPI.connectGateway(config)

        if (result.success) {
          this.showConfigStatus('✅ 连接成功！', 'success')
          this.showToast({ message: '连接成功！', type: 'success' })

          // 加载会话列表
          try {
            await this.loadSessions()
          } catch (error: any) {
            console.error('Failed to load sessions:', error)
          }
        } else {
          this.showConfigStatus(`❌ 连接失败: ${result.error}`, 'error')
          this.showToast({ message: result.error || '连接失败', type: 'error' })
        }
      } catch (error: any) {
        this.showConfigStatus(`❌ 错误: ${error.message}`, 'error')
        this.showToast({ message: error.message || '操作失败', type: 'error' })
      }
    }
  }
}
</script>

<style scoped>
.config-content {
  max-width: 500px;
}

.form-group {
  margin-bottom: 1rem;
}

.form-label {
  display: block;
  margin-bottom: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid hsl(var(--input));
  border-radius: calc(var(--radius) - 4px);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  font-size: 0.875rem;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.input:focus {
  outline: none;
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
}

.button-group {
  display: flex;
  gap: 0.75rem;
  margin-top: 1.5rem;
}

.status {
  margin-top: 1rem;
  padding: 0.75rem;
  border-radius: calc(var(--radius) - 4px);
  font-size: 0.875rem;
}

.status-success {
  background: hsl(142, 76%, 96%);
  color: hsl(142, 76%, 36%);
  border: 1px solid hsl(142, 76%, 80%);
}

.status-error {
  background: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
  border: 1px solid hsl(var(--destructive) / 0.3);
}
</style>
