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
      parameters,
      options
    });
    
    // Get retry configuration
    const maxRetries = timeoutManager.getMaxRetries(this.name, options);
    let attemptCount = 0;
    let lastError = null;
    
    // Execution with retry logic
    while (attemptCount <= maxRetries) {
      try {
        // Calculate timeout for this attempt (with backoff if it's a retry)
        const timeoutMultiplier = attemptCount > 0 ? attemptCount : 1;
        const baseTimeout = timeoutManager.getTimeout(this.name, command, options);
        const attemptTimeout = Math.min(baseTimeout * timeoutMultiplier, 120000); // Cap at 2 minutes
        
        // Update options with current timeout
        const attemptOptions = {
          ...options,
          timeout: attemptTimeout,
          retryAttempt: attemptCount
        };
        
        // Log retry attempt if applicable
        if (attemptCount > 0) {
          executionLogger.info({
            message: `Retry attempt ${attemptCount}/${maxRetries} for command ${command}`,
            timeout: attemptTimeout,
            lastError: lastError ? lastError.message : null
          });
        }
        
        // Execute the command
        const result = await this._execute(command, parameters, attemptOptions);
        
        executionLogger.debug({
          message: 'Command executed successfully',
          retryAttempt: attemptCount
        });
        
        // Add retry information to result if applicable
        if (attemptCount > 0) {
          return {
            ...result,
            _meta: {
              retryCount: attemptCount,
              originalError: lastError ? lastError.message : null
            }
          };
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Record timeout errors
        if (error instanceof TimeoutError || error.code === 'TIMEOUT_ERROR') {
          timeoutManager.recordError(this.name, command, error);
        }
        
        // Check if we should retry
        if (attemptCount < maxRetries && 
            (error instanceof TimeoutError || 
             error.code === 'TIMEOUT_ERROR' || 
             error.code === 'CONNECTION_ERROR' ||
             (options.retryableErrors && options.retryableErrors.includes(error.code)))) {
          
          attemptCount++;
          
          // Calculate backoff time
          const backoffMs = timeoutManager.calculateBackoff(attemptCount, this.name);
          
          executionLogger.warn({
            message: `Command failed, will retry in ${backoffMs}ms (${attemptCount}/${maxRetries})`,
            error: error.message,
            backoffMs
          });
          
          // Wait before next attempt
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
        
        // If we reach here, either we've exhausted retries or it's not a retryable error
        executionLogger.error({
          message: `Command execution failed: ${error.message}`,
          error,
          retryAttempts: attemptCount
        });
        
        throw error;
      }
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
}

export default BaseAdapter;
