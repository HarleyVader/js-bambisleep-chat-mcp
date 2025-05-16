/**
 * Timeout Management Service
 * Provides centralized timeout configuration and handling for adapters
 */
import config from './config.js';
import logger from './logger.js';

/**
 * Default timeout configuration for different adapters
 */
const DEFAULT_TIMEOUTS = {
  duckduckgo: 20000,   // Increased from 10000ms
  fetch: 30000,        // Increased from 15000ms
  memory: 5000,
  milvus: 15000,
  default: 30000       // Default fallback
};

/**
 * Maximum retry attempts for each adapter
 */
const MAX_RETRY_ATTEMPTS = {
  duckduckgo: 3,
  fetch: 3,
  memory: 2,
  milvus: 2,
  default: 2
};

/**
 * Timeout Management class
 * Handles timeout configuration, retry logic, and error reporting
 */
class TimeoutManager {
  constructor() {
    this.timeouts = { ...DEFAULT_TIMEOUTS };
    this.retryAttempts = { ...MAX_RETRY_ATTEMPTS };
    this.errorCounts = {};
    this.lastErrors = {};
    
    // Try to load custom timeouts from config
    try {
      const customTimeouts = config.get('mcp.timeouts', {});
      this.timeouts = { ...DEFAULT_TIMEOUTS, ...customTimeouts };
      
      const customRetries = config.get('mcp.retries', {});
      this.retryAttempts = { ...MAX_RETRY_ATTEMPTS, ...customRetries };
      
      logger.debug('Loaded custom timeout configuration', { 
        timeouts: this.timeouts,
        retryAttempts: this.retryAttempts
      });
    } catch (error) {
      logger.warn('Failed to load custom timeout configuration, using defaults', { error: error.message });
    }
  }
  
  /**
   * Get timeout value for an adapter
   * @param {string} adapterName - Adapter name
   * @param {string} [operation] - Specific operation
   * @param {Object} [options] - Additional options
   * @returns {number} Timeout in milliseconds
   */
  getTimeout(adapterName, operation, options = {}) {
    // Check for operation-specific timeout
    const operationKey = operation ? `${adapterName}.${operation}` : null;
    
    // Order of precedence:
    // 1. Options provided timeout
    // 2. Operation-specific timeout from config
    // 3. Adapter-specific timeout
    // 4. Default timeout
    
    if (options.timeout) {
      return options.timeout;
    }
    
    if (operationKey && this.timeouts[operationKey]) {
      return this.timeouts[operationKey];
    }
    
    return this.timeouts[adapterName] || this.timeouts.default;
  }
  
  /**
   * Get max retry attempts for an adapter
   * @param {string} adapterName - Adapter name
   * @param {Object} [options] - Additional options
   * @returns {number} Maximum retry attempts
   */
  getMaxRetries(adapterName, options = {}) {
    // If options explicitly set retries, use that
    if (options.maxRetries !== undefined) {
      return options.maxRetries;
    }
    
    return this.retryAttempts[adapterName] || this.retryAttempts.default;
  }
  
  /**
   * Calculate backoff time for retries
   * @param {number} attempt - Current attempt number (0-based)
   * @param {string} adapterName - Adapter name
   * @returns {number} Backoff time in milliseconds
   */
  calculateBackoff(attempt, adapterName) {
    // Exponential backoff with jitter
    // Base: 1000ms, max: 30000ms
    const baseBackoff = 1000; // 1 second
    const maxBackoff = 30000; // 30 seconds
    
    // Calculate exponential backoff: 2^attempt * baseBackoff
    const exponentialBackoff = Math.min(
      Math.pow(2, attempt) * baseBackoff,
      maxBackoff
    );
    
    // Add jitter (+/- 25%)
    const jitter = exponentialBackoff * 0.25 * (Math.random() - 0.5);
    
    return Math.floor(exponentialBackoff + jitter);
  }
  
  /**
   * Record a timeout error
   * @param {string} adapterName - Adapter name
   * @param {string} operation - Operation name
   * @param {Error} error - Error object
   */
  recordError(adapterName, operation, error) {
    const key = `${adapterName}:${operation}`;
    
    // Increment error count
    this.errorCounts[key] = (this.errorCounts[key] || 0) + 1;
    
    // Store last error
    this.lastErrors[key] = {
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: new Date().toISOString(),
      count: this.errorCounts[key]
    };
    
    // Log error
    logger.warn(`Timeout manager recorded error for ${key}`, {
      adapter: adapterName,
      operation,
      error: error.message,
      count: this.errorCounts[key]
    });
  }
  
  /**
   * Get error statistics for an adapter
   * @param {string} adapterName - Adapter name
   * @returns {Object} Error statistics
   */
  getErrorStats(adapterName) {
    const stats = {
      totalErrors: 0,
      operations: {},
      lastError: null
    };
    
    // Find all errors for this adapter
    Object.keys(this.errorCounts).forEach(key => {
      if (key.startsWith(`${adapterName}:`)) {
        const operation = key.split(':')[1];
        const count = this.errorCounts[key];
        
        stats.totalErrors += count;
        stats.operations[operation] = {
          count,
          lastError: this.lastErrors[key] || null
        };
        
        // Find most recent error
        const lastError = this.lastErrors[key];
        if (lastError && (!stats.lastError || lastError.timestamp > stats.lastError.timestamp)) {
          stats.lastError = lastError;
        }
      }
    });
    
    return stats;
  }
  
  /**
   * Update timeout configuration
   * @param {string} adapterName - Adapter name
   * @param {number} timeout - New timeout value
   * @param {string} [operation] - Specific operation (optional)
   */
  updateTimeout(adapterName, timeout, operation) {
    const key = operation ? `${adapterName}.${operation}` : adapterName;
    this.timeouts[key] = timeout;
    
    logger.info(`Updated timeout for ${key} to ${timeout}ms`);
  }
  
  /**
   * Reset error counts for an adapter
   * @param {string} adapterName - Adapter name
   * @param {string} [operation] - Specific operation (optional)
   */
  resetErrors(adapterName, operation) {
    if (operation) {
      const key = `${adapterName}:${operation}`;
      delete this.errorCounts[key];
      delete this.lastErrors[key];
    } else {
      // Reset all errors for this adapter
      Object.keys(this.errorCounts).forEach(key => {
        if (key.startsWith(`${adapterName}:`)) {
          delete this.errorCounts[key];
          delete this.lastErrors[key];
        }
      });
    }
    
    logger.info(`Reset error counts for ${adapterName}${operation ? `:${operation}` : ''}`);
  }
}

// Export a singleton instance
export default new TimeoutManager();
