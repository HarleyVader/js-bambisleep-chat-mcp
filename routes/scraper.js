import express from 'express';
import URLScraper from '../lib/scraper.js';
import { enhancedFetcher } from '../src/scraper/fetcher.js';
import { enhancedTextProcessor } from '../src/analyzer/textProcessor.js';
import BrowserManager from '../src/scraper/browser.js';

const router = express.Router();

// Initialize browser manager for enhanced scraping
let browserManager = null;

async function getBrowserManager() {
  if (!browserManager) {
    browserManager = new BrowserManager();
  }
  return browserManager;
}

// Single URL scraping
router.post('/single', async (req, res) => {
  try {
    const { url, options = {} } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const scraper = new URLScraper(options);
    const result = await scraper.scrapeUrl(url, options);
    
    req.app.locals.logger.info(`Scraped URL: ${url}`, { 
      success: result.success,
      duration: result.metadata?.duration 
    });

    res.json(result);
  } catch (error) {
    req.app.locals.logger.error('Single URL scraping error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced single URL scraping with browser automation
router.post('/enhanced-single', async (req, res) => {
  try {
    const { url, options = {} } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const startTime = Date.now();
    
    // Use enhanced fetcher with browser automation
    const scrapedData = await enhancedFetcher.fetchUrl(url, options);
    
    if (!scrapedData.success) {
      return res.status(400).json({ 
        error: 'Failed to scrape URL', 
        details: scrapedData.error 
      });
    }

    // Process with enhanced text analysis
    const processedData = await enhancedTextProcessor.processText(
      scrapedData.content, 
      { 
        url,
        enhanced: true,
        ...options 
      }
    );

    const result = {
      success: true,
      url,
      title: scrapedData.title,
      content: processedData.text,
      analysis: processedData.analysis,
      metadata: {
        ...scrapedData.metadata,
        duration: Date.now() - startTime,
        enhanced: true,
        browserUsed: scrapedData.browserUsed || false
      }
    };
    
    req.app.locals.logger.info(`Enhanced scraped URL: ${url}`, { 
      success: true,
      duration: result.metadata.duration,
      browserUsed: result.metadata.browserUsed,
      relevanceScore: result.analysis?.relevanceScore
    });

    res.json(result);
  } catch (error) {
    req.app.locals.logger.error('Enhanced single URL scraping error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test URL for JavaScript detection
router.post('/test-url', async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const browserManager = await getBrowserManager();
    const testResult = await browserManager.testUrl(url);
    
    res.json({
      url,
      ...testResult,
      recommendation: testResult.needsBrowser ? 'Use browser automation' : 'Standard fetching sufficient'
    });
    
  } catch (error) {
    req.app.locals.logger.error('URL test error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch URL scraping
router.post('/batch', async (req, res) => {
  try {
    const { urls, options = {} } = req.body;
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'URLs array is required' });
    }

    if (urls.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 URLs allowed per batch' });
    }

    const scraper = new URLScraper(options);
    const results = await scraper.scrapeBatch(urls, options);
    
    req.app.locals.logger.info(`Batch scraped ${urls.length} URLs`, {
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    });

    res.json({ results });
  } catch (error) {
    req.app.locals.logger.error('Batch URL scraping error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced batch URL scraping
router.post('/enhanced-batch', async (req, res) => {
  try {
    const { urls, options = {} } = req.body;
    
    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'URLs array is required' });
    }

    if (urls.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 URLs allowed per enhanced batch' });
    }

    const startTime = Date.now();
    const results = [];
    
    for (const url of urls) {
      try {
        // Use enhanced fetcher
        const scrapedData = await enhancedFetcher.fetchUrl(url, options);
        
        if (scrapedData.success) {
          // Process with enhanced analysis
          const processedData = await enhancedTextProcessor.processText(
            scrapedData.content, 
            { 
              url,
              enhanced: true,
              ...options 
            }
          );

          results.push({
            success: true,
            url,
            title: scrapedData.title,
            content: processedData.text,
            analysis: processedData.analysis,
            metadata: {
              ...scrapedData.metadata,
              enhanced: true,
              browserUsed: scrapedData.browserUsed || false
            }
          });
        } else {
          results.push({
            success: false,
            url,
            error: scrapedData.error
          });
        }
      } catch (error) {
        results.push({
          success: false,
          url,
          error: error.message
        });
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    req.app.locals.logger.info(`Enhanced batch scraped ${urls.length} URLs`, {
      successful,
      failed,
      duration: Date.now() - startTime
    });

    res.json({ 
      results,
      summary: {
        total: urls.length,
        successful,
        failed,
        duration: Date.now() - startTime
      }
    });
  } catch (error) {
    req.app.locals.logger.error('Enhanced batch URL scraping error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check robots.txt
router.get('/robots-check', async (req, res) => {
  try {
    const { url } = req.query;
    
    if (!url) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    const scraper = new URLScraper();
    const allowed = await scraper.checkRobots(url);
    
    res.json({ url, robotsAllowed: allowed });
  } catch (error) {
    req.app.locals.logger.error('Robots check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Enhanced search endpoint
router.post('/search', async (req, res) => {
  try {
    const { 
      query, 
      filters = {},
      limit = 20,
      offset = 0 
    } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Search through processed data
    const dataDir = path.join(process.cwd(), 'data', 'processed');
    const results = [];
    
    try {
      const files = await fs.readdir(dataDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(dataDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const data = JSON.parse(content);
          
          // Apply filters
          if (filters.category && data.analysis?.category !== filters.category) continue;
          if (filters.minRelevance && (data.analysis?.relevanceScore || 0) < filters.minRelevance) continue;
          if (filters.dateFrom && new Date(data.metadata?.timestamp) < new Date(filters.dateFrom)) continue;
          if (filters.dateTo && new Date(data.metadata?.timestamp) > new Date(filters.dateTo)) continue;
          
          // Simple text search
          const searchText = `${data.title || ''} ${data.content || ''}`.toLowerCase();
          if (searchText.includes(query.toLowerCase())) {
            results.push({
              url: data.url,
              title: data.title,
              content: data.content?.substring(0, 300) + '...',
              analysis: data.analysis,
              metadata: data.metadata,
              relevance: data.analysis?.relevanceScore || 0
            });
          }
        } catch (err) {
          req.app.locals.logger.warn(`Error processing search file ${file}:`, err.message);
        }
      }
      
      // Sort by relevance and apply pagination
      results.sort((a, b) => b.relevance - a.relevance);
      const paginatedResults = results.slice(offset, offset + limit);
      
      res.json({
        results: paginatedResults,
        total: results.length,
        query,
        filters,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < results.length
        }
      });
      
    } catch (err) {
      req.app.locals.logger.warn('Error reading search directory:', err.message);
      res.json({ results: [], total: 0, query, filters });
    }
    
  } catch (error) {
    req.app.locals.logger.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cleanup browser resources
router.post('/cleanup', async (req, res) => {
  try {
    if (browserManager) {
      await browserManager.cleanup();
      browserManager = null;
    }
    
    res.json({ success: true, message: 'Browser resources cleaned up' });
  } catch (error) {
    req.app.locals.logger.error('Cleanup error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;