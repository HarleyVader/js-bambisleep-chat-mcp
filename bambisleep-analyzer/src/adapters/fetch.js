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
  }
  /**
   * Execute a command on Fetch MCP server
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
        message: `Executing Fetch command: ${command}`,
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
          statusCode: 200,
          headers: {
            'content-type': 'text/html'
          },
          body: '<html><body><h1>Example</h1></body></html>', // Simulated content
          responseTime: Date.now() - startTime
        }),
        
        // Timeout handler
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new TimeoutError(
              `Fetch command timed out after ${timeoutMs}ms`, 
              command,
              { 
                operation: command,
                url: parameters.url,
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
