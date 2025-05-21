/**
 * Base Adapter class for MCP servers
 * Defines common interface and functionality for all MCP adapters
 */
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import timeoutManager from '../utils/timeout-manager.js';
import { ConnectionError, TimeoutError, ToolExecutionError } from '../utils/errors.js';

/**
 * Base MCP Adapter class
 * @class BaseAdapter
 */
export class BaseAdapter {
  /**
   * Create a new BaseAdapter instance
   * @param {string} name - Adapter name
   * @param {Object} [options={}] - Adapter options
   */
  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
    this.connected = false;
    this.connectionId = uuidv4();
    this.logger = logger.child({ adapter: name, connectionId: this.connectionId });
    
    this.logger.debug({
      message: 'Adapter created',
      options: this.options
    });
  }

  /**
   * Connect to the MCP server
   * @returns {Promise<void>}
   * @throws {ConnectionError} If connection fails
   */
  async connect() {
    if (this.connected) {
      this.logger.debug('Adapter already connected');
      return;
    }
    
    try {
      this.logger.debug('Connecting to MCP server');
      await this._connect();
      this.connected = true;
      this.logger.info('Connected to MCP server');
    } catch (error) {
      this.logger.error({
        message: `Connection failed: ${error.message}`,
        error
      });
      
      throw new ConnectionError(`Failed to connect to ${this.name}: ${error.message}`, this.name, {
        originalError: error.message
      });
    }
  }

  /**
   * Internal connection method to be implemented by subclasses
   * @returns {Promise<void>}
   * @protected
   * @abstract
   */
  async _connect() {
    throw new Error('_connect() must be implemented by subclass');
  }

  /**
   * Disconnect from the MCP server
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (!this.connected) {
      this.logger.debug('Adapter not connected');
      return;
    }
    
    try {
      this.logger.debug('Disconnecting from MCP server');
      await this._disconnect();
      this.connected = false;
      this.logger.info('Disconnected from MCP server');
    } catch (error) {
      this.logger.error({
        message: `Disconnection error: ${error.message}`,
        error
      });
    }
  }

  /**
   * Internal disconnection method to be implemented by subclasses
   * @returns {Promise<void>}
   * @protected
   * @abstract
   */
  async _disconnect() {
    throw new Error('_disconnect() must be implemented by subclass');
  }
  /**
   * Execute a command on the MCP server
   * @param {string} command - Command name
   * @param {Object} parameters - Command parameters
   * @param {Object} [options={}] - Execution options
   * @returns {Promise<Object>} Command result
   * @throws {ConnectionError} If connection fails
   * @throws {TimeoutError} If execution times out
   * @throws {ToolExecutionError} If execution fails
   */
  async execute(command, parameters, options = {}) {
    if (!this.connected) {
      await this.connect();
    }
    
    const executionId = uuidv4();
    const executionLogger = this.logger.child({
      command,
      executionId
    });
    
    executionLogger.debug({
      message: 'Executing command',
      parameters: this._sanitizeParameters(parameters),
      options
    });
    
    // Validate command and parameters
    this._validateExecuteParams(command, parameters);
    
    // Get retry configuration
    const maxRetries = options.maxRetries !== undefined 
      ? options.maxRetries 
      : timeoutManager.getMaxRetries(this.name, options);
      
    let attemptCount = 0;
    let lastError = null;
    
    // Execution with retry logic
    while (attemptCount <= maxRetries) {
      try {
        // Calculate timeout for this attempt (with progressive increase for retries)
        // Base timeout from timeout manager
        const baseTimeout = timeoutManager.getTimeout(this.name, command, options);
        
        // For retries, increase by 30% each attempt
        const timeoutMultiplier = attemptCount > 0 ? 1 + (attemptCount * 0.3) : 1;
        
        // Cap at 3 minutes to avoid excessive timeouts
        const attemptTimeout = Math.min(baseTimeout * timeoutMultiplier, 180000);
        
        // Update options with current timeout and retry info
        const attemptOptions = {
          ...options,
          timeout: attemptTimeout,
          retryAttempt: attemptCount
        };
        
        // Log retry attempt if applicable
        if (attemptCount > 0) {
          const backoffTime = timeoutManager.calculateBackoff(attemptCount - 1, this.name);
          
          executionLogger.info({
            message: `Retry attempt ${attemptCount}/${maxRetries} for command ${command}`,
            timeout: attemptTimeout,
            backoffTime,
            previousError: lastError?.message
          });
          
          // Add a small delay between retries with progressive backoff
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
        
        // Execute command with timeout
        const result = await this._executeWithTimeout(command, parameters, attemptOptions);
        
        // If we succeeded after retries, log that for monitoring
        if (attemptCount > 0) {
          executionLogger.info({
            message: `Command succeeded after ${attemptCount} retries`,
            command,
            totalAttempts: attemptCount + 1
          });
        }
        
        executionLogger.debug({
          message: 'Command executed successfully',
          resultSize: this._calculateResultSize(result)
        });
        
        this._trackRequestCompletion(command);
        
        return result;
      } catch (error) {
        lastError = error;
        
        // If connection error, try to reconnect
        if (error instanceof ConnectionError) {
          try {
            this.connected = false;
            await this.connect();
          } catch (reconnectError) {
            // Just log reconnect errors, will still retry the command
            executionLogger.warn({
              message: `Reconnect failed during retry: ${reconnectError.message}`
            });
          }
        }
        
        // Don't retry if it's not a retryable error or exceeded max retries
        const isRetryable = this._isRetryableError(error);
        const canRetry = attemptCount < maxRetries && isRetryable;
        
        if (!canRetry) {
          executionLogger.error({
            message: `Command execution failed after ${attemptCount} attempts: ${error.message}`,
            retryable: isRetryable,
            error: {
              name: error.name,
              message: error.message,
              stack: error.stack
            }
          });
          
          throw this._wrapExecutionError(error, command, parameters);
        }
        
        // Prepare for next retry
        attemptCount++;
      }
    }
    
    // This should never be reached due to the throw above when !canRetry,
    // but adding as a safeguard
    const errorMessage = lastError?.message || 'Unknown error during command execution';
    executionLogger.error({
      message: `Command failed after all retries: ${errorMessage}`,
      error: lastError
    });
    
    throw this._wrapExecutionError(
      lastError || new Error('Unknown error during command execution'),
      command,
      parameters
    );
  }

  /**
   * Validate command and parameters before execution
   * @param {string} command - Command name
   * @param {Object} parameters - Command parameters
   * @throws {Error} If validation fails
   * @protected
   */
  _validateExecuteParams(command, parameters) {
    if (typeof command !== 'string' || !command) {
      throw new Error('Command must be a non-empty string');
    }
    
    if (parameters !== undefined && (parameters === null || typeof parameters !== 'object')) {
      throw new Error('Parameters must be an object if provided');
    }
  }
  /**
   * Execute a command with timeout
   * @param {string} command - Command name
   * @param {Object} parameters - Command parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Execution result
   * @throws {TimeoutError} If execution times out
   * @protected
   */
  async _executeWithTimeout(command, parameters, options = {}) {
    const { timeout = 30000 } = options;
    let timeoutId;
    let abortController;
    
    try {
      // Create an AbortController if supported
      if (typeof AbortController !== 'undefined') {
        abortController = new AbortController();
        if (!options.signal) {
          options = {
            ...options,
            signal: abortController.signal
          };
        }
      }
      
      // Create a promise wrapper that can be safely aborted/cancelled
      const executionPromise = new Promise((resolve, reject) => {
        // Set timeout handler
        timeoutId = setTimeout(() => {
          const timeoutError = new TimeoutError(
            `${this.name} command timed out after ${timeout}ms`, 
            command,
            { 
              operation: command,
              parameters: this._sanitizeParameters(parameters)
            }
          );
          
          // Record the timeout in the timeout manager for statistics
          timeoutManager.recordError(this.name, command, timeoutError);
          
          // Abort the operation if possible
          if (abortController) {
            abortController.abort();
          }
          
          reject(timeoutError);
        }, timeout);
        
        // Execute the actual command
        this._execute(command, parameters, options)
          .then(resolve)
          .catch(reject)
          .finally(() => {
            // Clear timeout to prevent memory leaks
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
          });
      });
      
      // Wait for execution to complete
      return await executionPromise;
    } finally {
      // Ensure timeout is cleared
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  }
  /**
   * Determine if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} True if the error is retryable
   * @protected
   */
  _isRetryableError(error) {
    // Always retry on timeouts
    if (error instanceof TimeoutError || 
        error.name === 'TimeoutError' || 
        error.code === 'TIMEOUT_ERROR') {
      return true;
    }
    
    // Retry on connection errors
    if (error instanceof ConnectionError || 
        error.name === 'ConnectionError' || 
        error.code === 'CONNECTION_ERROR') {
      return true;
    }
    
    // Retry on network-related errors
    if (error.code && [
      'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ESOCKETTIMEDOUT',
      'ENOTFOUND', 'ENETUNREACH', 'EHOSTUNREACH', 'EPIPE', 'EAI_AGAIN'
    ].includes(error.code)) {
      return true;
    }
    
    // Retry on HTTP error codes that indicate temporary issues
    if (error.statusCode && [408, 425, 429, 500, 502, 503, 504, 507, 509].includes(error.statusCode)) {
      return true;
    }
    
    // Retry on AbortError (caused by timeouts)
    if (error.name === 'AbortError') {
      return true;
    }
    
    // Retry if the error message suggests a transient issue
    const transientErrorPatterns = [
      /timeout/i, /timed? out/i, 
      /retry/i, 
      /temporarily unavailable/i, 
      /connection (failed|dropped|reset)/i, 
      /server (unavailable|overloaded|error)/i,
      /network/i,
      /rate limit/i, /throttl/i,
      /econnreset/i, /econnrefused/i, /econntimeout/i
    ];
    
    if (error.message && transientErrorPatterns.some(pattern => pattern.test(error.message))) {
      return true;
    }
    
    return false;
  }

  /**
   * Wrap an execution error with more context
   * @param {Error} error - Original error
   * @param {string} command - Command name
   * @param {Object} parameters - Command parameters
   * @returns {Error} Wrapped error
   * @protected
   */
  _wrapExecutionError(error, command, parameters) {
    if (error instanceof TimeoutError || error instanceof ToolExecutionError) {
      return error; // Already properly formatted
    }
    
    return new ToolExecutionError(
      `${this.name} execution failed: ${error.message}`,
      this.name,
      command,
      {
        originalError: error,
        parameters: this._sanitizeParameters(parameters)
      }
    );
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   * @param {Object} parameters - Original parameters
   * @returns {Object} Sanitized parameters
   * @protected
   */
  _sanitizeParameters(parameters) {
    if (!parameters) return {};
    
    const result = { ...parameters };
    
    // Remove common sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'auth', 'credentials'];
    
    for (const field of sensitiveFields) {
      if (field in result) {
        result[field] = '[REDACTED]';
      }
    }
    
    return result;
  }

  /**
   * Calculate result size for logging
   * @param {any} result - The result to measure
   * @returns {Object} Size information
   * @protected
   */
  _calculateResultSize(result) {
    try {
      if (!result) return { type: typeof result, isEmpty: true };
      
      if (Array.isArray(result)) {
        return { type: 'array', length: result.length };
      }
      
      if (typeof result === 'object') {
        const keys = Object.keys(result);
        return { type: 'object', keyCount: keys.length };
      }
      
      if (typeof result === 'string') {
        return { type: 'string', length: result.length };
      }
      
      return { type: typeof result };
    } catch (error) {
      return { type: 'unknown', error: error.message };
    }
  }

  /**
   * Internal execution method to be implemented by subclasses
   * @param {string} command - Command name
   * @param {Object} parameters - Command parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Command result
   * @protected
   * @abstract
   */
  async _execute(command, parameters, options) {
    throw new Error('_execute() must be implemented by subclass');
  }

  /**
   * Health check for the adapter
   * @returns {Promise<Object>} Health check result
   */
  async healthCheck() {
    try {
      if (!this.connected) {
        await this.connect();
      }
      
      const result = await this._healthCheck();
      
      this.logger.debug({
        message: 'Health check successful',
        result
      });
      
      return {
        status: 'healthy',
        adapter: this.name,
        details: result
      };
    } catch (error) {
      this.logger.error({
        message: `Health check failed: ${error.message}`,
        error
      });
      
      return {
        status: 'unhealthy',
        adapter: this.name,
        error: error.message,
        details: error.details || {}
      };
    }
  }

  /**
   * Internal health check method to be implemented by subclasses
   * @returns {Promise<Object>} Health check details
   * @protected
   * @abstract
   */
  async _healthCheck() {
    throw new Error('_healthCheck() must be implemented by subclass');
  }
  
  /**
   * Track request completion and do any necessary cleanup
   * @param {string} command - Command name 
   */
  _trackRequestCompletion(command) {
    // Complete request tracking in timeout manager
    timeoutManager.completeRequest(this.name, command);
  }
}

export default BaseAdapter;
