// Advanced browser automation for JavaScript-heavy sites using Playwright
import { chromium, firefox, webkit } from 'playwright';
import { logger } from '../../src/utils/logger.js';
import UserAgent from 'user-agents';

export class BrowserAutomation {
  constructor(options = {}) {
    this.options = {
      headless: options.headless !== false, // Default to headless
      browser: options.browser || 'chromium', // chromium, firefox, webkit
      timeout: options.timeout || 30000,
      waitForSelector: options.waitForSelector || 'body',
      waitForJS: options.waitForJS !== false, // Wait for JS to load
      viewport: options.viewport || { width: 1280, height: 720 },
      userAgent: options.userAgent || new UserAgent().toString(),
      enableImages: options.enableImages !== false,
      enableCSS: options.enableCSS !== false,
      enableJavaScript: options.enableJavaScript !== false,
      interceptRequests: options.interceptRequests || false,
      sessionTimeout: options.sessionTimeout || 300000, // 5 minutes
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000
    };
    
    this.browser = null;
    this.context = null;
    this.pages = new Map(); // Store pages by session ID
    this.sessionTimeouts = new Map(); // Track session timeouts
  }
  
  /**
   * Initialize browser instance
   */
  async initialize() {
    if (this.browser) return this.browser;
    
    try {
      logger.info('Initializing browser automation', { 
        browser: this.options.browser,
        headless: this.options.headless 
      });
      
      const browserOptions = {
        headless: this.options.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      };
      
      switch (this.options.browser) {
        case 'firefox':
          this.browser = await firefox.launch(browserOptions);
          break;
        case 'webkit':
          this.browser = await webkit.launch(browserOptions);
          break;
        default:
          this.browser = await chromium.launch(browserOptions);
      }
      
      // Create persistent context
      this.context = await this.browser.newContext({
        viewport: this.options.viewport,
        userAgent: this.options.userAgent,
        ignoreHTTPSErrors: true,
        javaScriptEnabled: this.options.enableJavaScript
      });
      
      // Set up request interception if enabled
      if (this.options.interceptRequests) {
        await this.setupRequestInterception();
      }
      
      logger.info('Browser automation initialized successfully');
      return this.browser;
      
    } catch (error) {
      logger.error('Failed to initialize browser automation:', error);
      throw error;
    }
  }
  
  /**
   * Set up request interception for performance optimization
   */
  async setupRequestInterception() {
    await this.context.route('**/*', (route) => {
      const request = route.request();
      const resourceType = request.resourceType();
      
      // Block unnecessary resources to speed up loading
      if (!this.options.enableImages && (resourceType === 'image' || resourceType === 'media')) {
        route.abort();
        return;
      }
      
      if (!this.options.enableCSS && resourceType === 'stylesheet') {
        route.abort();
        return;
      }
      
      // Block ads and tracking
      const url = request.url().toLowerCase();
      if (url.includes('google-analytics') || 
          url.includes('googletagmanager') ||
          url.includes('doubleclick') ||
          url.includes('facebook.net') ||
          url.includes('twitter.com/i/') ||
          resourceType === 'font') {
        route.abort();
        return;
      }
      
      route.continue();
    });
  }
  
  /**
   * Create a new browser session
   */
  async createSession(sessionId = null) {
    await this.initialize();
    
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    try {
      const page = await this.context.newPage();
      
      // Set up page event listeners
      page.on('console', msg => {
        if (msg.type() === 'error') {
          logger.debug('Browser console error:', msg.text());
        }
      });
      
      page.on('pageerror', error => {
        logger.debug('Browser page error:', error.message);
      });
      
      // Store page in session map
      this.pages.set(sessionId, page);
      
      // Set up session timeout
      const timeoutId = setTimeout(() => {
        this.closeSession(sessionId);
      }, this.options.sessionTimeout);
      
      this.sessionTimeouts.set(sessionId, timeoutId);
      
      logger.info('Browser session created', { sessionId });
      return sessionId;
      
    } catch (error) {
      logger.error('Failed to create browser session:', error);
      throw error;
    }
  }
  
  /**
   * Navigate to URL with advanced loading strategies
   */
  async navigateToUrl(sessionId, url, options = {}) {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    const navigationOptions = {
      waitUntil: options.waitUntil || 'domcontentloaded',
      timeout: options.timeout || this.options.timeout
    };
    
    let attempt = 0;
    while (attempt < this.options.maxRetries) {
      try {
        logger.info('Navigating to URL', { url, sessionId, attempt });
        
        // Navigate to the page
        const response = await page.goto(url, navigationOptions);
        
        if (!response) {
          throw new Error('No response received');
        }
        
        if (!response.ok() && response.status() !== 304) {
          throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
        }
        
        // Wait for additional conditions based on options
        await this.waitForPageReady(page, options);
        
        // Extract page metadata
        const metadata = await this.extractPageMetadata(page);
        
        logger.info('Navigation successful', { 
          url, 
          sessionId, 
          status: response.status(),
          loadTime: metadata.loadTime 
        });
        
        return {
          success: true,
          status: response.status(),
          url: response.url(),
          metadata
        };
        
      } catch (error) {
        attempt++;
        logger.warn(`Navigation attempt ${attempt} failed`, { 
          url, 
          sessionId, 
          error: error.message 
        });
        
        if (attempt < this.options.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, this.options.retryDelay * attempt));
        } else {
          throw error;
        }
      }
    }
  }
  
  /**
   * Wait for page to be ready based on various conditions
   */
  async waitForPageReady(page, options = {}) {
    const waitConditions = [];
    
    // Wait for specific selector
    if (options.waitForSelector || this.options.waitForSelector) {
      waitConditions.push(
        page.waitForSelector(options.waitForSelector || this.options.waitForSelector, {
          timeout: options.timeout || this.options.timeout
        }).catch(() => {
          logger.debug('Selector wait timeout, continuing anyway');
        })
      );
    }
    
    // Wait for network idle
    if (options.waitForNetworkIdle) {
      waitConditions.push(
        page.waitForLoadState('networkidle', {
          timeout: options.timeout || this.options.timeout
        }).catch(() => {
          logger.debug('Network idle timeout, continuing anyway');
        })
      );
    }
    
    // Wait for JavaScript to execute
    if (this.options.waitForJS || options.waitForJS) {
      waitConditions.push(
        page.waitForTimeout(options.jsWaitTime || 2000)
      );
    }
    
    // Wait for custom condition
    if (options.waitForFunction) {
      waitConditions.push(
        page.waitForFunction(options.waitForFunction, {
          timeout: options.timeout || this.options.timeout
        }).catch(() => {
          logger.debug('Custom function wait timeout, continuing anyway');
        })
      );
    }
    
    // Execute all wait conditions
    if (waitConditions.length > 0) {
      await Promise.allSettled(waitConditions);
    }
    
    // Additional delay if specified
    if (options.additionalDelay) {
      await page.waitForTimeout(options.additionalDelay);
    }
  }
  
  /**
   * Extract comprehensive page metadata
   */
  async extractPageMetadata(page) {
    try {
      const metadata = await page.evaluate(() => {
        const performance = window.performance;
        const timing = performance.timing;
        
        return {
          title: document.title,
          url: window.location.href,
          description: document.querySelector('meta[name="description"]')?.content || '',
          keywords: document.querySelector('meta[name="keywords"]')?.content || '',
          author: document.querySelector('meta[name="author"]')?.content || '',
          ogTitle: document.querySelector('meta[property="og:title"]')?.content || '',
          ogDescription: document.querySelector('meta[property="og:description"]')?.content || '',
          ogImage: document.querySelector('meta[property="og:image"]')?.content || '',
          canonical: document.querySelector('link[rel="canonical"]')?.href || '',
          language: document.documentElement.lang || '',
          charset: document.characterSet || 'UTF-8',
          loadTime: timing.loadEventEnd - timing.navigationStart,
          domReady: timing.domContentLoadedEventEnd - timing.navigationStart,
          firstPaint: performance.getEntriesByType('paint')[0]?.startTime || 0,
          scriptsCount: document.scripts.length,
          imagesCount: document.images.length,
          linksCount: document.links.length,
          bodyLength: document.body?.innerText?.length || 0,
          hasJavaScript: document.scripts.length > 0,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        };
      });
      
      return metadata;
      
    } catch (error) {
      logger.error('Failed to extract page metadata:', error);
      return {
        title: '',
        url: '',
        loadTime: 0,
        error: error.message
      };
    }
  }
  
  /**
   * Extract page content with advanced strategies
   */
  async extractContent(sessionId, options = {}) {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    try {
      logger.info('Extracting page content', { sessionId });
      
      // Wait for dynamic content if specified
      if (options.waitForContent) {
        await this.waitForPageReady(page, options);
      }
      
      // Extract content using multiple strategies
      const content = await page.evaluate((extractOptions) => {
        const strategies = {
          // Strategy 1: Look for main content containers
          mainContent: () => {
            const selectors = [
              'main',
              '[role="main"]',
              '.main-content',
              '.content',
              '.post-content',
              '.entry-content',
              'article',
              '.article-body',
              '#content',
              '#main',
              '.container .row .col',
              '.page-content'
            ];
            
            for (const selector of selectors) {
              const element = document.querySelector(selector);
              if (element && element.innerText.trim().length > 100) {
                return element.innerText.trim();
              }
            }
            return null;
          },
          
          // Strategy 2: Extract from largest text block
          largestTextBlock: () => {
            const elements = Array.from(document.querySelectorAll('div, section, article, p'));
            let largestElement = null;
            let maxLength = 0;
            
            elements.forEach(el => {
              const text = el.innerText?.trim() || '';
              if (text.length > maxLength && text.length > 200) {
                maxLength = text.length;
                largestElement = el;
              }
            });
            
            return largestElement ? largestElement.innerText.trim() : null;
          },
          
          // Strategy 3: Remove navigation and extract body
          bodyContent: () => {
            // Clone body to avoid modifying original
            const bodyClone = document.body.cloneNode(true);
            
            // Remove unwanted elements
            const unwantedSelectors = [
              'header', 'nav', 'footer', 'aside',
              '.navigation', '.menu', '.sidebar',
              '.header', '.footer', '.nav',
              'script', 'style', 'noscript',
              '.advertisement', '.ad', '.ads',
              '.social-media', '.share-buttons',
              '.comments', '.comment-form'
            ];
            
            unwantedSelectors.forEach(selector => {
              const elements = bodyClone.querySelectorAll(selector);
              elements.forEach(el => el.remove());
            });
            
            return bodyClone.innerText.trim();
          }
        };
        
        // Try each strategy and return the best result
        const results = {};
        for (const [name, strategy] of Object.entries(strategies)) {
          try {
            results[name] = strategy();
          } catch (error) {
            results[name] = null;
          }
        }
        
        // Choose the best result (longest meaningful content)
        let bestContent = '';
        let bestLength = 0;
        
        for (const [strategy, content] of Object.entries(results)) {
          if (content && content.length > bestLength && content.length > 50) {
            bestContent = content;
            bestLength = content.length;
          }
        }
        
        // Extract additional structured data
        const structuredData = {
          headings: Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
            .map(h => ({ level: h.tagName, text: h.innerText.trim() }))
            .filter(h => h.text.length > 0),
          
          links: Array.from(document.querySelectorAll('a[href]'))
            .map(a => ({ text: a.innerText.trim(), href: a.href }))
            .filter(link => link.text.length > 0 && link.href.startsWith('http')),
          
          images: Array.from(document.querySelectorAll('img[src]'))
            .map(img => ({ alt: img.alt, src: img.src, title: img.title }))
            .filter(img => img.src.startsWith('http')),
          
          lists: Array.from(document.querySelectorAll('ul, ol'))
            .map(list => ({
              type: list.tagName.toLowerCase(),
              items: Array.from(list.querySelectorAll('li')).map(li => li.innerText.trim())
            }))
            .filter(list => list.items.length > 0)
        };
        
        return {
          mainContent: bestContent,
          strategies: results,
          structured: structuredData,
          wordCount: bestContent.split(/\s+/).length,
          extractedAt: new Date().toISOString()
        };
        
      }, options);
      
      logger.info('Content extraction completed', {
        sessionId,
        contentLength: content.mainContent?.length || 0,
        wordCount: content.wordCount
      });
      
      return content;
      
    } catch (error) {
      logger.error('Failed to extract content:', error);
      throw error;
    }
  }
  
  /**
   * Execute JavaScript on the page
   */
  async executeScript(sessionId, script, args = []) {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    try {
      logger.debug('Executing script', { sessionId });
      const result = await page.evaluate(script, ...args);
      return result;
    } catch (error) {
      logger.error('Script execution failed:', error);
      throw error;
    }
  }
  
  /**
   * Take screenshot of the page
   */
  async takeScreenshot(sessionId, options = {}) {
    const page = this.pages.get(sessionId);
    if (!page) {
      throw new Error(`Session ${sessionId} not found`);
    }
    
    try {
      const screenshot = await page.screenshot({
        fullPage: options.fullPage || false,
        type: options.type || 'png',
        quality: options.quality || 80
      });
      
      return screenshot;
    } catch (error) {
      logger.error('Screenshot failed:', error);
      throw error;
    }
  }
  
  /**
   * Close a specific session
   */
  async closeSession(sessionId) {
    const page = this.pages.get(sessionId);
    if (page) {
      try {
        await page.close();
        this.pages.delete(sessionId);
        
        // Clear timeout
        const timeoutId = this.sessionTimeouts.get(sessionId);
        if (timeoutId) {
          clearTimeout(timeoutId);
          this.sessionTimeouts.delete(sessionId);
        }
        
        logger.info('Browser session closed', { sessionId });
      } catch (error) {
        logger.error('Failed to close session:', error);
      }
    }
  }
  
  /**
   * Close all sessions and browser
   */
  async cleanup() {
    try {
      logger.info('Cleaning up browser automation');
      
      // Close all sessions
      for (const sessionId of this.pages.keys()) {
        await this.closeSession(sessionId);
      }
      
      // Close browser context and browser
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      logger.info('Browser automation cleanup completed');
    } catch (error) {
      logger.error('Cleanup failed:', error);
    }
  }
  
  /**
   * Get session status
   */
  getSessionStatus(sessionId) {
    const page = this.pages.get(sessionId);
    return {
      exists: !!page,
      url: page ? page.url() : null,
      title: page ? page.title() : null,
      isActive: !!page && !page.isClosed()
    };
  }
  
  /**
   * List all active sessions
   */
  listSessions() {
    const sessions = [];
    for (const [sessionId, page] of this.pages.entries()) {
      sessions.push({
        sessionId,
        url: page.url(),
        title: page.title(),
        isActive: !page.isClosed()
      });
    }
    return sessions;
  }
}

export default BrowserAutomation;
