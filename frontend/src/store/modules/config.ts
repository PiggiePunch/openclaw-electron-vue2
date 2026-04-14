/**
 * 配置状态管理 - Vuex Module
 */

import { getConfig, saveConfig } from '@/api/config'
import type { ConfigState } from '@/types/config'

const state: ConfigState = {
  gateway: {
    url: 'ws://localhost:18789',
    token: '',
    password: ''
  },
  sessionsExpanded: true,
  lastSessionKey: undefined,
  sidebarWidth: 280
}

const getters = {
  hasConfig: (state: ConfigState) => !!state.gateway.url,
  isConnectedConfig: (state: ConfigState) =>
    state.gateway.url !== 'ws://localhost:18789' ||
    !!state.gateway.token ||
    !!state.gateway.password
}

const mutations = {
  SET_GATEWAY(state: ConfigState, gateway: ConfigState['gateway']) {
    state.gateway = gateway
  },
  SET_SESSIONS_EXPANDED(state: ConfigState, expanded: boolean) {
    state.sessionsExpanded = expanded
  },
  SET_LAST_SESSION_KEY(state: ConfigState, sessionKey: string | undefined) {
    state.lastSessionKey = sessionKey
  },
  SET_SIDEBAR_WIDTH(state: ConfigState, width: number) {
    state.sidebarWidth = Math.max(200, Math.min(800, width))
  }
}

const actions = {
  /**
   * 加载配置
   */
  async loadConfig({ commit }: any) {
    try {
      const config = await getConfig()
      commit('SET_GATEWAY', config.gateway)
      commit('SET_SESSIONS_EXPANDED', config.sessionsExpanded ?? true)
      commit('SET_LAST_SESSION_KEY', config.lastSessionKey)
    } catch (error) {
      console.error('Failed to load config:', error)
    }
  },

  /**
   * 保存配置
   */
  async save({ state }: any) {
    try {
      const success = await saveConfig({
        gateway: state.gateway,
        sessionsExpanded: state.sessionsExpanded,
        lastSessionKey: state.lastSessionKey
      })
      return success
    } catch (error) {
      console.error('Failed to save config:', error)
      return false
    }
  },

  /**
   * 更新 Gateway 配置
   */
  async updateGateway({ commit, dispatch }: any, config: { url: string; token?: string; password?: string }) {
    commit('SET_GATEWAY', config)
    return await dispatch('save')
  },

  /**
   * 更新最后使用的会话
   */
  async updateLastSession({ commit, dispatch }: any, sessionKey: string) {
    commit('SET_LAST_SESSION_KEY', sessionKey)
    await dispatch('save')
  },

  /**
   * 切换会话列表展开状态
   */
  async toggleSessionsExpanded({ state, commit, dispatch }: any) {
    commit('SET_SESSIONS_EXPANDED', !state.sessionsExpanded)
    await dispatch('save')
  },

  /**
   * 设置会话列表展开状态
   */
  async setSessionsExpanded({ commit, dispatch }: any, expanded: boolean) {
    commit('SET_SESSIONS_EXPANDED', expanded)
    await dispatch('save')
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
