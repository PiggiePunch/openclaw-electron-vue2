<template>
  <transition name="dialog">
    <div v-if="open" class="dialog-overlay" @click="handleCancel">
      <div class="dialog" @click.stop>
        <h3>{{ title }}</h3>
        <p>{{ message }}</p>
        <div class="dialog-buttons">
          <button class="btn btn-secondary" @click="handleCancel">
            {{ cancelText }}
          </button>
          <button class="btn btn-primary" @click="handleConfirm">
            {{ confirmText }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
export default {
  name: 'ConfirmDialog',

  props: {
    title: {
      type: String,
      default: 'Confirm'
    },
    message: {
      type: String,
      default: 'Are you sure?'
    },
    confirmText: {
      type: String,
      default: 'Confirm'
    },
    cancelText: {
      type: String,
      default: 'Cancel'
    }
  },

  data() {
    return {
      open: false
    }
  },

  methods: {
    show() {
      this.open = true
    },

    hide() {
      this.open = false
    },

    handleConfirm() {
      this.hide()
      this.$emit('confirm')
    },

    handleCancel() {
      this.hide()
      this.$emit('cancel')
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
  padding: 1.25rem 1.5rem;
  min-width: 320px;
  max-width: 420px;
  width: auto;
  max-height: 160px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.dialog h3 {
  margin: 0 0 0.5rem 0;
  font-size: 0.9375rem;
  font-weight: 600;
  color: hsl(var(--foreground));
  line-height: 1.4;
}

.dialog p {
  margin: 0 0 0.75rem 0;
  font-size: 0.875rem;
  color: hsl(var(--muted-foreground));
  line-height: 1.4;
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
