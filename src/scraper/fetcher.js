// Enhanced fetcher with browser automation support
import URLScraper from '../../lib/scraper.js';
import BrowserAutomation from './browser.js';
import logger from '../utils/logger.js';

export class EnhancedURLFetcher {
  constructor(options = {}) {
    this.basicScraper = new URLScraper();
    this.browserAutomation = new BrowserAutomation({
      headless: options.headless !== false,
      browser: options.browser || 'chromium',
      enableImages: false, // Disable for performance
      enableCSS: false,    // Disable for performance
      interceptRequests: true,
      ...options.browserOptions
    });
    
    this.options = {
      preferBrowser: options.preferBrowser || false,
      jsDetectionKeywords: options.jsDetectionKeywords || [
        'javascript', 'react', 'angular', 'vue', 'spa', 'ajax',
        'dynamic', 'async', 'xhr', 'fetch'
      ],
      fallbackToBrowser: options.fallbackToBrowser !== false,
      maxRetries: options.maxRetries || 2,
      ...options
    };
  }
  
  /**
   * Determine if a URL likely requires browser automation
   */
  async detectJavaScriptRequirement(url, basicContent = null) {
    try {
      // Check URL patterns that commonly indicate JS-heavy sites
      const jsIndicators = [
        /\/(app|dashboard|admin|spa)\//,
        /\.(vue|react|angular)/,
        /\/api\//,
        /\/#\//  // Hash routing
      ];
      
      for (const pattern of jsIndicators) {
        if (pattern.test(url)) {
          logger.debug('URL pattern indicates JS requirement', { url, pattern: pattern.source });
          return true;
        }
      }
      
      // If we have basic content, analyze it for JS indicators
      if (basicContent) {
        const content = basicContent.toLowerCase();
        
        // Check for JS frameworks/libraries
        const jsFrameworks = ['react', 'angular', 'vue', 'backbone', 'ember'];
        for (const framework of jsFrameworks) {
          if (content.includes(framework)) {
            logger.debug('Content indicates JS framework', { url, framework });
            return true;
          }
        }
        
        // Check for minimal content (possible SPA)
        const textContent = basicContent.replace(/<[^>]*>/g, '').trim();
        if (textContent.length < 200) {
          logger.debug('Minimal content suggests JS-rendered page', { url, length: textContent.length });
          return true;
        }
        
        // Check for specific JS indicators
        for (const keyword of this.options.jsDetectionKeywords) {
          if (content.includes(keyword)) {
            logger.debug('JS keyword detected', { url, keyword });
            return true;
          }
        }
      }
      
      return false;
    } catch (error) {
      logger.error('Error detecting JS requirement:', error);
      return false;
    }
  }
  
  /**
   * Fetch URL using basic scraper
   */
  async fetchBasic(url, options = {}) {
    try {
      logger.info('Fetching with basic scraper', { url });
      const result = await this.basicScraper.scrapeUrl(url, options);
      
      return {
        success: true,
        method: 'basic',
        data: result,
        metadata: {
          fetchedAt: new Date().toISOString(),
          method: 'basic',
          userAgent: this.basicScraper.userAgent
        }
      };
    } catch (error) {
      logger.error('Basic fetch failed:', error);
      return {
        success: false,
        method: 'basic',
        error: error.message
      };
    }
  }
  
  /**
   * Fetch URL using browser automation
   */
  async fetchWithBrowser(url, options = {}) {
    let sessionId = null;
    
    try {
      logger.info('Fetching with browser automation', { url });
      
      // Create browser session
      sessionId = await this.browserAutomation.createSession();
      
      // Navigate to URL
      const navigationResult = await this.browserAutomation.navigateToUrl(sessionId, url, {
        waitForNetworkIdle: true,
        waitForJS: true,
        jsWaitTime: options.jsWaitTime || 3000,
        ...options.navigationOptions
      });
      
      if (!navigationResult.success) {
        throw new Error(`Navigation failed: ${navigationResult.error}`);
      }
      
      // Extract content
      const content = await this.browserAutomation.extractContent(sessionId, {
        waitForContent: true,
        ...options.extractionOptions
      });
      
      // Format result to match basic scraper format
      const formattedResult = {
        url,
        content: {
          title: navigationResult.metadata.title,
          description: navigationResult.metadata.description,
          mainContent: content.mainContent,
          wordCount: content.wordCount,
          headings: content.structured.headings,
          links: content.structured.links,
          images: content.structured.images
        },
        metadata: {
          ...navigationResult.metadata,
          fetchedAt: new Date().toISOString(),
          method: 'browser',
          extractionStrategies: content.strategies,
          structuredData: content.structured
        }
      };
      
      return {
        success: true,
        method: 'browser',
        data: formattedResult,
        metadata: formattedResult.metadata
      };
      
    } catch (error) {
      logger.error('Browser fetch failed:', error);
      return {
        success: false,
        method: 'browser',
        error: error.message
      };
    } finally {
      // Always close the session
      if (sessionId) {
        await this.browserAutomation.closeSession(sessionId);
      }
    }
  }
  
  /**
   * Smart fetch that chooses the best method
   */
  async smartFetch(url, options = {}) {
    let basicResult = null;
    let browserResult = null;
    
    try {
      // Always try basic first unless preferBrowser is true
      if (!this.options.preferBrowser) {
        basicResult = await this.fetchBasic(url, options);        if (basicResult.success) {
          // Check if content suggests JS requirement
          const needsBrowser = await this.detectJavaScriptRequirement(
            url, 
            basicResult.data.content?.mainContent
          );
          
          if (!needsBrowser) {
            logger.info('Basic fetch successful and sufficient', { url });
            return basicResult;
          } else if (!this.options.fallbackToBrowser) {
            logger.info('JS detected but browser fallback disabled', { url });
            return basicResult;
          }
          
          logger.info('JS requirement detected, trying browser fallback', { url });
        }
      }
      
      // Try browser automation
      browserResult = await this.fetchWithBrowser(url, options);
      
      if (browserResult.success) {
        logger.info('Browser fetch successful', { url });
        return browserResult;
      }
      
      // If browser failed and we have basic result, return it
      if (basicResult && basicResult.success) {
        logger.info('Browser failed, falling back to basic result', { url });
        return {
          ...basicResult,
          warnings: ['Browser automation failed, using basic scraper result']
        };
      }
      
      // Both methods failed
      throw new Error(`All fetch methods failed. Basic: ${basicResult?.error}, Browser: ${browserResult?.error}`);
      
    } catch (error) {
      logger.error('Smart fetch failed completely:', error);
      return {
        success: false,
        method: 'failed',
        error: error.message,
        attempts: {
          basic: basicResult,
          browser: browserResult
        }
      };
    }
  }
  
  /**
   * Batch fetch multiple URLs
   */
  async batchFetch(urls, options = {}) {
    const results = [];
    const batchOptions = {
      concurrency: options.concurrency || 3,
      delay: options.delay || 1000,
      ...options
    };
    
    logger.info('Starting batch fetch', { 
      urlCount: urls.length, 
      concurrency: batchOptions.concurrency 
    });
    
    // Process URLs in batches
    const batches = [];
    for (let i = 0; i < urls.length; i += batchOptions.concurrency) {
      batches.push(urls.slice(i, i + batchOptions.concurrency));
    }
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      logger.info(`Processing batch ${batchIndex + 1}/${batches.length}`, {
        batchSize: batch.length
      });
      
      // Process batch in parallel
      const batchPromises = batch.map(async (url) => {
        try {
          const result = await this.smartFetch(url, options);
          return { url, ...result };
        } catch (error) {
          return {
            url,
            success: false,
            method: 'failed',
            error: error.message
          };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Process results
      for (const promiseResult of batchResults) {
        if (promiseResult.status === 'fulfilled') {
          results.push(promiseResult.value);
        } else {
          results.push({
            url: 'unknown',
            success: false,
            method: 'failed',
            error: promiseResult.reason?.message || 'Unknown error'
          });
        }
      }
      
      // Delay between batches (except for the last batch)
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, batchOptions.delay));
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    logger.info('Batch fetch completed', {
      total: results.length,
      successful: successCount,
      failed: failCount,
      successRate: `${((successCount / results.length) * 100).toFixed(1)}%`
    });
    
    return {
      results,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failCount,
        successRate: successCount / results.length
      }
    };
  }
  
  /**
   * Test URL accessibility and requirements
   */
  async testUrl(url) {
    logger.info('Testing URL', { url });
    
    const results = {
      url,
      accessible: false,
      requiresBrowser: false,
      basicWorking: false,
      browserWorking: false,
      recommendations: [],
      performance: {}
    };
    
    // Test basic scraper
    const startBasic = Date.now();
    const basicResult = await this.fetchBasic(url);
    const basicTime = Date.now() - startBasic;
    
    results.basicWorking = basicResult.success;
    results.performance.basic = basicTime;
    
    if (basicResult.success) {
      results.accessible = true;
      results.requiresBrowser = await this.detectJavaScriptRequirement(
        url, 
        basicResult.data?.content?.mainContent
      );
    }
    
    // Test browser automation
    const startBrowser = Date.now();
    const browserResult = await this.fetchWithBrowser(url);
    const browserTime = Date.now() - startBrowser;
    
    results.browserWorking = browserResult.success;
    results.performance.browser = browserTime;
    
    if (browserResult.success && !results.accessible) {
      results.accessible = true;
      results.requiresBrowser = true;
    }
    
    // Generate recommendations
    if (results.basicWorking && !results.requiresBrowser) {
      results.recommendations.push('Use basic scraper for optimal performance');
    } else if (results.requiresBrowser && results.browserWorking) {
      results.recommendations.push('Use browser automation for complete content');
    } else if (results.basicWorking && !results.browserWorking) {
      results.recommendations.push('Use basic scraper as fallback');
    } else if (!results.accessible) {
      results.recommendations.push('URL may be inaccessible or require authentication');
    }
    
    return results;
  }
  
  /**
   * Cleanup resources
   */
  async cleanup() {
    await this.browserAutomation.cleanup();
  }
}

// Create a default instance for easy importing
export const enhancedFetcher = new EnhancedURLFetcher();

// Add convenience method for backward compatibility
enhancedFetcher.fetchUrl = enhancedFetcher.smartFetch.bind(enhancedFetcher);

export default EnhancedURLFetcher;
