/**
 * Memory MCP Server Adapter
 * Interface for persistent memory storage through Memory MCP
 */
import BaseAdapter from './base-adapter.js';
import config from '../utils/config.js';
import { ToolExecutionError, NotFoundError } from '../utils/errors.js';

// Get Memory configuration
const memoryConfig = config.get('mcp.servers.memory', {
  persistent: true,
  storagePath: './data/memory'
});

/**
 * Memory Adapter class
 * @class MemoryAdapter
 * @extends BaseAdapter
 */
class MemoryAdapter extends BaseAdapter {
  constructor() {
    super('memory', memoryConfig);
    
    this.persistent = memoryConfig.persistent;
    this.storagePath = memoryConfig.storagePath;
  }
  /**
   * Connect to Memory MCP server
   * @returns {Promise<void>}
   * @protected
   */  async _connect() {
    try {
      // Test connection with a simple operation
      const result = await this._execute('get', { key: 'connection-test' });
      
      // Check if the connection test was successful but the key wasn't found
      if (result && !result.found && result.key === 'connection-test') {
        this.logger.info('Connected to Memory MCP server (connection-test key not found)');
        return;
      }
      
      this.logger.info('Connected to Memory MCP server');
    } catch (error) {
      // Only re-throw for other types of errors
      throw new Error(`Failed to connect to Memory MCP server: ${error.message}`);
    }
  }

  /**
   * Disconnect from Memory MCP server
   * @returns {Promise<void>}
   * @protected
   */
  async _disconnect() {
    // Nothing specific needed for disconnect
    return Promise.resolve();
  }

  /**
   * Execute a command on Memory MCP server
   * @param {string} command - Command name
   * @param {Object} parameters - Command parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Command result
   * @protected
   */  async _execute(command, parameters, options = {}) {
    // In a real implementation, this would send the request to the actual MCP server
    
    try {
      // Here we would make the actual API call to the MCP server
      this.logger.debug({
        message: `Executing Memory command: ${command}`,
        parameters
      });
        // Simulate command execution based on command type
      switch (command) {
        case 'get':
          if (parameters.key === 'connection-test') {
            // For connection test, we'll handle this special case without throwing an error
            // When testing a connection, the "connection-test" key not existing is expected behavior
            this.logger.debug('Connection test: key not found (expected behavior)');
            return {
              key: parameters.key,
              value: null,
              found: false,
              message: 'Connection test successful, key not found as expected'
            };
          }
          return {
            key: parameters.key,
            value: {}, // Simulated empty value
            found: true
          };
          
        case 'set':
          return {
            key: parameters.key,
            success: true
          };
          
        case 'delete':
          return {
            key: parameters.key,
            success: true
          };
          
        case 'list':
          return {
            keys: [], // Simulated empty list
            count: 0
          };
          
        default:
          throw new Error(`Unknown command: ${command}`);
      }
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      throw new ToolExecutionError(
        `Failed to execute Memory command ${command}: ${error.message}`, 
        'memory', 
        {
          command,
          parameters,
          originalError: error.message
        }
      );
    }
  }

  /**
   * Perform a health check
   * @returns {Promise<Object>} Health check details
   * @protected
   */
  async _healthCheck() {
    // For a real implementation, check if Memory MCP is responsive
    try {
      await this._execute('list', { prefix: 'health-check' });
      return {
        connected: true,
        persistent: this.persistent
      };
    } catch (error) {
      if (error instanceof NotFoundError) {
        return {
          connected: true,
          persistent: this.persistent
        };
      }
      throw error;
    }
  }

  /**
   * Get a value from memory
   * @param {string} key - Key to retrieve
   * @returns {Promise<Object>} Retrieved value
   * @throws {NotFoundError} If key not found
   */
  async get(key) {
    const result = await this.execute('get', { key });
    
    if (!result.found) {
      throw new NotFoundError(`Key not found: ${key}`);
    }
    
    return result.value;
  }

  /**
   * Store a value in memory
   * @param {string} key - Key to store
   * @param {Object} value - Value to store
   * @param {Object} options - Storage options
   * @returns {Promise<Object>} Storage result
   */
  async set(key, value, options = {}) {
    return this.execute('set', {
      key,
      value,
      ttl: options.ttl,
      tags: options.tags
    });
  }

  /**
   * Delete a value from memory
   * @param {string} key - Key to delete
   * @returns {Promise<Object>} Deletion result
   */
  async delete(key) {
    return this.execute('delete', { key });
  }

  /**
   * List keys in memory
   * @param {Object} options - List options
   * @returns {Promise<Object>} List result
   */
  async list(options = {}) {
    return this.execute('list', {
      prefix: options.prefix,
      tag: options.tag,
      limit: options.limit
    });
  }

  /**
   * Store conversation data in memory
   * @param {string} conversationId - Conversation identifier
   * @param {Array} messages - Conversation messages
   * @returns {Promise<Object>} Storage result
   */
  async storeConversation(conversationId, messages) {
    return this.set(`conversation:${conversationId}`, {
      id: conversationId,
      messages,
      updatedAt: new Date().toISOString()
    });
  }

  /**
   * Retrieve conversation data from memory
   * @param {string} conversationId - Conversation identifier
   * @returns {Promise<Object>} Conversation data
   * @throws {NotFoundError} If conversation not found
   */
  async getConversation(conversationId) {
    return this.get(`conversation:${conversationId}`);
  }

  /**
   * List all conversations
   * @param {Object} options - List options
   * @returns {Promise<Array>} List of conversation IDs
   */
  async listConversations(options = {}) {
    const result = await this.list({
      prefix: 'conversation:',
      limit: options.limit
    });
    
    return result.keys.map(key => key.replace('conversation:', ''));
  }
}

// Export the class
export default MemoryAdapter;
