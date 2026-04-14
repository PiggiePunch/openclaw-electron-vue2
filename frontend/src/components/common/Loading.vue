<template>
  <transition name="loading">
    <div v-if="computedLoading" class="loading-overlay">
      <div class="spinner"></div>
      <div class="loading-message">{{ computedMessage }}</div>
    </div>
  </transition>
</template>

<script lang="ts">
import { mapState } from 'vuex'

export default {
  name: 'Loading',

  props: {
    loading: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: '加载中...'
    }
  },

  computed: {
    ...mapState('ui', {
      uiLoading: 'loading',
      loadingMessage: 'loadingMessage'
    }),

    computedLoading(): boolean {
      return (this as any).loading !== undefined ? (this as any).loading : (this as any).uiLoading
    },
    computedMessage(): string {
      return (this as any).message || (this as any).loadingMessage || '加载中...'
    }
  }
}
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-message {
  margin-top: 1.25rem;
  font-size: 1rem;
  color: white;
}

.loading-enter-active,
.loading-leave-active {
  transition: opacity 0.3s ease;
}

.loading-enter-from,
.loading-leave-to {
  opacity: 0;
}
</style>
