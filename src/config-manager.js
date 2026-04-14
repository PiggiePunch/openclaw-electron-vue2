const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_CONFIG = {
  gateway: {
    url: 'ws://localhost:18789',
    token: '',
    password: '',
  },
};

class ConfigManager {
  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf-8');
        const loaded = JSON.parse(data);
        return { ...DEFAULT_CONFIG, ...loaded };
      }
    } catch (error) {
      console.error('Failed to load config, using defaults:', error.message);
    }
    return { ...DEFAULT_CONFIG };
  }

  getConfig() {
    return { ...this.config };
  }

  saveConfig(config) {
    try {
      this.config = { ...this.config, ...config };

      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      console.error('Failed to save config:', error.message);
      return false;
    }
  }

  updateGatewayConfig(gatewayConfig) {
    return this.saveConfig({
      gateway: { ...this.config.gateway, ...gatewayConfig },
    });
  }

  updateLastSessionKey(sessionKey) {
    return this.saveConfig({ lastSessionKey: sessionKey });
  }

  updateWindowBounds(bounds) {
    return this.saveConfig({ windowBounds: bounds });
  }
}

module.exports = { ConfigManager };
