<template>
  <div class="cron-panel">
    <div class="settings-view-header">
      <h4 class="m-0">定时任务</h4>
      <button class="btn btn-primary btn-sm" @click="handleAddJob">
        + 添加任务
      </button>
    </div>

    <CronJobDialog
      ref="cronJobDialogRef"
      :is-edit="isEditingJob"
      :existing-job="currentEditJob"
      :agents="availableAgents"
      :confirm-text="confirmButtonText"
      cancel-text="取消"
      @confirm="editingJobId ? onEditJobConfirm($event) : onAddJobConfirm($event)"
    />

    <ConfirmDialog
      ref="confirmDialogRef"
      title="确认删除"
      :message="deleteConfirmMessage"
      confirm-text="删除"
      cancel-text="取消"
      @confirm="onDeleteConfirm"
    />

    <div v-if="loading" class="cron-loading">
      <div class="spinner"></div>
      <div>加载定时任务中...</div>
    </div>

    <div v-else-if="jobs.length === 0" class="cron-empty">
      <p>暂无定时任务</p>
      <p class="text-sm text-muted-foreground">点击"添加任务"创建一个定时任务</p>
    </div>

    <div v-else class="cron-jobs-list">
      <div
        v-for="job in jobs"
        :key="job.id"
        class="cron-job-item"
      >
        <div class="cron-job-header">
          <div class="cron-job-title">{{ job.name || job.label || job.id }}</div>
          <div class="cron-job-actions">
            <button
              class="btn btn-xs"
              :disabled="job.running"
              @click="handleRunJob(job.id)"
            >
              {{ job.running ? '运行中...' : '运行' }}
            </button>
            <button class="btn btn-xs" @click="handleEditJob(job.id)">
              编辑
            </button>
            <button
              class="btn btn-xs btn-destructive"
              @click="handleDeleteJob(job.id)"
            >
              删除
            </button>
          </div>
        </div>

        <div class="cron-job-info">
          <div class="cron-job-schedule">
            <span class="label">调度:</span>
            <span>{{ formatSchedule(job.schedule) }}</span>
          </div>

          <div v-if="job.agentId" class="cron-job-agent">
            <span class="label">Agent:</span>
            <span>{{ job.agentId }}</span>
          </div>

          <div v-if="job.sessionKey" class="cron-job-session">
            <span class="label">会话:</span>
            <span>{{ job.sessionKey }}</span>
          </div>

          <div v-if="job.enabled !== undefined" class="cron-job-status">
            <span class="label">状态:</span>
            <span :class="{ enabled: job.enabled, disabled: !job.enabled }">
              {{ job.enabled ? '启用' : '禁用' }}
            </span>
          </div>
        </div>

        <div v-if="job.description" class="cron-job-description">
          {{ job.description }}
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { mapActions } from 'vuex'
import CronJobDialog from '@/components/common/CronJobDialog.vue'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'

interface CronJob {
  id: string
  name?: string
  label?: string
  description?: string
  schedule: any
  agentId?: string
  sessionKey?: string
  sessionTarget?: string
  wakeMode?: string
  enabled?: boolean
  running?: boolean
  payload?: any
  deleteAfterRun?: boolean
}

export default {
  name: 'CronPanel',

  components: {
    CronJobDialog,
    ConfirmDialog
  },

  data() {
    return {
      jobs: [] as CronJob[],
      loading: false,
      availableAgents: [] as any[],
      editingJobId: null as string | null,
      deletingJobId: null as string | null
    }
  },

  computed: {
    isEditingJob(): boolean {
      return !!this.editingJobId
    },

    currentEditJob(): CronJob | null {
      if (!this.editingJobId) return null
      return this.jobs.find(j => j.id === this.editingJobId) || null
    },

    confirmButtonText(): string {
      return this.editingJobId ? '保存' : '添加'
    },

    deleteConfirmMessage(): string {
      if (!this.deletingJobId) return ''
      const job = this.jobs.find(j => j.id === this.deletingJobId)
      const name = job?.label || job?.name || this.deletingJobId
      return `确定要删除定时任务"${name}"吗？`
    }
  },

  methods: {
    ...mapActions('ui', ['showToast', 'showLoading', 'hideLoading']),

    mounted() {
      this.loadJobs()
      this.loadAgents()
    },

    async loadAgents() {
      try {
        const result = await (window as any).electronAPI.listAgents()

        if (result.success && result.data) {
          let agents = result.data
          if (agents && !Array.isArray(agents) && agents.agents) {
            agents = agents.agents
          }
          this.availableAgents = Array.isArray(agents) ? agents : []
        }
      } catch (error: any) {
        console.error('Failed to load agents:', error)
      }
    },

    async loadJobs() {
      this.loading = true
      try {
        const result = await (window as any).electronAPI.listCronJobs()

        if (!result.success) {
          throw new Error(result.error || '加载定时任务失败')
        }

        // Gateway might return different data structures
        let jobsData = result.data
        if (jobsData && typeof jobsData === 'object' && !Array.isArray(jobsData)) {
          jobsData = jobsData.jobs || jobsData.items || jobsData.data || []
        }

        this.jobs = Array.isArray(jobsData) ? jobsData : []
      } catch (error: any) {
        console.error('Failed to load cron jobs:', error)
        this.showToast({ message: error.message || '加载定时任务失败', type: 'error' })
      } finally {
        this.loading = false
      }
    },

    async handleAddJob() {
      if (this.availableAgents.length === 0) {
        await this.loadAgents()
        if (this.availableAgents.length === 0) {
          this.showToast({ message: '没有可用的 Agent，请先连接到 Gateway', type: 'error' })
          return
        }
      }

      this.editingJobId = null
      const cronJobDialogRef = this.$refs.cronJobDialogRef as any
      cronJobDialogRef?.show()
    },

    async onAddJobConfirm(data: any) {
      try {
        this.loading = true

        // Build schedule object based on kind
        let schedule: any = {}
        if (data.scheduleKind === 'every') {
          const unitToMs = { minutes: 60000, hours: 3600000, days: 86400000 }
          schedule = {
            kind: 'every',
            everyMs: data.everyAmount * unitToMs[data.everyUnit]
          }
        } else if (data.scheduleKind === 'cron') {
          schedule = {
            kind: 'cron',
            expr: data.cronExpr
          }
        }

        // Build payload based on agentId
        let payload: any
        if (data.agentId === 'main') {
          payload = {
            kind: 'systemEvent',
            text: data.message.trim()
          }
          // Optional fields for systemEvent
          if (data.model) payload.model = data.model
          if (data.thinking) payload.thinking = data.thinking
          if (data.timeout) payload.timeoutSeconds = data.timeout
          if (data.fallbacks) {
            payload.fallbacks = data.fallbacks.split(',').map((s: string) => s.trim()).filter((s: string) => s)
          }
        } else {
          payload = {
            kind: 'agentTurn',
            message: data.message.trim()
          }
          // Optional fields for agentTurn
          if (data.model) payload.model = data.model
          if (data.thinking) payload.thinking = data.thinking
          if (data.timeout) payload.timeoutSeconds = data.timeout
          if (data.fallbacks) {
            payload.fallbacks = data.fallbacks.split(',').map((s: string) => s.trim()).filter((s: string) => s)
          }
          if (data.lightContext) payload.lightContext = true
        }

        const newJob = {
          name: data.name,
          description: data.description || undefined,
          agentId: data.agentId,
          enabled: data.enabled,
          schedule: schedule,
          sessionTarget: data.sessionTarget,
          sessionKey: data.sessionKey || undefined,
          wakeMode: data.wakeMode,
          payload: payload,
          deleteAfterRun: data.deleteAfterRun || undefined
        }

        const result = await (window as any).electronAPI.addCronJob(newJob)

        if (!result.success) {
          throw new Error(result.error || '添加任务失败')
        }

        this.showToast({ message: '任务添加成功', type: 'success' })
        await this.loadJobs()
      } catch (error: any) {
        console.error('Failed to add cron job:', error)
        this.showToast({ message: error.message || '添加任务失败', type: 'error' })
      } finally {
        this.loading = false
      }
    },

    async handleEditJob(jobId: string) {
      const job = this.jobs.find(j => j.id === jobId)
      if (!job) {
        this.showToast({ message: '任务不存在', type: 'error' })
        return
      }

      this.editingJobId = jobId
      await this.$nextTick()
      const cronJobDialogRef = this.$refs.cronJobDialogRef as any
      cronJobDialogRef?.show()
    },

    async onEditJobConfirm(data: any) {
      if (!this.editingJobId) return

      try {
        this.loading = true

        // 获取原始job
        const originalJob = this.jobs.find(j => j.id === this.editingJobId)
        if (!originalJob) {
          throw new Error('任务不存在')
        }

        // 如果agentId从main改为其他，或从其他改为main，需要删除后重建
        const agentChanged = originalJob.agentId !== data.agentId

        // Build schedule object based on kind
        let schedule: any = {}
        if (data.scheduleKind === 'every') {
          const unitToMs = { minutes: 60000, hours: 3600000, days: 86400000 }
          schedule = {
            kind: 'every',
            everyMs: data.everyAmount * unitToMs[data.everyUnit]
          }
        } else if (data.scheduleKind === 'cron') {
          schedule = {
            kind: 'cron',
            expr: data.cronExpr
          }
        }

        // Build payload based on agentId
        let payload: any
        if (data.agentId === 'main') {
          payload = {
            kind: 'systemEvent',
            text: data.message.trim()
          }
          if (data.model) payload.model = data.model
          if (data.thinking) payload.thinking = data.thinking
          if (data.timeout) payload.timeoutSeconds = data.timeout
          if (data.fallbacks) {
            payload.fallbacks = data.fallbacks.split(',').map((s: string) => s.trim()).filter((s: string) => s)
          }
        } else {
          payload = {
            kind: 'agentTurn',
            message: data.message.trim()
          }
          if (data.model) payload.model = data.model
          if (data.thinking) payload.thinking = data.thinking
          if (data.timeout) payload.timeoutSeconds = data.timeout
          if (data.fallbacks) {
            payload.fallbacks = data.fallbacks.split(',').map((s: string) => s.trim()).filter((s: string) => s)
          }
          if (data.lightContext) payload.lightContext = true
        }

        const jobData = {
          name: data.name,
          description: data.description || undefined,
          agentId: data.agentId,
          enabled: data.enabled,
          schedule: schedule,
          sessionTarget: data.sessionTarget,
          sessionKey: data.sessionKey || undefined,
          wakeMode: data.wakeMode,
          payload: payload,
          deleteAfterRun: data.deleteAfterRun || undefined
        }

        let result
        if (agentChanged) {
          // Agent改变，先删除再创建
          const deleteResult = await (window as any).electronAPI.removeCronJob(this.editingJobId)
          if (!deleteResult.success) {
            throw new Error(deleteResult.error || '删除原任务失败')
          }

          // 创建新job
          result = await (window as any).electronAPI.addCronJob(jobData)
        } else {
          // Agent未改变，使用正常更新
          result = await (window as any).electronAPI.updateCronJob(this.editingJobId, jobData)
        }

        if (!result.success) {
          throw new Error(result.error || '更新任务失败')
        }

        this.showToast({ message: '任务更新成功', type: 'success' })
        await this.loadJobs()
      } catch (error: any) {
        console.error('Failed to update cron job:', error)
        this.showToast({ message: error.message || '更新任务失败', type: 'error' })
      } finally {
        this.loading = false
        this.editingJobId = null
      }
    },

    async handleRunJob(jobId: string) {
      try {
        this.showLoading({ message: '正在运行任务...' })

        const result = await (window as any).electronAPI.runCronJob(jobId, 'force')

        if (!result.success) {
          throw new Error(result.error || '运行任务失败')
        }

        this.showToast({ message: '任务运行成功', type: 'success' })
        await this.loadJobs()
      } catch (error: any) {
        console.error('Failed to run cron job:', error)
        this.showToast({ message: error.message || '运行任务失败', type: 'error' })
      } finally {
        this.hideLoading()
      }
    },

    handleDeleteJob(jobId: string) {
      const job = this.jobs.find(j => j.id === jobId)
      if (!job) return

      this.deletingJobId = jobId
      const confirmDialogRef = this.$refs.confirmDialogRef as any
      confirmDialogRef?.show()
    },

    async onDeleteConfirm() {
      if (!this.deletingJobId) return

      try {
        this.showLoading({ message: '正在删除任务...' })

        const result = await (window as any).electronAPI.removeCronJob(this.deletingJobId)

        if (!result.success) {
          throw new Error(result.error || '删除任务失败')
        }

        this.jobs = this.jobs.filter(j => j.id !== this.deletingJobId)
        this.showToast({ message: '任务删除成功', type: 'success' })
      } catch (error: any) {
        console.error('Failed to delete cron job:', error)
        this.showToast({ message: error.message || '删除任务失败', type: 'error' })
      } finally {
        this.hideLoading()
        this.deletingJobId = null
      }
    },

    formatSchedule(schedule: any): string {
      if (!schedule) return '未设置'

      if (schedule.kind === 'cron') {
        return `Cron: ${schedule.expr}`
      }

      if (schedule.kind === 'every') {
        const ms = schedule.everyMs || 0
        if (ms % 86400000 === 0) {
          return `每 ${ms / 86400000} 天`
        } else if (ms % 3600000 === 0) {
          return `每 ${ms / 3600000} 小时`
        } else if (ms % 60000 === 0) {
          return `每 ${ms / 60000} 分钟`
        }
        return `间隔: ${ms}ms`
      }

      if (schedule.cron) {
        return `Cron: ${schedule.cron}`
      }

      if (schedule.interval) {
        return `间隔: ${schedule.interval}`
      }

      return JSON.stringify(schedule)
    }
  }
}
</script>

<style scoped>
.settings-view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.settings-view-header h4 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.cron-loading,
.cron-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
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

.cron-jobs-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cron-job-item {
  border: 1px solid hsl(var(--border));
  border-radius: calc(var(--radius) - 2px);
  padding: 1rem;
  background: hsl(var(--background));
}

.cron-job-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 0.75rem;
}

.cron-job-title {
  font-weight: 600;
  color: hsl(var(--foreground));
}

.cron-job-actions {
  display: flex;
  gap: 0.5rem;
}

.cron-job-actions .btn {
  padding: 0.1875rem 0.4375rem;
  font-size: 0.6875rem;
  height: auto;
  min-height: 1.375rem;
}

.btn-destructive {
  background: hsl(var(--destructive) / 0.1);
  color: hsl(var(--destructive));
  border-color: hsl(var(--destructive));
}

.btn-destructive:hover {
  background: hsl(var(--destructive) / 0.2);
}

.cron-job-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.cron-job-schedule,
.cron-job-agent,
.cron-job-session,
.cron-job-status {
  display: flex;
  gap: 0.5rem;
}

.label {
  color: hsl(var(--muted-foreground));
  font-weight: 500;
}

.enabled {
  color: hsl(142, 76%, 36%);
}

.disabled {
  color: hsl(var(--muted-foreground));
}

.cron-job-description {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid hsl(var(--border));
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
}
</style>
