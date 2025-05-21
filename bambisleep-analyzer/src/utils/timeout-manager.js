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
 * Handles timeout configuration, retry logic, error reporting, and throttling
 */
class TimeoutManager {
  constructor() {
    this.timeouts = { ...DEFAULT_TIMEOUTS };
    this.retryAttempts = { ...MAX_RETRY_ATTEMPTS };
    this.errorCounts = {};
    this.lastErrors = {};
    
    // Throttling data
    this.activeRequests = {};
    this.lastRequestTimes = {};
    this.requestThrottles = {};
    
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
   * @param {string} [operation] - Operation name (optional)
   * @returns {number} Backoff time in milliseconds
   */
  calculateBackoff(attempt, adapterName, operation = null) {
    // Exponential backoff with jitter
    // Base: 1000ms for first retry, exponential increase, max: 45000ms
    const baseBackoff = 1000; // 1 second
    const maxBackoff = 45000; // 45 seconds
    
    // Calculate exponential backoff: 2^attempt * baseBackoff
    const exponentialBackoff = Math.min(
      Math.pow(2, attempt) * baseBackoff,
      maxBackoff
    );
    
    // Add jitter (+/- 25%) to prevent stampede if multiple retries happen at once
    const jitter = exponentialBackoff * 0.25 * (Math.random() - 0.5);
    
    // Check for throttling - apply additional delay if needed
    let throttleDelay = 0;
    if (operation) {
      throttleDelay = this.getThrottleDelay(adapterName, operation);
    }
    
    // Combine backoff, jitter, and throttle delay
    return Math.floor(exponentialBackoff + jitter + throttleDelay);
  }
  
  /**
   * Get combined backoff and throttle delay for an operation
   * @param {string} adapterName - Adapter name
   * @param {string} operation - Operation name
   * @param {number} attempt - Current retry attempt (0-based)
   * @returns {number} Total delay in milliseconds
   */
  getDelayForOperation(adapterName, operation, attempt = 0) {
    // Track request for throttling purposes
    this.trackRequest(adapterName, operation);
    
    // Calculate combined delay
    const backoff = attempt > 0 ? this.calculateBackoff(attempt - 1, adapterName, operation) : 0;
    const throttle = this.getThrottleDelay(adapterName, operation);
    
    return backoff + throttle;
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
    
    // Try to dynamically adjust the timeout if we're seeing repeated errors
    if (this.errorCounts[key] >= 3) {
      this.adjustTimeoutDynamically(adapterName, operation);
    }
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
   * Dynamically adjust timeouts based on error rates
   * @param {string} adapterName - Adapter name
   * @param {string} operation - Operation name
   * @returns {boolean} Whether an adjustment was made
   */
  adjustTimeoutDynamically(adapterName, operation) {
    const key = `${adapterName}:${operation}`;
    const errorCount = this.errorCounts[key] || 0;
    
    // Only adjust if we have multiple errors
    if (errorCount < 3) {
      return false;
    }
    
    // Calculate current operation timeout
    const opKey = `${adapterName}.${operation}`;
    const currentTimeout = this.timeouts[opKey] || this.timeouts[adapterName] || this.timeouts.default;
    
    // Increase timeout by 50% if we've seen multiple errors
    const newTimeout = Math.min(currentTimeout * 1.5, 120000); // Cap at 2 minutes
    
    // Update the timeout
    this.updateTimeout(adapterName, newTimeout, operation);
    
    // Reset error count after adjustment
    this.errorCounts[key] = 0;
    
    logger.info({
      message: `Dynamically increased timeout due to repeated errors`,
      adapter: adapterName,
      operation,
      previousTimeout: currentTimeout,
      newTimeout,
      errorCount
    });
    
    return true;
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
  
  /**
   * Track active request for throttling purposes
   * @param {string} adapterName - Adapter name
   * @param {string} operation - Operation name
   */
  trackRequest(adapterName, operation) {
    const key = `${adapterName}:${operation}`;
    
    if (!this.activeRequests[key]) {
      this.activeRequests[key] = 0;
    }
    
    this.activeRequests[key]++;
    this.lastRequestTimes[key] = Date.now();
    
    // Reset throttle if needed
    if (this.activeRequests[key] <= 1) {
      delete this.requestThrottles[key];
    }
    
    // Apply throttling if we're getting a large number of simultaneous requests
    if (this.activeRequests[key] > 3) {
      this.requestThrottles[key] = {
        delay: Math.min(this.activeRequests[key] * 100, 2000), // Max 2 second delay
        until: Date.now() + 10000 // Apply throttle for 10 seconds
      };
      
      logger.warn({
        message: `Throttling ${key} due to high request volume`,
        activeRequests: this.activeRequests[key],
        throttleDelay: this.requestThrottles[key].delay
      });
    }
  }
  
  /**
   * Complete a request and update tracking
   * @param {string} adapterName - Adapter name
   * @param {string} operation - Operation name
   */
  completeRequest(adapterName, operation) {
    const key = `${adapterName}:${operation}`;
    
    if (this.activeRequests[key]) {
      this.activeRequests[key]--;
      
      if (this.activeRequests[key] <= 0) {
        delete this.activeRequests[key];
      }
    }
  }
  
  /**
   * Get throttle delay if this request should be throttled
   * @param {string} adapterName - Adapter name
   * @param {string} operation - Operation name
   * @returns {number} Delay in ms, or 0 if no throttling needed
   */
  getThrottleDelay(adapterName, operation) {
    const key = `${adapterName}:${operation}`;
    const throttle = this.requestThrottles[key];
    
    if (!throttle || Date.now() > throttle.until) {
      return 0;
    }
    
    return throttle.delay;
  }
}

// Export a singleton instance
export default new TimeoutManager();
