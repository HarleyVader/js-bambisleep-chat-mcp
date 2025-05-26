import express from 'express';
import URLScraper from '../lib/scraper.js';

const router = express.Router();

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

export default router;