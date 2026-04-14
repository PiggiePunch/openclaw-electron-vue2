/**
 * Vuex Store 主入口
 */

import Vue from 'vue'
import Vuex from 'vuex'
import createPersistedState from 'vuex-persistedstate'
import config from './modules/config'
import gateway from './modules/gateway'
import chat from './modules/chat'
import logs from './modules/logs'
import ui from './modules/ui'

Vue.use(Vuex)

export default new Vuex.Store({
  modules: {
    config,
    gateway,
    chat,
    logs,
    ui
  },
  plugins: [
    createPersistedState({
      key: 'openclaw-vue2',
      paths: ['config', 'chat.currentSessionKey']
    })
  ],
  strict: process.env.NODE_ENV !== 'production'
})
