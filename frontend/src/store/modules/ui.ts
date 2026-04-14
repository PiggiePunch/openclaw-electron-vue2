/**
 * UI 状态管理 - Vuex Module
 */

import type { UiState, Toast } from '@/types/ui'

const state: UiState = {
  sidebarWidth: 280,
  settingsDialogOpen: false,
  settingsActiveTab: 'sessions',
  loading: false,
  loadingMessage: '加载中...',
  toasts: []
}

const getters = {
  hasToasts: (state: UiState) => state.toasts.length > 0,
  toastCount: (state: UiState) => state.toasts.length
}

const mutations = {
  SET_SIDEBAR_WIDTH(state: UiState, width: number) {
    state.sidebarWidth = Math.max(200, Math.min(800, width))
  },
  SET_SETTINGS_DIALOG_OPEN(state: UiState, open: boolean) {
    state.settingsDialogOpen = open
  },
  SET_SETTINGS_ACTIVE_TAB(state: UiState, tab: string) {
    state.settingsActiveTab = tab
  },
  SET_LOADING(state: UiState, loading: boolean) {
    state.loading = loading
  },
  SET_LOADING_MESSAGE(state: UiState, message: string) {
    state.loadingMessage = message
  },
  ADD_TOAST(state: UiState, toast: Toast) {
    state.toasts.push(toast)
  },
  REMOVE_TOAST(state: UiState, id: string) {
    const index = state.toasts.findIndex(t => t.id === id)
    if (index !== -1) {
      state.toasts.splice(index, 1)
    }
  },
  CLEAR_TOASTS(state: UiState) {
    state.toasts = []
  }
}

const actions = {
  /**
   * 显示加载状态
   */
  showLoading({ commit }: any, message = '加载中...') {
    commit('SET_LOADING', true)
    commit('SET_LOADING_MESSAGE', message)
  },

  /**
   * 隐藏加载状态
   */
  hideLoading({ commit }: any) {
    commit('SET_LOADING', false)
    commit('SET_LOADING_MESSAGE', '加载中...')
  },

  /**
   * 显示 Toast 通知
   */
  showToast({ commit }: any, { message, type, duration }: { message: string; type?: 'info' | 'success' | 'warning' | 'error'; duration?: number }) {
    const toast: Toast = {
      id: `toast-${Date.now()}-${Math.random()}`,
      message,
      type: type || 'info',
      duration: duration || 3000
    }

    commit('ADD_TOAST', toast)

    // 自动移除 Toast
    setTimeout(() => {
      commit('REMOVE_TOAST', toast.id)
    }, toast.duration)
  },

  /**
   * 移除 Toast
   */
  removeToast({ commit }: any, id: string) {
    commit('REMOVE_TOAST', id)
  },

  /**
   * 清除所有 Toast
   */
  clearToasts({ commit }: any) {
    commit('CLEAR_TOASTS')
  },

  /**
   * 打开设置对话框
   */
  openSettings({ commit }: any, tab = 'sessions') {
    commit('SET_SETTINGS_DIALOG_OPEN', true)
    commit('SET_SETTINGS_ACTIVE_TAB', tab)
  },

  /**
   * 关闭设置对话框
   */
  closeSettings({ commit }: any) {
    commit('SET_SETTINGS_DIALOG_OPEN', false)
  },

  /**
   * 切换设置标签
   */
  switchSettingsTab({ commit }: any, tab: string) {
    commit('SET_SETTINGS_ACTIVE_TAB', tab)
  },

  /**
   * 设置侧边栏宽度
   */
  setSidebarWidth({ commit }: any, width: number) {
    commit('SET_SIDEBAR_WIDTH', width)
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}
