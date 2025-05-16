/**
 * Logger utility for structured logging throughout the application
 * Uses Pino logger with configuration from config module
 */
import pino from 'pino';
import config from './config.js';

// Get logging configuration
const logConfig = config.get('logging', {
  level: 'info',
  format: 'json'
});

// Configure Pino options
const pinoOptions = {
  level: logConfig.level,
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Add additional context to all logs
  base: {
    app: config.get('app.name'),
    version: config.get('app.version'),
    env: process.env.NODE_ENV || 'development'
  }
};

// Set up pretty printing for development
if (logConfig.format === 'pretty') {
  pinoOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  };
}

// Create the logger instance
const logger = pino(pinoOptions);

/**
 * Logger class wrapping Pino with additional context capabilities
 * @class Logger
 */
class Logger {
  constructor(baseLogger) {
    this.baseLogger = baseLogger;
  }

  /**
   * Create a child logger with additional context
   * @param {Object} context - Context to add to all logs from this child
   * @returns {Logger} New logger instance with merged context
   */
  child(context = {}) {
    return new Logger(this.baseLogger.child(context));
  }

  /**
   * Log at trace level
   * @param {Object|string} obj - Object or message to log
   * @param {string} [msg] - Message if obj is an object
   */
  trace(obj, msg) {
    this.baseLogger.trace(obj, msg);
  }

  /**
   * Log at debug level
   * @param {Object|string} obj - Object or message to log
   * @param {string} [msg] - Message if obj is an object
   */
  debug(obj, msg) {
    this.baseLogger.debug(obj, msg);
  }

  /**
   * Log at info level
   * @param {Object|string} obj - Object or message to log
   * @param {string} [msg] - Message if obj is an object
   */
  info(obj, msg) {
    this.baseLogger.info(obj, msg);
  }

  /**
   * Log at warn level
   * @param {Object|string} obj - Object or message to log
   * @param {string} [msg] - Message if obj is an object
   */
  warn(obj, msg) {
    this.baseLogger.warn(obj, msg);
  }

  /**
   * Log at error level
   * @param {Object|string|Error} obj - Object, message, or Error to log
   * @param {string} [msg] - Message if obj is an object or Error
   */
  error(obj, msg) {
    // Special handling for Error objects to capture stack traces properly
    if (obj instanceof Error) {
      const errorObj = {
        type: obj.name,
        message: obj.message,
        stack: obj.stack
      };
      
      // Include any additional properties from the error
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && !errorObj[key]) {
          errorObj[key] = obj[key];
        }
      }
      
      this.baseLogger.error(errorObj, msg || obj.message);
    } else {
      this.baseLogger.error(obj, msg);
    }
  }

  /**
   * Log at fatal level
   * @param {Object|string|Error} obj - Object, message, or Error to log
   * @param {string} [msg] - Message if obj is an object or Error
   */
  fatal(obj, msg) {
    if (obj instanceof Error) {
      const errorObj = {
        type: obj.name,
        message: obj.message,
        stack: obj.stack
      };
      
      // Include any additional properties from the error
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && !errorObj[key]) {
          errorObj[key] = obj[key];
        }
      }
      
      this.baseLogger.fatal(errorObj, msg || obj.message);
    } else {
      this.baseLogger.fatal(obj, msg);
    }
  }
}

// Export a singleton logger instance
export default new Logger(logger);
