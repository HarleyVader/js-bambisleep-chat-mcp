/**
 * Milvus MCP Server Adapter
 * Interface for interacting with the Milvus vector database through MCP
 */
import BaseAdapter from './base-adapter.js';
import config from '../utils/config.js';
import { ToolExecutionError, ConnectionError } from '../utils/errors.js';

// Get Milvus configuration
const milvusConfig = config.get('mcp.servers.milvus', {
  uri: 'http://127.0.0.1:19530',
  collection: 'bambisleep_data',
  vectorDimension: 1536
});

/**
 * Milvus Adapter class
 * @class MilvusAdapter
 * @extends BaseAdapter
 */
class MilvusAdapter extends BaseAdapter {
  constructor() {
    super('milvus', milvusConfig);
    
    this.collection = milvusConfig.collection;
    this.vectorDimension = milvusConfig.vectorDimension;
    this.schema = milvusConfig.schema;
  }

  /**
   * Connect to Milvus MCP server
   * @returns {Promise<void>}
   * @protected
   */
  async _connect() {
    try {
      // Test the connection by checking collections
      await this._execute('listCollections', {});
      this.logger.info('Connected to Milvus MCP server');
    } catch (error) {
      throw new ConnectionError(`Failed to connect to Milvus MCP server: ${error.message}`, 'milvus');
    }
  }

  /**
   * Disconnect from Milvus MCP server
   * @returns {Promise<void>}
   * @protected
   */
  async _disconnect() {
    // Nothing specific needed for disconnect in Milvus
    return Promise.resolve();
  }

  /**
   * Execute a command on Milvus MCP server
   * @param {string} command - Command name
   * @param {Object} parameters - Command parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Command result
   * @protected
   */
  async _execute(command, parameters, options) {
    // This would involve sending the request to the actual MCP server
    // For demonstration, we're creating a placeholder implementation
    
    // In a real implementation, this would make HTTP requests to the MCP server
    try {
      // Here we would make the actual API call to the MCP server
      // For example:
      // const response = await fetch('http://mcp-server/command', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ command, parameters })
      // });
      // return await response.json();
      
      this.logger.debug({
        message: `Executing Milvus command: ${command}`,
        parameters
      });
      
      // Simulated response
      return {
        success: true,
        command,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new ToolExecutionError(`Failed to execute Milvus command ${command}: ${error.message}`, 'milvus', {
        command,
        parameters,
        originalError: error.message
      });
    }
  }

  /**
   * Perform a health check
   * @returns {Promise<Object>} Health check details
   * @protected
   */
  async _healthCheck() {
    // For a real implementation, check if Milvus is responsive
    const result = await this._execute('listCollections', {});
    return {
      connected: true,
      collections: result.collections || []
    };
  }

  /**
   * Create a collection in Milvus
   * @param {string} collectionName - Name of the collection
   * @param {Object} schema - Collection schema
   * @returns {Promise<Object>} Creation result
   */
  async createCollection(collectionName, schema) {
    return this.execute('createCollection', {
      collection_name: collectionName,
      fields: schema.fields
    });
  }

  /**
   * Check if a collection exists
   * @param {string} collectionName - Name of the collection
   * @returns {Promise<boolean>} True if collection exists
   */
  async hasCollection(collectionName) {
    const result = await this.execute('hasCollection', {
      collection_name: collectionName
    });
    return result.has || false;
  }

  /**
   * Load a collection into memory
   * @param {string} collectionName - Name of the collection
   * @returns {Promise<Object>} Load result
   */
  async loadCollection(collectionName) {
    return this.execute('loadCollection', {
      collection_name: collectionName
    });
  }

  /**
   * Get collection statistics
   * @param {string} collectionName - Name of the collection
   * @returns {Promise<Object>} Collection statistics
   */
  async getCollectionStats(collectionName) {
    return this.execute('getCollectionStatistics', {
      collection_name: collectionName
    });
  }

  /**
   * Insert data into a collection
   * @param {string} collectionName - Name of the collection
   * @param {Array} data - Data to insert
   * @returns {Promise<Object>} Insert result
   */
  async insert(collectionName, data) {
    return this.execute('insert', {
      collection_name: collectionName,
      data
    });
  }

  /**
   * Perform a vector similarity search
   * @param {string} collectionName - Name of the collection
   * @param {Array} vector - Query vector
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async search(collectionName, vector, options = {}) {
    return this.execute('search', {
      collection_name: collectionName,
      vectors: [vector],
      search_params: options.searchParams || { metric_type: 'COSINE', params: { nprobe: 10 } },
      limit: options.limit || 10,
      output_fields: options.outputFields || ['*'],
      filter: options.filter || ''
    });
  }

  /**
   * Execute a query on a collection
   * @param {string} collectionName - Name of the collection
   * @param {string} filter - Query filter
   * @param {Array} outputFields - Fields to return
   * @returns {Promise<Object>} Query results
   */
  async query(collectionName, filter, outputFields = ['*']) {
    return this.execute('query', {
      collection_name: collectionName,
      filter,
      output_fields: outputFields
    });
  }

  /**
   * Delete entities from a collection
   * @param {string} collectionName - Name of the collection
   * @param {string} filter - Delete filter
   * @returns {Promise<Object>} Delete result
   */
  async delete(collectionName, filter) {
    return this.execute('delete', {
      collection_name: collectionName,
      filter
    });
  }

  /**
   * Initialize the default collection if it doesn't exist
   * @returns {Promise<void>}
   */
  async initializeDefaultCollection() {
    try {
      const collectionExists = await this.hasCollection(this.collection);
      
      if (!collectionExists) {
        this.logger.info(`Creating default collection: ${this.collection}`);
        
        await this.createCollection(this.collection, this.schema);
        await this.loadCollection(this.collection);
        
        this.logger.info(`Default collection created and loaded: ${this.collection}`);
      } else {
        this.logger.info(`Default collection already exists: ${this.collection}`);
        
        // Make sure collection is loaded
        await this.loadCollection(this.collection);
      }
    } catch (error) {
      this.logger.error({
        message: `Failed to initialize default collection: ${error.message}`,
        error
      });
      throw error;
    }
  }
}

// Export the class
export default MilvusAdapter;
