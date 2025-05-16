/**
 * DuckDuckGo MCP Server Adapter
 * Interface for web search operations through DuckDuckGo MCP
 */
import BaseAdapter from './base-adapter.js';
import config from '../utils/config.js';
import timeoutManager from '../utils/timeout-manager.js';
import { ToolExecutionError, TimeoutError } from '../utils/errors.js';

// Get DuckDuckGo configuration
const ddgConfig = config.get('mcp.servers.duckduckgo', {
  timeout: 20000,  // Increased from 10000
  maxResults: 30
});

/**
 * DuckDuckGo Adapter class
 * @class DuckDuckGoAdapter
 * @extends BaseAdapter
 */
class DuckDuckGoAdapter extends BaseAdapter {
  constructor() {
    super('duckduckgo', ddgConfig);
    
    this.timeout = ddgConfig.timeout;
    this.maxResults = ddgConfig.maxResults;
    this.searchKeywords = ddgConfig.searchKeywords || [];
  }

  /**
   * Connect to DuckDuckGo MCP server
   * @returns {Promise<void>}
   * @protected
   */
  async _connect() {
    try {
      // Test connection with a simple search
      await this._execute('search', { query: 'test' });
      this.logger.info('Connected to DuckDuckGo MCP server');
    } catch (error) {
      throw new Error(`Failed to connect to DuckDuckGo MCP server: ${error.message}`);
    }
  }

  /**
   * Disconnect from DuckDuckGo MCP server
   * @returns {Promise<void>}
   * @protected
   */
  async _disconnect() {
    // Nothing specific needed for disconnect
    return Promise.resolve();
  }
  /**
   * Execute a command on DuckDuckGo MCP server
   * @param {string} command - Command name
   * @param {Object} parameters - Command parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Command result
   * @protected
   */
  async _execute(command, parameters, options = {}) {
    // In a real implementation, this would send the request to the actual MCP server
    
    // Set up a timeout for the operation using timeout manager
    const timeoutMs = options.timeout || timeoutManager.getTimeout(this.name, command, options);
    const startTime = Date.now();
    
    try {
      // Here we would make the actual API call to the MCP server
      this.logger.debug({
        message: `Executing DuckDuckGo command: ${command}`,
        parameters,
        timeoutMs,
        retryAttempt: options.retryAttempt || 0
      });
      
      // Simulate potential timeout 
      const result = await Promise.race([
        // This would be the actual implementation
        Promise.resolve({
          success: true,
          command,
          timestamp: new Date().toISOString(),
          results: [], // Simulated empty results
          responseTime: Date.now() - startTime
        }),
        
        // Timeout handler
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new TimeoutError(
              `DuckDuckGo command timed out after ${timeoutMs}ms`, 
              command,
              { 
                operation: command,
                parameters: JSON.stringify(parameters).substring(0, 200)
              }
            ));
          }, timeoutMs);
        })
      ]);
      
      return result;
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      
      throw new ToolExecutionError(
        `Failed to execute DuckDuckGo command ${command}: ${error.message}`, 
        'duckduckgo', 
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
    // For a real implementation, check if DuckDuckGo MCP is responsive
    const result = await this._execute('search', { query: 'health check' }, { timeout: this.timeout });
    return {
      connected: true,
      responseTime: result.responseTime || 0
    };
  }

  /**
   * Perform a web search
   * @param {string} query - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async search(query, options = {}) {
    const searchOptions = {
      maxResults: options.maxResults || this.maxResults,
      region: options.region || 'wt-wt',
      safeSearch: options.safeSearch || 'moderate',
      time: options.time || null,
      type: options.type || 'web'
    };
    
    return this.execute('search', {
      query,
      ...searchOptions
    }, {
      timeout: options.timeout || this.timeout
    });
  }

  /**
   * Perform multiple searches for predefined keywords
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Combined search results
   */
  async searchKeywords(options = {}) {
    if (!this.searchKeywords || this.searchKeywords.length === 0) {
      throw new Error('No search keywords defined');
    }
    
    const results = [];
    
    for (const keyword of this.searchKeywords) {
      try {
        const result = await this.search(keyword, options);
        
        if (result.results && result.results.length > 0) {
          results.push({
            keyword,
            results: result.results,
            totalResults: result.totalResults || result.results.length
          });
        }
      } catch (error) {
        this.logger.error({
          message: `Failed to search for keyword "${keyword}": ${error.message}`,
          keyword,
          error
        });
      }
    }
    
    return results;
  }
}

// Export the class
export default DuckDuckGoAdapter;
