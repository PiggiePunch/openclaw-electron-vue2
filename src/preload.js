const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  // Window Controls
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  unmaximizeWindow: () => ipcRenderer.invoke('window-unmaximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Config
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),

  // Gateway connection
  connectGateway: (config) => ipcRenderer.invoke('connect-gateway', config),
  disconnectGateway: () => ipcRenderer.invoke('disconnect-gateway'),
  isConnected: () => ipcRenderer.invoke('is-connected'),

  sendMessage: (sessionKey, message, attachments) =>
    ipcRenderer.invoke('send-message', sessionKey, message, attachments),
  getChatHistory: (sessionKey, limit) =>
    ipcRenderer.invoke('get-chat-history', sessionKey, limit),
  abortChat: (sessionKey, runId) =>
    ipcRenderer.invoke('abort-chat', sessionKey, runId),

  listSessions: (params) => ipcRenderer.invoke('list-sessions', params),
  resolveSession: (params) => ipcRenderer.invoke('resolve-session', params),
  deleteSession: (key, deleteTranscript) => ipcRenderer.invoke('delete-session', key, deleteTranscript),
  patchSession: (key, patch) => ipcRenderer.invoke('patch-session', key, patch),

  listAgents: () => ipcRenderer.invoke('agents-list'),

  listCronJobs: (params) => ipcRenderer.invoke('cron-list', params),
  addCronJob: (job) => ipcRenderer.invoke('cron-add', job),
  updateCronJob: (id, patch) => ipcRenderer.invoke('cron-update', { id, patch }),
  removeCronJob: (id) => ipcRenderer.invoke('cron-remove', { id }),
  runCronJob: (id, mode) => ipcRenderer.invoke('cron-run', { id, mode }),

  getLogs: (options) => ipcRenderer.invoke('get-logs', options),
  clearLogs: () => ipcRenderer.invoke('clear-logs'),

  onGatewayConnected: (callback) => {
    ipcRenderer.on('gateway-connected', (_event, hello) => callback(hello));
  },

  onGatewayDisconnected: (callback) => {
    ipcRenderer.on('gateway-disconnected', (_event, reason) => callback(reason));
  },

  onGatewayEvent: (callback) => {
    ipcRenderer.on('gateway-event', (_event, evt) => callback(evt));
  },

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('gateway-connected');
    ipcRenderer.removeAllListeners('gateway-disconnected');
    ipcRenderer.removeAllListeners('gateway-event');
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
