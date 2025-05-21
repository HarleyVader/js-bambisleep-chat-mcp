/**
 * Fetch MCP Server Adapter
 * Interface for retrieving web content through Fetch MCP
 */
import BaseAdapter from './base-adapter.js';
import config from '../utils/config.js';
import timeoutManager from '../utils/timeout-manager.js';
import { ToolExecutionError, TimeoutError } from '../utils/errors.js';

// Get Fetch configuration
const fetchConfig = config.get('mcp.servers.fetch', {
  timeout: 30000,  // Increased from 15000
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
});

/**
 * Fetch Adapter class
 * @class FetchAdapter
 * @extends BaseAdapter
 */
class FetchAdapter extends BaseAdapter {
  constructor() {
    super('fetch', fetchConfig);
    
    this.timeout = fetchConfig.timeout;
    this.userAgent = fetchConfig.userAgent;
  }

  /**
   * Connect to Fetch MCP server
   * @returns {Promise<void>}
   * @protected
   */
  async _connect() {
    try {
      // Test connection with a simple fetch
      await this._execute('fetch', { url: 'https://example.com' });
      this.logger.info('Connected to Fetch MCP server');
    } catch (error) {
      throw new Error(`Failed to connect to Fetch MCP server: ${error.message}`);
    }
  }

  /**
   * Disconnect from Fetch MCP server
   * @returns {Promise<void>}
   * @protected
   */
  async _disconnect() {
    // Nothing specific needed for disconnect
    return Promise.resolve();
  }  /**
   * Execute a command on Fetch MCP server
   * @param {string} command - Command name
   * @param {Object} parameters - Command parameters
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Command result
   * @protected
   */
  async _execute(command, parameters, options = {}) {
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
        message: `Executing Fetch command: ${command}`,
        parameters: {
          url: parameters.url,
          method: parameters.method
        },
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
        // Simulate operation time (for testing)
        const operationTime = Math.floor(Math.random() * 1000);
        await new Promise(resolve => setTimeout(resolve, operationTime));
        
        return {
          success: true,
          command,
          timestamp: new Date().toISOString(),
          statusCode: 200,
          headers: {
            'content-type': 'text/html'
          },
          body: '<html><body><h1>Example</h1></body></html>', // Simulated content
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
          `Fetch command timed out after ${timeoutMs}ms`, 
          command,
          { 
            operation: command,
            url: parameters.url,
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
            message: `Retrying Fetch command after timeout (${retryAttempt+1}/${maxRetries})`,
            command,
            url: parameters.url,
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
        `Failed to execute Fetch command ${command}: ${error.message}`, 
        'fetch', 
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
    // For a real implementation, check if Fetch MCP is responsive
    const result = await this._execute('fetch', { url: 'https://example.com' }, { timeout: this.timeout });
    return {
      connected: true,
      statusCode: result.statusCode
    };
  }

  /**
   * Fetch content from a URL
   * @param {string} url - URL to fetch
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Fetch result
   */
  async fetchUrl(url, options = {}) {
    const fetchOptions = {
      method: options.method || 'GET',
      headers: {
        'User-Agent': options.userAgent || this.userAgent,
        ...options.headers
      },
      followRedirects: options.followRedirects !== false,
      maxRedirects: options.maxRedirects || 5,
      timeout: options.timeout || this.timeout
    };
    
    if (options.body) {
      fetchOptions.body = options.body;
    }
    
    return this.execute('fetch', {
      url,
      ...fetchOptions
    }, {
      timeout: fetchOptions.timeout
    });
  }

  /**
   * Extract text content from HTML
   * @param {string} html - HTML content
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} Extraction result
   */
  async extractText(html, options = {}) {
    return this.execute('extractText', {
      html,
      selector: options.selector || 'body',
      includeImages: options.includeImages || false,
      preserveLinks: options.preserveLinks || false
    });
  }

  /**
   * Fetch and extract text from a URL
   * @param {string} url - URL to fetch
   * @param {Object} options - Options for both fetch and extraction
   * @returns {Promise<Object>} Combined result
   */
  async fetchAndExtract(url, options = {}) {
    const fetchResult = await this.fetchUrl(url, options);
    
    if (fetchResult.statusCode >= 200 && fetchResult.statusCode < 300) {
      const contentType = fetchResult.headers['content-type'] || '';
      
      if (contentType.includes('text/html')) {
        const extractResult = await this.extractText(fetchResult.body, options);
        
        return {
          url,
          statusCode: fetchResult.statusCode,
          contentType,
          title: extractResult.title || '',
          text: extractResult.text || '',
          links: extractResult.links || [],
          success: true
        };
      } else {
        return {
          url,
          statusCode: fetchResult.statusCode,
          contentType,
          text: '',
          success: true,
          message: 'Content is not HTML'
        };
      }
    } else {
      return {
        url,
        statusCode: fetchResult.statusCode,
        success: false,
        message: `HTTP error: ${fetchResult.statusCode}`
      };
    }
  }
}

// Export the class
export default FetchAdapter;
