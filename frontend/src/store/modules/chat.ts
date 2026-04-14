/**
 * 聊天状态管理 - Vuex Module
 *
 * 从Pinia迁移到Vuex，保留所有原有逻辑
 */

import Vue from 'vue'
import type { ChatState, Message, Session } from '@/types/chat'
import { sendMessage, getChatHistory, listSessions, deleteSession as deleteSessionApi, patchSession, abortChat } from '@/api/chat'

const state: ChatState = {
  sessions: [],
  currentSessionKey: null,
  messages: {},
  thinkingMessageId: null,
  streamingMessageId: null,
  streamingTimeout: null as number | null,
  loading: false,
  currentRunId: null,
  isSending: false,
  processedEvents: {} as Record<string, boolean>
}

const getters = {
  currentMessages: (state: ChatState) => {
    if (!state.currentSessionKey) return []
    return state.messages[state.currentSessionKey] || []
  },
  currentSession: (state: ChatState) => {
    if (!state.currentSessionKey) return null
    return state.sessions.find(s => s.key === state.currentSessionKey) || null
  },
  hasCurrentSession: (state: ChatState) => !!state.currentSessionKey,
  sessionCount: (state: ChatState) => state.sessions.length
}

const mutations = {
  SET_SESSIONS(state: ChatState, sessions: Session[]) {
    state.sessions = sessions
  },
  SET_CURRENT_SESSION_KEY(state: ChatState, sessionKey: string | null) {
    state.currentSessionKey = sessionKey
  },
  SET_MESSAGES(state: ChatState, payload: { sessionKey: string; messages: Message[] }) {
    Vue.set(state.messages, payload.sessionKey, payload.messages)
  },
  ADD_MESSAGE(state: ChatState, payload: { sessionKey: string; message: Message }) {
    if (!state.messages[payload.sessionKey]) {
      Vue.set(state.messages, payload.sessionKey, [])
    }
    state.messages[payload.sessionKey].push(payload.message)
  },
  UPDATE_MESSAGE(state: ChatState, payload: { sessionKey: string; messageId: string; updates: Partial<Message> }) {
    if (!state.messages[payload.sessionKey]) return
    const index = state.messages[payload.sessionKey].findIndex(m => m.id === payload.messageId)
    if (index !== -1) {
      Vue.set(state.messages[payload.sessionKey], index, {
        ...state.messages[payload.sessionKey][index],
        ...payload.updates
      })
    }
  },
  SPLICE_MESSAGE(state: ChatState, payload: { sessionKey: string; index: number; message: Message }) {
    if (!state.messages[payload.sessionKey]) return
    state.messages[payload.sessionKey].splice(payload.index, 1, payload.message)
  },
  REMOVE_SESSION(state: ChatState, sessionKey: string) {
    state.sessions = state.sessions.filter(s => s.key !== sessionKey)
    if (state.currentSessionKey === sessionKey) {
      state.currentSessionKey = null
    }
    Vue.delete(state.messages, sessionKey)
  },
  UPDATE_SESSION(state: ChatState, payload: { sessionKey: string; patch: any }) {
    const index = state.sessions.findIndex(s => s.key === payload.sessionKey)
    if (index !== -1) {
      Vue.set(state.sessions, index, {
        ...state.sessions[index],
        ...payload.patch
      })
    }
  },
  ADD_SESSION(state: ChatState, session: Session) {
    state.sessions.unshift(session)
  },
  SET_THINKING_MESSAGE_ID(state: ChatState, messageId: string | null) {
    state.thinkingMessageId = messageId
  },
  SET_STREAMING_MESSAGE_ID(state: ChatState, messageId: string | null) {
    state.streamingMessageId = messageId
  },
  SET_LOADING(state: ChatState, loading: boolean) {
    state.loading = loading
  },
  SET_CURRENT_RUN_ID(state: ChatState, runId: string | null) {
    state.currentRunId = runId
  },
  SET_IS_SENDING(state: ChatState, isSending: boolean) {
    state.isSending = isSending
  },
  SET_STREAMING_TIMEOUT(state: ChatState, timeout: number | null) {
    state.streamingTimeout = timeout
  },
  SET_PROCESSED_EVENT(state: ChatState, payload: { key: string; value: boolean }) {
    Vue.set(state.processedEvents, payload.key, payload.value)
  },
  DELETE_PROCESSED_EVENT(state: ChatState, key: string) {
    Vue.delete(state.processedEvents, key)
  },
  CLEAR_STREAMING_STATE(state: ChatState) {
    if (state.streamingMessageId) {
      console.log('💬 Streaming completed, clearing streamingMessageId')
      state.streamingMessageId = null
    }
    if (state.streamingTimeout) {
      clearTimeout(state.streamingTimeout)
      state.streamingTimeout = null
    }
    state.isSending = false
    state.currentRunId = null
  }
}

const actions = {
  /**
   * 检查事件是否已处理（去重机制）
   */
  isEventProcessed({ state, commit }: any, { eventType, runId, seq }: { eventType: string; runId: string; seq: number }): boolean {
    const key = `${runId}-${seq}`

    if (state.processedEvents[key]) {
      console.log(`⚠️ Event already processed, skipping: ${key} (type: ${eventType})`)
      return true
    }

    commit('SET_PROCESSED_EVENT', { key, value: true })

    // 清理旧的事件记录（只保留最近1000个）
    const keys = Object.keys(state.processedEvents)
    if (keys.length > 1000) {
      const toDelete = keys.slice(0, keys.length - 1000)
      toDelete.forEach(k => commit('DELETE_PROCESSED_EVENT', k))
    }

    console.log(`✅ Event marked as processed: ${key} (type: ${eventType})`)
    return false
  },

  /**
   * 清理已完成run的所有事件记录
   */
  clearProcessedEventsForRun({ state, commit }: any, runId: string) {
    Object.keys(state.processedEvents).forEach(key => {
      if (key.startsWith(`${runId}-`)) {
        commit('DELETE_PROCESSED_EVENT', key)
      }
    })
  },

  /**
   * 加载会话列表
   */
  async loadSessions({ commit }: any) {
    try {
      commit('SET_LOADING', true)
      const response = await listSessions()

      let sessionsData = response
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        const resp = response as { sessions?: any; data?: any; items?: any }
        sessionsData = resp.sessions || resp.data || []
      }

      const sessions = Array.isArray(sessionsData)
        ? sessionsData.map((s: any) => ({
            key: s.key || s.sessionKey || s.id || '',
            label: s.label || s.title || s.name || s.key || 'Untitled',
            agentId: s.agentId || s.agent_id || s.agent || undefined,
            createdAt: s.createdAt || s.created_at || s.created || undefined,
            updatedAt: s.updatedAt || s.updated_at || s.updated || undefined,
            messageCount: s.messageCount || s.message_count || s.msgCount || s.messages || undefined,
            lastMessageAt: s.lastMessageAt || s.last_message_at || s.lastActivity || undefined,
            lastMessage: s.lastMessage || s.last_message || s.preview || undefined,
            metadata: s.metadata || s.meta || {},
            status: s.status || 'active'
          }))
        : []

      commit('SET_SESSIONS', sessions)
    } catch (error: any) {
      console.error('Failed to load sessions:', error)
      throw error
    } finally {
      commit('SET_LOADING', false)
    }
  },

  /**
   * 加载会话消息
   */
  async loadMessages({ commit, state }: any, sessionKey: string) {
    if (!state.messages[sessionKey]) {
      commit('SET_MESSAGES', { sessionKey, messages: [] })
    }

    try {
      commit('SET_LOADING', true)
      const response = await getChatHistory(sessionKey)
      console.log('Raw chat history response from Gateway:', response)

      let messagesData = response
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        const resp = response as { messages?: any; data?: any; items?: any }
        messagesData = resp.messages || resp.data || resp.items || []
      }

      const messages = Array.isArray(messagesData)
        ? messagesData.map((msg: any) => {
            let content = msg.content || msg.text || msg.body || msg.message || ''
            if (Array.isArray(content)) {
              content = content.map((part: any) => {
                if (typeof part === 'string') return part
                if (part && typeof part === 'object') {
                  if (part.type === 'text' && part.text) return part.text
                  if (part.type === 'image_url') return '[图片]'
                  if (part.type === 'tool_use' || part.type === 'tool_use_call') return `[工具调用: ${part.name || part.id || 'unknown'}]`
                  if (part.type === 'tool_result') return `[工具结果]`
                  if (part.content) return part.content
                  if (part.text) return part.text
                  if (part.type) return `[${part.type}]`
                  return ''
                }
                return String(part)
              }).filter(Boolean).join('')
            }

            return {
              id: msg.id || msg.messageId || msg.msgId || `msg-${Date.now()}-${Math.random()}`,
              role: msg.role || msg.sender || msg.type || 'user',
              content: content,
              timestamp: msg.timestamp || msg.createdAt || msg.created_at || msg.time || Date.now(),
              createdAt: msg.createdAt || msg.created_at || msg.timestamp || Date.now(),
              status: msg.status || 'sent',
              attachments: msg.attachments || [],
              metadata: msg.metadata || msg.meta || {}
            }
          })
        : []

      commit('SET_MESSAGES', { sessionKey, messages })
      console.log(`Loaded ${messages.length} messages for session ${sessionKey}`)
    } catch (error: any) {
      console.error('Failed to load messages:', error)
      throw error
    } finally {
      commit('SET_LOADING', false)
    }
  },

  /**
   * 发送消息
   */
  async sendMessage({ commit, state }: any, { sessionKey, content, attachments }: { sessionKey: string; content: string; attachments?: any[] }) {
    console.log('Sending message to session:', sessionKey)
    console.log('Current session key:', state.currentSessionKey)
    try {
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
        status: 'sent',
        attachments
      }

      if (!state.messages[sessionKey]) {
        commit('SET_MESSAGES', { sessionKey, messages: [] })
      }
      commit('ADD_MESSAGE', { sessionKey, message: userMessage })

      commit('SET_STREAMING_MESSAGE_ID', null)
      commit('SET_THINKING_MESSAGE_ID', `thinking-${Date.now()}`)
      commit('SET_IS_SENDING', true)

      const runId = await sendMessage({ sessionKey, message: content, attachments })
      console.log('Message sent, runId:', runId)

      commit('SET_CURRENT_RUN_ID', runId)

      return runId
    } catch (error: any) {
      console.error('Failed to send message:', error)
      commit('SET_THINKING_MESSAGE_ID', null)
      commit('SET_IS_SENDING', false)
      commit('SET_CURRENT_RUN_ID', null)
      throw error
    }
  },

  /**
   * 取消当前聊天
   */
  async abortCurrentChat({ commit, state }: any) {
    if (!state.currentSessionKey) {
      console.warn('No current session to abort')
      return false
    }

    try {
      await abortChat(state.currentSessionKey, state.currentRunId || undefined)
      console.log('Chat aborted successfully')

      commit('CLEAR_STREAMING_STATE')
      commit('SET_THINKING_MESSAGE_ID', null)
      commit('SET_IS_SENDING', false)
      commit('SET_CURRENT_RUN_ID', null)

      return true
    } catch (error: any) {
      console.error('Failed to abort chat:', error)
      throw error
    }
  },

  /**
   * 设置当前会话
   */
  setCurrentSession({ commit }: any, sessionKey: string | null) {
    commit('SET_CURRENT_SESSION_KEY', sessionKey)
  },

  /**
   * 删除会话
   */
  async deleteSession({ commit, state }: any, { sessionKey, deleteTranscript }: { sessionKey: string; deleteTranscript?: boolean }) {
    try {
      await deleteSessionApi(sessionKey, deleteTranscript)
      commit('REMOVE_SESSION', sessionKey)
    } catch (error: any) {
      console.error('Failed to delete session:', error)
      throw error
    }
  },

  /**
   * 更新会话
   */
  async updateSession({ commit }: any, { sessionKey, patch }: { sessionKey: string; patch: any }) {
    try {
      await patchSession(sessionKey, patch)
      commit('UPDATE_SESSION', { sessionKey, patch })
    } catch (error: any) {
      console.error('Failed to update session:', error)
      throw error
    }
  },

  /**
   * 添加本地会话（不调用 API）
   */
  addSession({ commit }: any, session: Session) {
    commit('ADD_SESSION', session)
  },

  /**
   * 启动流式超时
   */
  startStreamingTimeout({ commit, state }: any) {
    if (state.streamingTimeout) {
      clearTimeout(state.streamingTimeout)
    }
    const timeout = setTimeout(() => {
      console.warn('⚠️ Streaming timeout after 60s - server may have crashed')
      console.warn('   Force clearing streaming state as fallback')
      console.warn('   Current runId:', state.currentRunId)
      commit('CLEAR_STREAMING_STATE')
    }, 60000) as unknown as number
    commit('SET_STREAMING_TIMEOUT', timeout)
    console.log('⏱️ Started 60s streaming timeout as safety fallback')
  },

  /**
   * 处理流式消息内容
   */
  appendStreamContent({ commit, state }: any, { sessionKey, messageId, content }: { sessionKey: string; messageId: string; content: string }) {
    if (!state.messages[sessionKey]) return

    const index = state.messages[sessionKey].findIndex((m: Message) => m.id === messageId)
    if (index !== -1) {
      const message = {
        ...state.messages[sessionKey][index],
        content: state.messages[sessionKey][index].content + content
      }
      commit('SPLICE_MESSAGE', { sessionKey, index, message })
    }
  },

  /**
   * 处理 Gateway 发来的 agent 事件
   */
  async handleAgentEvent({ dispatch, state, commit }: any, payload: any) {
    console.log('=== Handling agent event ===', payload)
    const { runId, seq, stream, ts, data, sessionKey: payloadSessionKey } = payload

    console.log(`📋 Agent event details:`)
    console.log(`  - runId: ${runId}`)
    console.log(`  - stream: ${stream}`)
    console.log(`  - seq: ${seq}`)

    if (stream === 'assistant') {
      console.log(`   - ⚠️ Ignoring agent assistant stream (duplicate of chat event)`)
      return
    }

    if (await dispatch('isEventProcessed', { eventType: `agent-${stream}`, runId, seq })) {
      console.log(`   - Skipping duplicate ${stream} event ${runId}-${seq}`)
      return
    }

    let targetSessionKey = payloadSessionKey || state.currentSessionKey
    if (!targetSessionKey) {
      console.warn('No session key for agent event')
      return
    }

    if (!state.messages[targetSessionKey]) {
      commit('SET_MESSAGES', { sessionKey: targetSessionKey, messages: [] })
    }

    if (stream === 'tool') {
      dispatch('handleToolStreamEvent', { runId, seq, ts, data, sessionKey: targetSessionKey })
    } else if (stream === 'lifecycle') {
      dispatch('handleLifecycleEvent', { runId, seq, ts, data, sessionKey: targetSessionKey })
    } else if (stream === 'error') {
      console.error('Agent error event:', data)
      dispatch('createAgentErrorMessage', { sessionKey: targetSessionKey, runId, errorData: data })
    }
  },

  /**
   * 处理 assistant 流式事件
   */
  handleAssistantStreamEvent({ commit, state }: any, params: { runId: string; seq: number; ts: number; data: any; sessionKey: string }) {
    const { runId, data, sessionKey, seq } = params
    const text = data?.text || ''
    const delta = data?.delta || ''

    console.log(`📝 Assistant stream: runId=${runId}, seq=${seq}`)

    if (!state.messages[sessionKey]) {
      commit('SET_MESSAGES', { sessionKey, messages: [] })
    }

    const content = delta || text
    if (!content) {
      console.log(`   - No content to display`)
      return
    }

    const messageId = `${runId}-text`
    const existingIndex = state.messages[sessionKey].findIndex((m: Message) => m.id === messageId)

    commit('SET_THINKING_MESSAGE_ID', null)
    if (state.currentRunId === runId) {
      commit('SET_STREAMING_MESSAGE_ID', messageId)
    }

    if (existingIndex !== -1) {
      const appendedContent = (state.messages[sessionKey][existingIndex].content + content)
      const updatedMessage = {
        ...state.messages[sessionKey][existingIndex],
        content: appendedContent,
        timestamp: Date.now(),
        status: 'streaming' as const
      }
      commit('SPLICE_MESSAGE', { sessionKey, index: existingIndex, message: updatedMessage })
    } else {
      const newMessage: Message = {
        id: messageId,
        role: 'assistant',
        content: content,
        timestamp: Date.now(),
        status: 'streaming',
        metadata: {
          contentType: 'text',
          seq,
          source: 'assistant_stream'
        }
      }
      commit('ADD_MESSAGE', { sessionKey, message: newMessage })
    }
  },

  /**
   * 处理 tool 流式事件
   */
  handleToolStreamEvent({ commit, state }: any, params: { runId: string; seq: number; ts: number; data: any; sessionKey: string }) {
    const { runId, data, sessionKey, seq } = params
    const phase = data?.phase
    const tool = data?.tool || data?.name || 'unknown_tool'
    const toolTitle = data?.toolTitle || tool
    const kind = data?.kind
    const toolCallId = data?.toolCallId || String(seq)

    console.log(`🔧🔧🔧 Tool stream: runId=${runId}, seq=${seq}, phase=${phase}, tool=${tool}`)

    if (!state.messages[sessionKey]) {
      commit('SET_MESSAGES', { sessionKey, messages: [] })
    }

    const messageId = `${runId}-tool-${seq}`
    const existingIndex = state.messages[sessionKey].findIndex((m: Message) => m.id === messageId)

    if (phase === 'start') {
      if (existingIndex === -1) {
        const args = data?.args
        const newMessage: Message = {
          id: messageId,
          role: 'system',
          content: '',
          timestamp: Date.now(),
          status: 'streaming' as const,
          metadata: {
            type: 'tool_call' as const,
            toolName: tool,
            toolCallId,
            phase: 'start' as const,
            args,
            toolTitle,
            kind
          }
        }
        commit('ADD_MESSAGE', { sessionKey, message: newMessage })
      }
    } else if (phase === 'update') {
      if (existingIndex !== -1) {
        const partialResult = data?.partialResult
        const updatedMessage = {
          ...state.messages[sessionKey][existingIndex],
          content: '',
          timestamp: Date.now(),
          status: 'streaming' as const,
          metadata: {
            ...state.messages[sessionKey][existingIndex].metadata,
            phase: 'update' as const,
            partialResult
          }
        }
        commit('SPLICE_MESSAGE', { sessionKey, index: existingIndex, message: updatedMessage })
      }
    } else if (phase === 'result') {
      const isError = data?.isError === true
      const result = data?.result
      const error = data?.error || data?.errorMessage

      if (existingIndex !== -1) {
        const updatedMessage = {
          ...state.messages[sessionKey][existingIndex],
          content: '',
          timestamp: Date.now(),
          status: isError ? ('error' as const) : ('sent' as const),
          metadata: {
            ...state.messages[sessionKey][existingIndex].metadata,
            phase: 'result' as const,
            result,
            error,
            isError
          }
        }
        commit('SPLICE_MESSAGE', { sessionKey, index: existingIndex, message: updatedMessage })
      } else {
        const newMessage: Message = {
          id: messageId,
          role: 'system',
          content: '',
          timestamp: Date.now(),
          status: isError ? ('error' as const) : ('sent' as const),
          metadata: {
            type: isError ? ('tool_error' as const) : ('tool_result' as const),
            toolName: tool,
            toolCallId,
            toolTitle,
            result,
            error,
            phase: 'result' as const,
            isError
          }
        }
        commit('ADD_MESSAGE', { sessionKey, message: newMessage })
      }
    }
  },

  /**
   * 处理 lifecycle 事件
   */
  handleLifecycleEvent({ commit, dispatch, state }: any, params: { runId: string; seq: number; ts: number; data: any; sessionKey: string }) {
    const { runId, data, sessionKey } = params
    const phase = data?.phase

    console.log(`🔄 Lifecycle event: runId=${runId}, phase=${phase}`)

    if (phase === 'start') {
      console.log('📌 Agent run started:', runId)
      dispatch('startStreamingTimeout')
    } else if (phase === 'end' || phase === 'error') {
      commit('SET_STREAMING_MESSAGE_ID', null)
      commit('SET_THINKING_MESSAGE_ID', null)

      console.log(`🏁 Agent run ${phase}: ${runId}`)

      const messagesToUpdate: Array<{ index: number; message: Message }> = []

      state.messages[sessionKey].forEach((msg: Message, index: number) => {
        if (msg.id.startsWith(runId) && msg.status === 'streaming') {
          messagesToUpdate.push({
            index,
            message: {
              ...msg,
              status: (phase === 'error' ? 'error' : 'sent') as 'error' | 'sent',
              timestamp: Date.now()
            }
          })
        }
      })

      messagesToUpdate.reverse().forEach(({ index, message }) => {
        commit('SPLICE_MESSAGE', { sessionKey, index, message })
      })

      dispatch('clearProcessedEventsForRun', runId)
      commit('CLEAR_STREAMING_STATE')
      console.log('🏁 Agent run ended:', runId)
    }
  },

  /**
   * 创建 Agent 错误消息
   */
  createAgentErrorMessage({ commit }: any, { sessionKey, runId, errorData }: { sessionKey: string; runId: string; errorData: any }) {
    const errorMessage: Message = {
      id: `${runId}-error`,
      role: 'system',
      content: `❌ Agent 执行错误\n${errorData?.error || errorData?.message || '未知错误'}`,
      timestamp: Date.now(),
      status: 'error',
      metadata: {
        type: 'agent_error',
        runId,
        errorData
      }
    }

    if (!state.messages[sessionKey]) {
      commit('SET_MESSAGES', { sessionKey, messages: [] })
    }

    commit('ADD_MESSAGE', { sessionKey, message: errorMessage })
  },

  /**
   * 处理 Gateway 发来的 chat 事件
   */
  async handleChatMessage({ dispatch, state, commit }: any, payload: any) {
    console.log('=== Handling chat message ===', payload)

    if (payload.runId && payload.state) {
      dispatch('handleStreamingChatEvent', payload)
      return
    }

    console.log('Handling legacy message format')
    dispatch('handleLegacyChatMessage', payload)
  },

  /**
   * 处理 OpenClaw Gateway 的流式聊天事件
   */
  async handleStreamingChatEvent({ dispatch, state, commit }: any, payload: any) {
    const { runId, sessionKey, seq, state: msgState, message, stopReason } = payload

    console.log(`📨📨📨 Chat event: runId=${runId}, seq=${seq}, state=${msgState}`)

    if (await dispatch('isEventProcessed', { eventType: 'chat', runId, seq })) {
      console.log(`   - Skipping duplicate chat event ${runId}-${seq}`)
      return
    }

    console.log(`   - ✅ Processing chat event ${runId}-${seq}`)

    const targetSessionKey = sessionKey || state.currentSessionKey
    if (!targetSessionKey) {
      console.warn('No session key for message')
      return
    }

    if (!state.messages[targetSessionKey]) {
      commit('SET_MESSAGES', { sessionKey: targetSessionKey, messages: [] })
    }

    const newContent = dispatch('extractMessageContent', message)
    const contentType = dispatch('detectContentType', newContent)

    console.log(`   - Raw message:`, JSON.stringify(message).substring(0, 200))
    console.log(`   - Extracted content: "${newContent.substring(0, 100)}..."`)
    console.log(`   - Content type: ${contentType}`)

    const messageId = `${runId}-${contentType}`
    const existingIndex = state.messages[targetSessionKey].findIndex((m: Message) => m.id === messageId)

    if (msgState === 'delta') {
      commit('SET_THINKING_MESSAGE_ID', null)

      if (contentType === 'text' && state.currentRunId === runId) {
        commit('SET_STREAMING_MESSAGE_ID', messageId)
      }

      if (existingIndex !== -1) {
        const currentContent = state.messages[targetSessionKey][existingIndex].content
        const appendedContent = dispatch('appendTextContent', { previous: currentContent, next: newContent })

        console.log(`📝 Appending to message ${messageId}:`)

        const updatedMessage = {
          ...state.messages[targetSessionKey][existingIndex],
          content: appendedContent,
          timestamp: message?.timestamp || Date.now(),
          status: 'streaming' as const
        }
        commit('SPLICE_MESSAGE', { sessionKey: targetSessionKey, index: existingIndex, message: updatedMessage })
      } else {
        const newMessage: Message = {
          id: messageId,
          role: message?.role || 'assistant',
          content: newContent,
          timestamp: message?.timestamp || Date.now(),
          status: 'streaming',
          metadata: {
            contentType,
            seq
          }
        }

        commit('ADD_MESSAGE', { sessionKey: targetSessionKey, message: newMessage })
      }
    } else if (msgState === 'final') {
      console.log(`✅ Finalizing all messages for run ${runId}`)

      commit('SET_STREAMING_MESSAGE_ID', null)
      commit('SET_THINKING_MESSAGE_ID', null)
      commit('SET_IS_SENDING', false)
      commit('SET_CURRENT_RUN_ID', null)

      const messagesToUpdate: Array<{ index: number; message: Message }> = []

      state.messages[targetSessionKey].forEach((msg: Message, index: number) => {
        if (msg.id.startsWith(runId) && msg.status === 'streaming') {
          messagesToUpdate.push({
            index,
            message: {
              ...msg,
              status: 'sent' as const,
              timestamp: message?.timestamp || Date.now()
            }
          })
        }
      })

      messagesToUpdate.reverse().forEach(({ index, message }) => {
        commit('SPLICE_MESSAGE', { sessionKey: targetSessionKey, index, message })
      })

      dispatch('clearProcessedEventsForRun', runId)
    } else if (msgState === 'error') {
      console.error(`❌ Error in run ${runId}:`, payload.errorMessage)

      commit('SET_STREAMING_MESSAGE_ID', null)
      commit('SET_THINKING_MESSAGE_ID', null)
      commit('SET_IS_SENDING', false)
      commit('SET_CURRENT_RUN_ID', null)

      state.messages[targetSessionKey].forEach((msg: Message, index: number) => {
        if (msg.id.startsWith(runId)) {
          const updatedMessage = {
            ...msg,
            status: 'error' as const,
            metadata: {
              ...msg.metadata,
              errorMessage: payload.errorMessage
            }
          }
          commit('SPLICE_MESSAGE', { sessionKey: targetSessionKey, index, message: updatedMessage })
        }
      })
      dispatch('clearProcessedEventsForRun', runId)
    } else if (msgState === 'aborted') {
      console.log(`⏹️ Run ${runId} aborted`)

      commit('SET_STREAMING_MESSAGE_ID', null)
      commit('SET_THINKING_MESSAGE_ID', null)
      commit('SET_IS_SENDING', false)
      commit('SET_CURRENT_RUN_ID', null)

      state.messages[targetSessionKey].forEach((msg: Message, index: number) => {
        if (msg.id.startsWith(runId) && msg.status === 'streaming') {
          const updatedMessage = {
            ...msg,
            status: 'sent' as const,
            metadata: {
              ...msg.metadata,
              aborted: true
            }
          }
          commit('SPLICE_MESSAGE', { sessionKey: targetSessionKey, index, message: updatedMessage })
        }
      })
      dispatch('clearProcessedEventsForRun', runId)
    }
  },

  /**
   * 从消息对象中提取文本内容
   */
  extractMessageContent(_: any, message: any): string {
    if (!message) return ''

    let content = message.content || message.text || ''

    if (Array.isArray(content)) {
      content = content.map((part: any) => {
        if (typeof part === 'string') return part
        if (part && typeof part === 'object') {
          if (part.type === 'text' && part.text) return part.text
          if (part.type === 'image_url') return '[图片]'
          if (part.type === 'tool_use' || part.type === 'tool_use_call') return `[工具调用: ${part.name || part.id || 'unknown'}]`
          if (part.type === 'tool_result') return `[工具结果]`
          if (part.type === 'thinking') return `[thinking]`
          if (part.content) return part.content
          if (part.text) return part.text
          if (part.type) return `[${part.type}]`
          return ''
        }
        return String(part)
      }).filter(Boolean).join('')
    }

    return content
  },

  /**
   * 检测消息内容的类型
   */
  detectContentType(_: any, content: string): 'tool_call' | 'tool_result' | 'thinking' | 'text' {
    if (!content) return 'text'

    if (content.includes('[工具调用:') || content.includes('[toolCall]')) {
      return 'tool_call'
    }
    if (content.includes('[工具结果]') || content.includes('[toolResult]')) {
      return 'tool_result'
    }
    if (content.includes('[thinking]')) {
      return 'thinking'
    }
    return 'text'
  },

  /**
   * 追加文本内容，处理重复内容
   */
  appendTextContent(_: any, { previous, next }: { previous: string; next: string }): string {
    if (!previous) return next
    if (!next) return previous

    if (next.startsWith(previous)) {
      console.log(`   [appendTextContent] Complete replacement: next contains previous`)
      return next
    }

    if (previous.startsWith(next)) {
      console.log(`   [appendTextContent] Duplicate event, ignoring next`)
      return previous
    }

    const overlapIndex = previous.indexOf(next.substring(0, Math.min(50, next.length)))
    if (overlapIndex !== -1 && overlapIndex > previous.length * 0.5) {
      const newContent = next.substring(previous.length - overlapIndex)
      if (newContent && newContent !== next) {
        console.log(`   [appendTextContent] Appending增量: found overlap at ${overlapIndex}`)
        return previous + newContent
      }
    }

    const reverseOverlapIndex = next.indexOf(previous.substring(previous.length - 50))
    if (reverseOverlapIndex !== -1) {
      const newContent = next.substring(previous.length - reverseOverlapIndex)
      if (newContent && newContent !== next) {
        console.log(`   [appendTextContent] Appending增量: reverse overlap`)
        return previous + newContent
      }
    }

    console.log(`   [appendTextContent] Direct append (no overlap detected)`)
    return previous + next
  },

  /**
   * 处理旧格式的聊天消息（向后兼容）
   */
  handleLegacyChatMessage({ commit, state }: any, payload: any) {
    console.log('=== Handling legacy chat message ===', payload)

    let messages: any[] = []

    if (payload.messages && Array.isArray(payload.messages)) {
      messages = payload.messages
    } else if (payload.message) {
      messages = [payload.message]
    } else if (payload.content || payload.text) {
      messages = [payload]
    } else {
      console.warn('Unknown payload structure:', payload)
      return
    }

    let sessionKey = payload.sessionKey || state.currentSessionKey

    if (!sessionKey) {
      console.warn('No session key available')
      return
    }

    if (!state.messages[sessionKey]) {
      commit('SET_MESSAGES', { sessionKey, messages: [] })
    }

    messages.forEach((msg: any) => {
      const newMessage: Message = {
        id: msg.id || `msg-${Date.now()}-${Math.random()}`,
        role: msg.role || 'assistant',
        content: msg.content || msg.text || '',
        timestamp: msg.timestamp || msg.createdAt || Date.now(),
        status: 'sent',
        metadata: msg.metadata || {}
      }

      commit('ADD_MESSAGE', { sessionKey, message: newMessage })
    })

    commit('SET_THINKING_MESSAGE_ID', null)
  }
}

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions
}
