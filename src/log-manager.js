const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class LogManager {
  constructor() {
    const userDataPath = app.getPath('userData');
    this.logDir = path.join(userDataPath, 'logs');

    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    const today = new Date().toISOString().split('T')[0];
    this.currentLogFile = path.join(this.logDir, `openclaw-${today}.log`);

    this.maxLogFiles = 7;
    this.maxLogSize = 10 * 1024 * 1024;

    this.cleanOldLogs();
  }

  cleanOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir)
        .filter(file => file.endsWith('.log'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          mtime: fs.statSync(path.join(this.logDir, file)).mtime,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (files.length > this.maxLogFiles) {
        for (const file of files.slice(this.maxLogFiles)) {
          fs.unlinkSync(file.path);
        }
      }
    } catch (error) {
      console.error('Failed to clean old logs:', error);
    }
  }

  log(source, message, level = 'info') {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level.toUpperCase()}] [${source}] ${message}\n`;

    try {
      if (fs.existsSync(this.currentLogFile)) {
        const stats = fs.statSync(this.currentLogFile);
        if (stats.size >= this.maxLogSize) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const rotatedPath = path.join(this.logDir, `openclaw-${timestamp}.log`);
          fs.renameSync(this.currentLogFile, rotatedPath);
        }
      }

      fs.appendFileSync(this.currentLogFile, logEntry);
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  info(source, message) {
    this.log(source, message, 'info');
  }

  warn(source, message) {
    this.log(source, message, 'warn');
  }

  error(source, message) {
    this.log(source, message, 'error');
  }

  debug(source, message) {
    this.log(source, message, 'debug');
  }

  getLogs(options = {}) {
    const { limit = 1000, level, source } = options;

    try {
      if (!fs.existsSync(this.currentLogFile)) {
        return [];
      }

      const content = fs.readFileSync(this.currentLogFile, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim());

      const entries = [];

      for (const line of lines.reverse()) {
        const match = line.match(/^\[([^\]]+)\]\s+\[([^\]]+)\]\s+\[([^\]]+)\]\s+(.+)$/);
        if (match) {
          const [, timestamp, logLevel, logSource, message] = match;

          if (level && logLevel.toLowerCase() !== level.toLowerCase()) {
            continue;
          }

          if (source && logSource.toLowerCase() !== source.toLowerCase()) {
            continue;
          }

          entries.push({
            timestamp,
            level: logLevel,
            source: logSource,
            message,
          });

          if (entries.length >= limit) {
            break;
          }
        }
      }

      return entries;
    } catch (error) {
      console.error('Failed to read logs:', error);
      return [];
    }
  }

  clearLogs() {
    try {
      if (fs.existsSync(this.currentLogFile)) {
        fs.unlinkSync(this.currentLogFile);
      }
      return true;
    } catch (error) {
      console.error('Failed to clear logs:', error);
      return false;
    }
  }

  getLogFilePath() {
    return this.currentLogFile;
  }
}

module.exports = { LogManager };
