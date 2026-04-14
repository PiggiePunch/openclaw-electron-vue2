/**
 * Gateway 状态管理 - Vuex Module
 */

import type { GatewayState, GatewayHello } from '@/types/gateway'
import { connectGateway, disconnectGateway, isConnected, onConnected, onDisconnected, onEvent } from '@/api/gateway'

const state: GatewayState = {
  connected: false,
  connecting: false,
  error: null,
  hello: null
}

const getters = {
  isConnected: (state: GatewayState) => state.connected && !state.connecting,
  hasError: (state: GatewayState) => !!state.error,
  errorMessage: (state: GatewayState) => state.error || '',
  serverTime: (state: GatewayState) => state.hello?.serverTime || 0,
  version: (state: GatewayState) => state.hello?.version || ''
}

const mutations = {
  SET_CONNECTED(state: GatewayState, connected: boolean) {
    state.connected = connected
  },
  SET_CONNECTING(state: GatewayState, connecting: boolean) {
    state.connecting = connecting
  },
  SET_ERROR(state: GatewayState, error: string | null) {
    state.error = error
  },
  SET_HELLO(state: GatewayState, hello: GatewayHello | null) {
    state.hello = hello
  },
  CLEAR_ERROR(state: GatewayState) {
    state.error = null
  }
}

const actions = {
  /**
   * 连接到 Gateway
   */
  async connect({ commit }: any, { url, token, password }: { url: string; token?: string; password?: string }) {
    commit('SET_CONNECTING', true)
    commit('CLEAR_ERROR')

    try {
      await connectGateway({ url, token, password })

      // 检查连接状态
      const connected = await isConnected()
      commit('SET_CONNECTED', connected)

      if (!connected) {
        throw new Error('连接超时')
      }

      return true
    } catch (error: any) {
      commit('SET_ERROR', error.message || '连接失败')
      commit('SET_CONNECTED', false)
      return false
    } finally {
      commit('SET_CONNECTING', false)
    }
  },

  /**
   * 断开连接
   */
  async disconnect({ commit }: any) {
    try {
      await disconnectGateway()
      commit('SET_CONNECTED', false)
      commit('SET_HELLO', null)
      commit('CLEAR_ERROR')
    } catch (error: any) {
      console.error('Failed to disconnect:', error)
      commit('SET_ERROR', error.message || '断开连接失败')
    }
  },

  /**
   * 处理连接成功事件
   */
  handleConnected({ commit }: any, hello: GatewayHello) {
    commit('SET_CONNECTED', true)
    commit('SET_CONNECTING', false)
    commit('SET_HELLO', hello)
    commit('CLEAR_ERROR')
  },

  /**
   * 处理断开连接事件
   */
  handleDisconnected({ commit }: any, reason?: string) {
    commit('SET_CONNECTED', false)
    commit('SET_CONNECTING', false)
    if (reason) {
      commit('SET_ERROR', reason)
    }
  },

  /**
   * 设置错误状态
   */
  setError({ commit }: any, error: string | null) {
    commit('SET_ERROR', error)
  },

  /**
   * 清除错误状态
   */
  clearError({ commit }: any) {
    commit('CLEAR_ERROR')
  },

  /**
   * 初始化事件监听器
   */
  initializeEventListeners({ dispatch }: any) {
    onConnected((hello) => {
      dispatch('handleConnected', hello)
    })

    onDisconnected((reason) => {
      dispatch('handleDisconnected', reason)
    })

    onEvent((event) => {
      console.log('Gateway event:', event)
      dispatch('handleGatewayEvent', event)
    })
  },

  async handleGatewayEvent({ dispatch }: any, event: any) {
    console.log('🔍🔍🔍 Gateway event received:', event.event)
    console.log(`  - event.event: ${event.event}`)
    console.log(`  - event.payload keys:`, event.payload ? Object.keys(event.payload) : 'null')

    // 处理 chat 事件（OpenClaw Gateway 的流式消息）
    if (event.event === 'chat' && event.payload) {
      const payload = event.payload
      console.log('✅✅✅ Processing chat event')
      console.log(`   - runId: ${payload.runId}`)
      console.log(`   - state: ${payload.state}`)
      console.log(`   - seq: ${payload.seq}`)

      // Handle chat messages from gateway
      dispatch('chat/handleChatMessage', payload, { root: true })
      return
    }

    // 处理 agent 事件（包含 runId、seq、stream 等字段的事件）
    if (event.event === 'agent' && event.payload) {
      const payload = event.payload
      console.log('✅✅✅ Processing agent event')
      console.log(`   - runId: ${payload.runId}`)
      console.log(`   - stream: ${payload.stream}`)
      console.log(`   - seq: ${payload.seq}`)

      // 将 agent 事件传递给 chatStore 处理
      dispatch('chat/handleAgentEvent', payload, { root: true })
      return
    }

    // 处理 session.tool 事件（工具事件）
    if (event.event === 'session.tool' && event.payload) {
      const payload = event.payload
      console.log('✅✅✅ Processing session.tool event')
      console.log(`   - runId: ${payload.runId}`)
      console.log(`   - stream: ${payload.stream}`)

      // session.tool 事件实际上也是 agent 事件，使用相同的处理方式
      dispatch('chat/handleAgentEvent', payload, { root: true })
      return
    }

    // 如果事件类型未知，记录警告
    console.warn(`⚠️ Unknown or unhandled event type: ${event.event}`)
    console.warn(`   Payload:`, event.payload)

    // 尝试检查是否是工具相关事件
    if (event.payload && typeof event.payload === 'object') {
      console.warn(`   Payload keys:`, Object.keys(event.payload))
      console.warn(`   Payload details:`, JSON.stringify(event.payload, null, 2).substring(0, 500))
    }
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}
