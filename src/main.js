const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { GatewayClient } = require('./gateway-client');
const { ConfigManager } = require('./config-manager');
const { LogManager } = require('./log-manager');

// ============================================================================
// 关键：必须在任何app方法调用之前设置所有命令行参数
// ============================================================================

console.log('=== OpenClaw Electron 启动 ===');
console.log('平台:', process.platform);
console.log('架构:', process.arch);
console.log('Electron版本:', process.versions.electron);

// Windows 高DPI 支持 - 最强配置
if (process.platform === 'win32') {
  console.log('\n🔧 应用Windows高DPI设置...');

  const switches = [
    ['high-dpi-support', 'true'],
    ['force-device-scale-factor', '2'],
    ['enable-direct-write', 'true'],
    ['disable-gpu-vsync', 'true'],
    ['enable-zero-copy', 'true'],
  ];

  switches.forEach(([key, value]) => {
    app.commandLine.appendSwitch(key, value);
    console.log(`  ✓ ${key}=${value}`);
  });

  console.log('✅ 高DPI设置已应用\n');
}

// Linux/WSL 字体渲染优化
if (process.platform === 'linux') {
  console.log('\n🔧 应用Linux字体渲染优化...');

  // 禁用字体合成，使用系统字体配置
  app.commandLine.appendSwitch('disable-font-subpixel-positioning');
  // 启用字体 hinting
  app.commandLine.appendSwitch('enable-font-antialiasing');
  // 使用系统字体配置
  app.commandLine.appendSwitch('font-render-hinting', 'slight');

  // 强制设置默认字体族（使用微软雅黑作为优先字体）
  app.commandLine.appendSwitch('default-font-family', 'Microsoft YaHei,微软雅黑,Noto Sans CJK SC,WenQuanYi Micro Hei,Noto Sans SC,sans-serif');
  app.commandLine.appendSwitch('default-font-family-standard', 'Microsoft YaHei,微软雅黑,Noto Sans CJK SC,WenQuanYi Micro Hei,Noto Sans SC,sans-serif');
  app.commandLine.appendSwitch('default-font-family-sans-serif', 'Microsoft YaHei,微软雅黑,Noto Sans CJK SC,WenQuanYi Micro Hei,Noto Sans SC,sans-serif');
  app.commandLine.appendSwitch('default-font-family-serif', 'Microsoft YaHei,微软雅黑,Noto Serif CJK SC,Source Han Serif CN,serif');
  app.commandLine.appendSwitch('default-font-family-monospace', 'Microsoft YaHei,微软雅黑,Noto Sans Mono CJK SC,WenQuanYi Micro Hei Mono,monospace');

  console.log('  ✓ Linux字体渲染优化已应用');
  console.log('  ✓ 默认字体族已设置为微软雅黑\n');
}

let mainWindow = null;
let gatewayClient = null;
let configManager;
let logManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      webSecurity: true,
      // 启用更好的字体渲染
      zoomFactor: 1.0,
      // 启用开发者工具
      devTools: true,
    },
    title: 'OpenClaw Desktop Client',
    // 确保更好的渲染质量
    show: true,
    // 自定义标题栏 - 隐藏默认标题栏
    frame: false,
    titleBarStyle: 'hidden',
    // Windows上的自定义标题栏
    ...(process.platform === 'win32' ? {
      titleBarStyle: 'hidden',
      backgroundColor: '#ffffff',
    } : {}),
  });

  // Load the index.html of the app
  // 开发模式：连接到 webpack-dev-server
  // 生产模式：加载构建后的文件
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // 开发模式：加载 webpack-dev-server，添加重试机制
    const devServerURL = 'http://localhost:5173';
    let retryCount = 0;
    const maxRetries = 10;
    const retryInterval = 1000; // 1秒

    const loadDevServer = () => {
      console.log(`🔄 Attempting to load dev server (attempt ${retryCount + 1})...`);
      mainWindow?.loadURL(devServerURL).then(() => {
        console.log('✅ Dev server loaded successfully');
      }).catch((err) => {
        console.error(`Failed to load dev server (attempt ${retryCount + 1}):`, err.message);
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retrying in ${retryInterval}ms...`);
          setTimeout(loadDevServer, retryInterval);
        } else {
          console.error('Max retries reached. Please check if webpack-dev-server is running.');
          // 显示错误页面
          mainWindow?.loadFile(path.join(__dirname, 'renderer/index.html')).catch(() => {
            console.error('Failed to load fallback page');
          });
        }
      });
    };

    // 先尝试加载，如果失败会重试
    console.log('🚀 开发模式：连接到 webpack-dev-server (http://localhost:5173)');
    loadDevServer();
  } else {
    // 生产模式：加载构建后的文件
    // __dirname 是 dist/ 目录，所以直接加载 renderer/index.html
    mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
    console.log('📦 生产模式：加载构建后的文件');
  }

  // 强制显示窗口（调试用）
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('🔍 Forcing window to show after 2 seconds...');
      mainWindow.show();
      console.log('✅ Window show() called forcefully');
    }
  }, 2000);

  // 确保正确的UTF-8编码
  mainWindow.webContents.on('did-start-loading', () => {
    mainWindow?.webContents.executeJavaScript(`
      // 强制设置文档编码为UTF-8
      if (document.charset) {
        document.charset = 'UTF-8';
      }
      // 设置默认字符集
      if (document.characterSet) {
        document.characterSet = 'UTF-8';
      }
    `).catch(() => {});
  });

  // 页面加载完成后再次确保编码设置和字体
  mainWindow.webContents.on('did-finish-load', () => {
    // 设置页面的缩放因子，确保在高DPI屏幕上清晰
    const scaleFactor = 1.0; // 可以根据需要调整
    mainWindow?.webContents.setZoomFactor(scaleFactor);

    // 再次强制UTF-8编码和中文字体
    mainWindow?.webContents.executeJavaScript(`
      document.charset = 'UTF-8';
      if (document.characterSet) {
        document.characterSet = 'UTF-8';
      }

      // 强制注入微软雅黑字体样式
      const style = document.createElement('style');
      style.textContent = \`
        @font-face {
          font-family: 'ChineseFont';
          src: local('Microsoft YaHei'), local('微软雅黑'),
               local('Noto Sans CJK SC'), local('WenQuanYi Micro Hei'),
               local('Noto Sans SC'), local('Source Han Sans CN'),
               local('PingFang SC');
          font-display: swap;
        }
        * {
          font-family: 'ChineseFont', 'Microsoft YaHei', '微软雅黑',
                       'Noto Sans CJK SC', 'WenQuanYi Micro Hei',
                       'Noto Sans SC', 'PingFang SC',
                       -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
                       sans-serif !important;
        }
        code, pre, .font-mono {
          font-family: 'Microsoft YaHei', '微软雅黑', 'Noto Sans Mono CJK SC',
                       'WenQuanYi Zen Hei Mono',
                       ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
                       monospace !important;
        }
      \`;
      document.head.appendChild(style);
      console.log('[Electron] 微软雅黑字体样式已注入');
    `).catch(() => {});
  });

  // 等待窗口加载完成后显示，避免视觉闪烁
  mainWindow.once('ready-to-show', () => {
    console.log('✅ Window ready-to-show event fired');
    mainWindow?.show();
    console.log('✅ Window show() called');
  });

  // Open DevTools automatically (you can comment this out if not needed)
  mainWindow.webContents.openDevTools();

  // Add globalShortcut for DevTools (optional)
  // This allows Ctrl+Shift+I to open DevTools even with custom title bar
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Windows/Linux: Ctrl+Shift+I
    // macOS: Cmd+Option+I
    if (input.key === 'i' || input.key === 'I') {
      if (input.control && input.shift && !input.alt) {
        // Windows/Linux: Ctrl+Shift+I
        event.preventDefault();
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
          } else {
            mainWindow.webContents.openDevTools();
          }
        }
      } else if (input.meta && input.alt && !input.control && !input.shift) {
        // macOS: Cmd+Option+I
        event.preventDefault();
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.webContents.isDevToolsOpened()) {
            mainWindow.webContents.closeDevTools();
          } else {
            mainWindow.webContents.openDevTools();
          }
        }
      }
    }

    // F12 for DevTools
    if (input.key === 'F12') {
      event.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools();
        }
      }
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize managers
configManager = new ConfigManager();
logManager = new LogManager();

// IPC handlers
ipcMain.handle('get-config', async () => {
  return configManager.getConfig();
});

ipcMain.handle('save-config', async (event, config) => {
  return configManager.saveConfig(config);
});

ipcMain.handle('connect-gateway', async (event, config) => {
  try {
    if (gatewayClient) {
      gatewayClient.disconnect();
    }

    gatewayClient = new GatewayClient(config, logManager);

    gatewayClient.on('connected', (hello) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('gateway-connected', hello);
      }
    });

    gatewayClient.on('disconnected', (reason) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('gateway-disconnected', reason);
      }
    });

    gatewayClient.on('event', (evt) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('gateway-event', evt);
      }
    });

    await gatewayClient.connect();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('disconnect-gateway', async () => {
  try {
    if (gatewayClient) {
      await gatewayClient.disconnect();
      gatewayClient = null;
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('is-connected', async () => {
  return gatewayClient?.connected || false;
});

ipcMain.handle('send-message', async (event, sessionKey, message, attachments) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.sendMessage(sessionKey, message, attachments);
    return { success: true, runId: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-chat-history', async (event, sessionKey, limit) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.getChatHistory(sessionKey, limit);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('abort-chat', async (event, sessionKey, runId) => {
  console.log('[MAIN] abort-chat handler called:', { sessionKey, runId });
  if (!gatewayClient) {
    console.log('[MAIN] abort-chat failed: not connected to gateway');
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    // abortChat is fire-and-forget, no need to await
    gatewayClient.abortChat(sessionKey, runId);
    console.log('[MAIN] abort-chat: abortChat called on gatewayClient');
    return { success: true };
  } catch (error) {
    console.error('[MAIN] abort-chat error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('list-sessions', async (event, params) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.listSessions(params);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('resolve-session', async (event, params) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.resolveSession(params);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('delete-session', async (event, key, deleteTranscript = false) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    await gatewayClient.deleteSession(key, deleteTranscript);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('patch-session', async (event, key, patch) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    await gatewayClient.patchSession(key, patch);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('agents-list', async () => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.listAgents();
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-logs', async (event, options) => {
  return logManager.getLogs(options);
});

ipcMain.handle('clear-logs', async () => {
  return logManager.clearLogs();
});

// Cron Jobs
ipcMain.handle('cron-list', async (event, params) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.listCronJobs(params);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cron-add', async (event, job) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.addCronJob(job);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cron-update', async (event, params) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.updateCronJob(params.id, params.patch);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cron-remove', async (event, params) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.removeCronJob(params.id);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cron-run', async (event, params) => {
  if (!gatewayClient) {
    return { success: false, error: 'Not connected to gateway' };
  }
  try {
    const result = await gatewayClient.runCronJob(params.id, params.mode);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Window Controls
ipcMain.handle('window-minimize', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.minimize();
  }
});

ipcMain.handle('window-maximize', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.maximize();
  }
});

ipcMain.handle('window-unmaximize', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.unmaximize();
  }
});

ipcMain.handle('window-close', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Notify gateway before closing
    if (gatewayClient) {
      gatewayClient.disconnect();
    }
    mainWindow.close();
  }
});

ipcMain.handle('window-is-maximized', async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow.isMaximized();
  }
  return false;
});

// App lifecycle
app.whenReady().then(() => {
  // 隐藏菜单栏 (File, Edit, View, Window, Help)
  Menu.setApplicationMenu(null);

  createWindow();
});

app.on('window-all-closed', () => {
  // Notify gateway before closing
  if (gatewayClient) {
    gatewayClient.disconnect();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  // Ensure gateway disconnect is notified before quit
  if (gatewayClient) {
    gatewayClient.disconnect();
  }
});
