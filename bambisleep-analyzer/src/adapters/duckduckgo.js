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
  }  /**
   * Execute a command on DuckDuckGo MCP server
   * @param {string} command - Command name
   * @param {Object} parameters - Command parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Command result
   * @protected
   */
  async _execute(command, parameters, options = {}) {
    // In a real implementation, this would send the request to the actual MCP server
    
    // Get max retries and current retry attempt
    const maxRetries = timeoutManager.getMaxRetries(this.name, options);
    const retryAttempt = options.retryAttempt || 0;
    
    // Set up a timeout for the operation using timeout manager
    // Increase timeout for retry attempts to give more time
    const baseTimeoutMs = options.timeout || timeoutManager.getTimeout(this.name, command, options);
    // Add 20% more time for each retry attempt
    const timeoutMs = Math.floor(baseTimeoutMs * (1 + retryAttempt * 0.2));
    
    const startTime = Date.now();
    let timerHandle;
    
    try {
      this.logger.debug({
        message: `Executing DuckDuckGo command: ${command}`,
        parameters,
        timeoutMs,
        retryAttempt
      });
      
      // Create an abortable fetch operation
      const abortController = new AbortController();
      const signal = abortController.signal;
      
      // Set up the timeout
      timerHandle = setTimeout(() => {
        abortController.abort();
      }, timeoutMs);
      
      // In a real implementation, we would use the abort signal with the fetch call
      // For the simulation, we'll just resolve with mock data after a delay
      const simulateOperation = async () => {
        // Simulate operation time (for testing purposes only)
        const operationTime = Math.floor(Math.random() * 1000);
        await new Promise(resolve => setTimeout(resolve, operationTime));
        
        return {
          success: true,
          command,
          timestamp: new Date().toISOString(),
          results: [], // Simulated empty results
          responseTime: Date.now() - startTime
        };
      };
        // Execute the operation with abort signal handling
      const result = await simulateOperation();
      
      // Clear the timeout since operation completed
      clearTimeout(timerHandle);
      
      // Track request completion for throttling purposes
      timeoutManager.completeRequest(this.name, command);
      
      return result;
    } catch (error) {
      // Clean up timeout if it exists
      if (timerHandle) {
        clearTimeout(timerHandle);
      }
      
      // Handle aborted requests as timeouts
      if (error.name === 'AbortError' || error instanceof TimeoutError) {
        const timeoutError = new TimeoutError(
          `DuckDuckGo command timed out after ${timeoutMs}ms`, 
          command,
          { 
            operation: command,
            parameters: JSON.stringify(parameters).substring(0, 200)
          }
        );
        
        // Record the timeout in the timeout manager
        timeoutManager.recordError(this.name, command, timeoutError);
            // If we have retries remaining, retry with backoff
        if (retryAttempt < maxRetries) {
          // Calculate backoff with throttling consideration
          const totalDelay = timeoutManager.getDelayForOperation(this.name, command, retryAttempt);
          
          this.logger.info({
            message: `Retrying DuckDuckGo command after timeout (${retryAttempt+1}/${maxRetries})`,
            command,
            totalDelay,
            nextTimeout: timeoutMs * 1.2
          });
          
          // Wait for backoff time
          await new Promise(resolve => setTimeout(resolve, totalDelay));
          
          // Retry with incremented attempt number
          return this._execute(command, parameters, {
            ...options,
            retryAttempt: retryAttempt + 1
          });
        }
        
        throw timeoutError;
      }
      
      // Other errors
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
