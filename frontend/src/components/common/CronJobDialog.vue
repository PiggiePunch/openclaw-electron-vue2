<template>
  <transition name="dialog">
    <div v-if="open" class="dialog-overlay" @click="handleCancel">
      <div class="dialog" @click.stop>
        <h3>{{ isEdit ? '编辑定时任务' : '添加定时任务' }}</h3>

          <div class="dialog-content">
            <!-- 基本信息 -->
            <div class="form-section">
              <h4>基本信息</h4>
              <div class="form-group">
                <label>任务名称 *</label>
                <input
                  v-model="form.name"
                  type="text"
                  class="dialog-input"
                  placeholder="请输入任务名称"
                />
              </div>
              <div class="form-group">
                <label>任务描述</label>
                <input
                  v-model="form.description"
                  type="text"
                  class="dialog-input"
                  placeholder="可选描述"
                />
              </div>
              <div class="form-group">
                <label>Agent *</label>
                <select v-model="form.agentId" class="dialog-select" @change="handleAgentChange">
                  <option value="main">main (系统事件)</option>
                  <option v-for="agent in agents" :key="agent.id" :value="agent.id">
                    {{ agent.name || agent.id }}
                  </option>
                </select>
                <span class="form-hint">main agent需要使用systemEvent类型</span>
              </div>
              <div class="form-group checkbox-group">
                <label>
                  <input v-model="form.enabled" type="checkbox" />
                  启用此任务
                </label>
              </div>
            </div>

            <!-- 调度设置 -->
            <div class="form-section">
              <h4>调度设置</h4>
              <div class="form-group checkbox-group">
                <label>
                  <input v-model="form.scheduleKind" type="radio" value="every" />
                  间隔执行
                </label>
              </div>
              <div v-if="form.scheduleKind === 'every'" class="interval-inputs">
                <input
                  v-model.number="form.everyAmount"
                  type="number"
                  class="dialog-input"
                  min="1"
                />
                <select v-model="form.everyUnit" class="dialog-select">
                  <option value="minutes">分钟</option>
                  <option value="hours">小时</option>
                  <option value="days">天</option>
                </select>
              </div>
              <div class="form-group checkbox-group">
                <label>
                  <input v-model="form.scheduleKind" type="radio" value="cron" />
                  Cron表达式
                </label>
              </div>
              <div v-if="form.scheduleKind === 'cron'" class="form-group">
                <input
                  v-model="form.cronExpr"
                  type="text"
                  class="dialog-input"
                  placeholder="0 9 * * *"
                />
                <span class="form-hint">标准cron表达式，例如：0 9 * * * 表示每天9点</span>
              </div>
            </div>

            <!-- 执行设置 -->
            <div class="form-section">
              <h4>执行设置</h4>
              <div class="form-group">
                <label>{{ form.agentId === 'main' ? '事件消息' : '任务消息' }} *</label>
                <textarea
                  v-model="form.message"
                  class="dialog-textarea"
                  rows="3"
                  :placeholder="form.agentId === 'main' ? '系统事件消息' : '任务消息内容'"
                ></textarea>
              </div>
              <div class="form-group">
                <label>会话目标</label>
                <select v-model="form.sessionTarget" class="dialog-select">
                  <option value="main">主会话</option>
                  <option value="isolated">独立会话</option>
                </select>
              </div>
              <div class="form-group">
                <label>会话Key（可选）</label>
                <input
                  v-model="form.sessionKey"
                  type="text"
                  class="dialog-input"
                  placeholder="agent:main:my-session"
                />
                <span class="form-hint">可选的路由key</span>
              </div>
              <div class="form-group">
                <label>唤醒模式</label>
                <select v-model="form.wakeMode" class="dialog-select">
                  <option value="next-heartbeat">下次心跳</option>
                  <option value="now">立即</option>
                </select>
              </div>
            </div>

            <!-- 可选参数（仅对非main agent显示） -->
            <div v-if="form.agentId !== 'main'" class="form-section">
              <h4>可选参数</h4>
              <div class="form-group">
                <label>模型覆盖（可选）</label>
                <input
                  v-model="form.model"
                  type="text"
                  class="dialog-input"
                  placeholder="openai/gpt-4"
                />
                <span class="form-hint">例如：openai/gpt-4, claude/claude-3-5-sonnet</span>
              </div>
              <div class="form-group">
                <label>思考模式（可选）</label>
                <input
                  v-model="form.thinking"
                  type="text"
                  class="dialog-input"
                  placeholder="low, medium, high"
                />
              </div>
              <div class="form-group">
                <label>超时时间（秒，可选）</label>
                <input
                  v-model.number="form.timeout"
                  type="number"
                  class="dialog-input"
                  placeholder="300"
                  min="1"
                />
              </div>
              <div class="form-group">
                <label>备用模型（可选，逗号分隔）</label>
                <input
                  v-model="form.fallbacks"
                  type="text"
                  class="dialog-input"
                  placeholder="openai/gpt-4, claude/claude-3-5-sonnet"
                />
              </div>
              <div class="form-group checkbox-group">
                <label>
                  <input v-model="form.lightContext" type="checkbox" />
                  轻量上下文
                </label>
                <span class="form-hint">为此agent任务使用轻量级引导上下文</span>
              </div>
            </div>

            <!-- 其他设置 -->
            <div class="form-section">
              <h4>其他设置</h4>
              <div class="form-group checkbox-group">
                <label>
                  <input v-model="form.deleteAfterRun" type="checkbox" />
                  运行后删除
                </label>
                <span class="form-hint">任务运行一次后自动删除</span>
              </div>
            </div>
          </div>

          <div class="dialog-buttons">
            <button class="btn btn-secondary" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button class="btn btn-primary" @click="handleConfirm" :disabled="!isValid">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
</template>

<script lang="ts">
import { PropType } from 'vue'

export interface CronJobFormData {
  name: string
  description: string
  agentId: string
  enabled: boolean
  scheduleKind: 'every' | 'cron'
  everyAmount: number
  everyUnit: 'minutes' | 'hours' | 'days'
  cronExpr: string
  message: string
  sessionTarget: 'main' | 'isolated'
  sessionKey: string
  wakeMode: 'next-heartbeat' | 'now'
  model: string
  thinking: string
  timeout: number
  fallbacks: string
  lightContext: boolean
  deleteAfterRun: boolean
}

interface Agent {
  id: string
  name?: string
}

export default {
  name: 'CronJobDialog',

  props: {
    isEdit: {
      type: Boolean as PropType<boolean>,
      default: false
    },
    existingJob: {
      type: Object as PropType<any>,
      default: null
    },
    agents: {
      type: Array as PropType<Agent[]>,
      default: () => []
    },
    confirmText: {
      type: String as PropType<string>,
      default: '确定'
    },
    cancelText: {
      type: String as PropType<string>,
      default: '取消'
    }
  },

  data() {
    const defaultForm: CronJobFormData = {
      name: '',
      description: '',
      agentId: 'main',
      enabled: true,
      scheduleKind: 'every',
      everyAmount: 1,
      everyUnit: 'hours',
      cronExpr: '0 9 * * *',
      message: '',
      sessionTarget: 'main',
      sessionKey: '',
      wakeMode: 'next-heartbeat',
      model: '',
      thinking: '',
      timeout: 0,
      fallbacks: '',
      lightContext: false,
      deleteAfterRun: false
    }

    return {
      open: false,
      form: { ...defaultForm }
    }
  },

  computed: {
    isEdit(): boolean {
      return this.isEdit
    },

    isValid(): boolean {
      return this.form.name.trim() &&
             this.form.message.trim() &&
             (this.form.scheduleKind === 'every'
               ? (this.form.everyAmount > 0)
               : this.form.cronExpr.trim())
    }
  },

  methods: {
    show() {
      if (this.existingJob) {
        // 从现有任务加载数据
        this.form = {
          name: this.existingJob.name || '',
          description: this.existingJob.description || '',
          agentId: this.existingJob.agentId || 'main',
          enabled: this.existingJob.enabled !== undefined ? this.existingJob.enabled : true,
          scheduleKind: 'every',
          everyAmount: 1,
          everyUnit: 'hours',
          cronExpr: '0 9 * * *',
          message: '',
          sessionTarget: this.existingJob.sessionTarget || 'main',
          sessionKey: this.existingJob.sessionKey || '',
          wakeMode: this.existingJob.wakeMode || 'next-heartbeat',
          model: '',
          thinking: '',
          timeout: 0,
          fallbacks: '',
          lightContext: false,
          deleteAfterRun: this.existingJob.deleteAfterRun || false
        }

        // 处理payload
        if (this.existingJob.payload) {
          if (this.existingJob.payload.kind === 'systemEvent') {
            this.form.message = this.existingJob.payload.text || ''
            this.form.model = this.existingJob.payload.model || ''
            this.form.thinking = this.existingJob.payload.thinking || ''
            this.form.timeout = this.existingJob.payload.timeoutSeconds || 0
            this.form.fallbacks = this.existingJob.payload.fallbacks?.join(', ') || ''
          } else if (this.existingJob.payload.kind === 'agentTurn') {
            this.form.message = this.existingJob.payload.message || ''
            this.form.model = this.existingJob.payload.model || ''
            this.form.thinking = this.existingJob.payload.thinking || ''
            this.form.timeout = this.existingJob.payload.timeoutSeconds || 0
            this.form.fallbacks = this.existingJob.payload.fallbacks?.join(', ') || ''
            this.form.lightContext = this.existingJob.payload.lightContext || false
          }
        }

        // 处理调度
        if (this.existingJob.schedule) {
          this.form.scheduleKind = this.existingJob.schedule.kind || 'every'

          if (this.existingJob.schedule.kind === 'every') {
            const ms = this.existingJob.schedule.everyMs || 0
            if (ms % 86400000 === 0) {
              this.form.everyAmount = ms / 86400000
              this.form.everyUnit = 'days'
            } else if (ms % 3600000 === 0) {
              this.form.everyAmount = ms / 3600000
              this.form.everyUnit = 'hours'
            } else {
              this.form.everyAmount = ms / 60000
              this.form.everyUnit = 'minutes'
            }
          } else if (this.existingJob.schedule.kind === 'cron') {
            this.form.cronExpr = this.existingJob.schedule.expr || '0 9 * * *'
          }
        }
      } else {
        this.form = { ...defaultForm }
      }

      this.open = true
    },

    hide() {
      this.open = false
    },

    handleConfirm() {
      if (!this.isValid) return

      this.hide()
      this.$emit('confirm', { ...this.form })
    },

    handleCancel() {
      this.hide()
      this.$emit('cancel')
    },

    handleAgentChange() {
      // Agent change handled by watch
    }
  },

  watch: {
    'form.agentId': function(newAgentId: string) {
      if (newAgentId === 'main') {
        // main agent使用systemEvent，清空agentTurn相关字段
        this.form.model = ''
        this.form.thinking = ''
        this.form.timeout = 0
        this.form.fallbacks = ''
        this.form.lightContext = false
        // main agent使用main sessionTarget
        if (this.form.sessionTarget === 'isolated') {
          this.form.sessionTarget = 'main'
        }
      } else {
        // 非main agent使用isolated sessionTarget
        this.form.sessionTarget = 'isolated'
      }
    }
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: white;
  border-radius: calc(var(--radius) - 2px);
  padding: 1.25rem;
  min-width: 480px;
  max-width: 580px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.dialog h3 {
  margin: 0 0 1rem 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}

.form-section {
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  padding: 0.75rem;
}

.form-section h4 {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 0.75rem;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-group label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.form-hint {
  font-size: 0.6875rem;
  color: hsl(var(--muted-foreground));
}

.checkbox-group label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.checkbox-group input[type="checkbox"],
.checkbox-group input[type="radio"] {
  cursor: pointer;
}

.interval-inputs {
  display: flex;
  gap: 0.5rem;
}

.interval-inputs .dialog-input,
.interval-inputs .dialog-select {
  flex: 1;
}

.dialog-input,
.dialog-select,
.dialog-textarea {
  width: 100%;
  padding: 0.4375rem 0.625rem;
  font-size: 0.8125rem;
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  background: hsl(var(--background));
  color: hsl(var(--foreground));
  box-sizing: border-box;
}

.dialog-select {
  cursor: pointer;
}

.dialog-textarea {
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
}

.dialog-input:focus,
.dialog-select:focus,
.dialog-textarea:focus {
  outline: none;
  border-color: hsl(var(--ring));
  box-shadow: 0 0 0 2px hsl(var(--ring) / 0.2);
}

.dialog-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 0.3s ease;
}

.dialog-enter-from,
.dialog-leave-to {
  opacity: 0;
}
</style>
