import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, 'logs');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaStr}`;
  }

  writeToFile(level, message, meta = {}) {
    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    const logMessage = this.formatMessage(level, message, meta) + '\n';
    
    try {
      fs.appendFileSync(logFile, logMessage);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  info(message, meta = {}) {
    const formattedMessage = this.formatMessage('info', message, meta);
    console.log(`\x1b[36m${formattedMessage}\x1b[0m`);
    this.writeToFile('info', message, meta);
  }

  warn(message, meta = {}) {
    const formattedMessage = this.formatMessage('warn', message, meta);
    console.warn(`\x1b[33m${formattedMessage}\x1b[0m`);
    this.writeToFile('warn', message, meta);
  }

  error(message, meta = {}) {
    const formattedMessage = this.formatMessage('error', message, meta);
    console.error(`\x1b[31m${formattedMessage}\x1b[0m`);
    this.writeToFile('error', message, meta);
  }

  success(message, meta = {}) {
    const formattedMessage = this.formatMessage('success', message, meta);
    console.log(`\x1b[32m${formattedMessage}\x1b[0m`);
    this.writeToFile('info', message, meta);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      const formattedMessage = this.formatMessage('debug', message, meta);
      console.log(`\x1b[35m${formattedMessage}\x1b[0m`);
      this.writeToFile('debug', message, meta);
    }
  }
}

export const logger = new Logger();
