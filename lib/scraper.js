import axios from 'axios';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import UserAgent from 'user-agents';
import { URL } from 'url';
import { RateLimiterMemory } from 'rate-limiter-flexible';

class URLScraper {
  constructor(options = {}) {
    this.options = {
      timeout: options.timeout || 30000,
      maxRetries: options.maxRetries || 3,
      delay: options.delay || 1000,
      respectRobots: options.respectRobots !== false,
      userAgent: options.userAgent || new UserAgent().toString(),
      maxContentLength: options.maxContentLength || 5 * 1024 * 1024, // 5MB
      ...options
    };

    // Rate limiter: 1 request per second per domain
    this.rateLimiter = new RateLimiterMemory({
      keyGenerator: (url) => new URL(url).hostname,
      points: 1,
      duration: 1,
    });

    this.robotsCache = new Map();
  }

  async checkRobots(url) {
    if (!this.options.respectRobots) return true;

    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
      const cacheKey = `${urlObj.protocol}//${urlObj.host}`;

      if (this.robotsCache.has(cacheKey)) {
        const robots = this.robotsCache.get(cacheKey);
        return robots.isAllowed(url, this.options.userAgent);
      }

      const response = await axios.get(robotsUrl, {
        timeout: 5000,
        headers: { 'User-Agent': this.options.userAgent }
      });

      const robots = robotsParser(robotsUrl, response.data);
      this.robotsCache.set(cacheKey, robots);

      return robots.isAllowed(url, this.options.userAgent);
    } catch (error) {
      // If robots.txt is not accessible, assume scraping is allowed
      return true;
    }
  }

  async scrapeUrl(url, options = {}) {
    const startTime = Date.now();
    
    try {
      // Validate URL
      new URL(url);

      // Check robots.txt
      const robotsAllowed = await this.checkRobots(url);
      if (!robotsAllowed) {
        throw new Error('Scraping not allowed by robots.txt');
      }

      // Rate limiting
      await this.rateLimiter.consume(url);

      // Perform request with retries
      let lastError;
      for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
        try {
          const response = await axios.get(url, {
            timeout: this.options.timeout,
            maxContentLength: this.options.maxContentLength,
            headers: {
              'User-Agent': this.options.userAgent,
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
              'Accept-Encoding': 'gzip, deflate',
              'Connection': 'keep-alive',
            },
          });

          const content = this.extractContent(response.data, url);
          
          return {
            success: true,
            url,
            statusCode: response.status,
            contentType: response.headers['content-type'],
            content,
            metadata: {
              scrapedAt: new Date().toISOString(),
              duration: Date.now() - startTime,
              attempt,
              size: response.data.length
            }
          };

        } catch (error) {
          lastError = error;
          if (attempt < this.options.maxRetries) {
            await this.delay(this.options.delay * attempt);
          }
        }
      }

      throw lastError;

    } catch (error) {
      return {
        success: false,
        url,
        error: error.message,
        metadata: {
          scrapedAt: new Date().toISOString(),
          duration: Date.now() - startTime
        }
      };
    }
  }

  extractContent(html, url) {
    const $ = cheerio.load(html);
    
    // Remove script and style elements
    $('script, style, noscript').remove();

    // Extract metadata
    const title = $('title').text().trim() || '';
    const description = $('meta[name="description"]').attr('content') || 
                      $('meta[property="og:description"]').attr('content') || '';
    
    const keywords = $('meta[name="keywords"]').attr('content') || '';
    const author = $('meta[name="author"]').attr('content') || '';
    
    // Extract main content
    const mainContent = this.extractMainContent($);
    
    // Extract links
    const links = [];
    $('a[href]').each((i, elem) => {
      const href = $(elem).attr('href');
      const text = $(elem).text().trim();
      if (href && text) {
        try {
          const absoluteUrl = new URL(href, url).toString();
          links.push({ url: absoluteUrl, text });
        } catch (e) {
          // Skip invalid URLs
        }
      }
    });

    // Extract images
    const images = [];
    $('img[src]').each((i, elem) => {
      const src = $(elem).attr('src');
      const alt = $(elem).attr('alt') || '';
      if (src) {
        try {
          const absoluteUrl = new URL(src, url).toString();
          images.push({ url: absoluteUrl, alt });
        } catch (e) {
          // Skip invalid URLs
        }
      }
    });

    return {
      title,
      description,
      keywords: keywords.split(',').map(k => k.trim()).filter(k => k),
      author,
      mainContent,
      links: links.slice(0, 50), // Limit to 50 links
      images: images.slice(0, 20), // Limit to 20 images
      headings: this.extractHeadings($),
      wordCount: mainContent.split(/\s+/).length
    };
  }

  extractMainContent($) {
    // Try to find main content areas
    const contentSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '.post-content',
      '.entry-content',
      'article',
      '.article-body'
    ];

    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        return element.text().trim();
      }
    }

    // Fallback: extract text from body, excluding header, footer, nav, aside
    $('header, footer, nav, aside, .sidebar, .menu').remove();
    return $('body').text().replace(/\s+/g, ' ').trim();
  }

  extractHeadings($) {
    const headings = [];
    $('h1, h2, h3, h4, h5, h6').each((i, elem) => {
      const level = parseInt(elem.tagName.charAt(1));
      const text = $(elem).text().trim();
      if (text) {
        headings.push({ level, text });
      }
    });
    return headings.slice(0, 20); // Limit to 20 headings
  }

  async scrapeBatch(urls, options = {}) {
    const batchSize = options.batchSize || 5;
    const results = [];
    
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(url => this.scrapeUrl(url, options))
      );
      results.push(...batchResults);
      
      // Delay between batches
      if (i + batchSize < urls.length) {
        await this.delay(1000);
      }
    }

    return results;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default URLScraper;