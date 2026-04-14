/**
 * 日志状态管理 - Vuex Module
 */

import type { LogsState, LogEntry, LogLevel } from '@/types/logs'
import { getLogs, clearLogs as clearLogsApi } from '@/api/logs'

const state: LogsState = {
  logs: [],
  filter: '',
  limit: 500,
  loading: false
}

const getters = {
  filteredLogs: (state: LogsState) => {
    let filtered = state.logs

    if (state.filter) {
      filtered = filtered.filter(log => log.level === state.filter)
    }

    return filtered.slice(0, state.limit)
  },

  hasLogs: (state: LogsState) => state.logs.length > 0,

  logCount: (state: LogsState) => state.logs.length,

  filteredLogCount: (state: LogsState) => {
    let count = state.logs.length
    if (state.filter) {
      count = state.logs.filter(log => log.level === state.filter).length
    }
    return Math.min(count, state.limit)
  }
}

const mutations = {
  SET_LOGS(state: LogsState, logs: LogEntry[]) {
    state.logs = logs
  },
  SET_FILTER(state: LogsState, level: LogLevel | '') {
    state.filter = level
  },
  SET_LIMIT(state: LogsState, limit: number) {
    state.limit = Math.max(10, Math.min(5000, limit))
  },
  SET_LOADING(state: LogsState, loading: boolean) {
    state.loading = loading
  },
  CLEAR_LOGS(state: LogsState) {
    state.logs = []
  }
}

const actions = {
  /**
   * 加载日志
   */
  async loadLogs({ commit, state }: any) {
    try {
      commit('SET_LOADING', true)
      const logs = await getLogs({
        level: state.filter || undefined,
        limit: state.limit
      })
      commit('SET_LOGS', logs)
    } catch (error: any) {
      console.error('Failed to load logs:', error)
      throw error
    } finally {
      commit('SET_LOADING', false)
    }
  },

  /**
   * 刷新日志
   */
  async refresh({ dispatch }: any) {
    await dispatch('loadLogs')
  },

  /**
   * 清除日志
   */
  async clearLogs({ commit }: any) {
    try {
      const success = await clearLogsApi()
      if (success) {
        commit('CLEAR_LOGS')
      }
      return success
    } catch (error: any) {
      console.error('Failed to clear logs:', error)
      return false
    }
  },

  /**
   * 设置过滤器
   */
  setFilter({ commit }: any, level: LogLevel | '') {
    commit('SET_FILTER', level)
  },

  /**
   * 设置限制
   */
  setLimit({ commit }: any, limit: number) {
    commit('SET_LIMIT', limit)
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}
