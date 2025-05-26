import express from 'express';
import axios from 'axios';
import URLScraper from '../lib/scraper.js';
import EmbeddingService from '../src/embeddingService.js';

const router = express.Router();

// Initialize embedding service
let embeddingService = null;

async function initializeEmbeddingService() {
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
    await embeddingService.initialize();
  }
  return embeddingService;
}

// MCP tool registration
const MCP_TOOLS = [
  {
    name: 'url_scraper',
    description: 'Scrape content from URLs while respecting robots.txt',
    input_schema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL to scrape'
        },
        options: {
          type: 'object',
          properties: {
            respectRobots: { type: 'boolean', default: true },
            timeout: { type: 'number', default: 30000 },
            maxRetries: { type: 'number', default: 3 }
          }
        }
      },
      required: ['url']
    }
  },
  {
    name: 'batch_url_scraper',
    description: 'Scrape multiple URLs in batch',
    input_schema: {
      type: 'object',
      properties: {
        urls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of URLs to scrape (max 50)'
        },
        options: {
          type: 'object',
          properties: {
            batchSize: { type: 'number', default: 5 },
            respectRobots: { type: 'boolean', default: true }
          }
        }
      },
      required: ['urls']
    }
  },
  {
    name: 'embedding_search',
    description: 'Search for similar content using embeddings',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query text'
        },
        options: {
          type: 'object',
          properties: {
            limit: { type: 'number', default: 10 },
            threshold: { type: 'number', default: 0.7 }
          }
        }
      },
      required: ['query']
    }
  },
  {
    name: 'process_content',
    description: 'Process scraped content and generate embeddings',
    input_schema: {
      type: 'object',
      properties: {
        content: {
          type: 'object',
          description: 'Scraped content object'
        },
        metadata: {
          type: 'object',
          description: 'Metadata about the content'
        }
      },
      required: ['content']
    }
  },
  {
    name: 'embedding_stats',
    description: 'Get embedding service statistics',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// Get available tools
router.get('/tools', (req, res) => {
  res.json({ tools: MCP_TOOLS });
});

// Execute tool
router.post('/tools/:toolName/execute', async (req, res) => {
  try {
    const { toolName } = req.params;
    const { input } = req.body;

    switch (toolName) {
      case 'url_scraper':
        const scraper = new URLScraper(input.options || {});
        const result = await scraper.scrapeUrl(input.url, input.options);
        res.json({ result });
        break;

      case 'batch_url_scraper':
        const batchScraper = new URLScraper(input.options || {});
        const batchResults = await batchScraper.scrapeBatch(input.urls, input.options);
        res.json({ result: { results: batchResults } });
        break;

      case 'embedding_search':
        const service = await initializeEmbeddingService();
        const searchResults = await service.searchSimilar(input.query, input.options);
        res.json({ result: searchResults });
        break;

      case 'process_content':
        const embeddingService = await initializeEmbeddingService();
        const processedResult = await embeddingService.processContent(input.content, input.metadata);
        res.json({ result: processedResult });
        break;

      case 'embedding_stats':
        const statsService = await initializeEmbeddingService();
        const stats = await statsService.getStats();
        res.json({ result: stats });
        break;

      default:
        res.status(404).json({ error: 'Tool not found' });
    }
  } catch (error) {
    req.app.locals.logger.error(`MCP tool execution error (${req.params.toolName}):`, error);
    res.status(500).json({ error: error.message });
  }
});

// Send scraped content to LM Studio (with embedding processing)
router.post('/send-to-lmstudio', async (req, res) => {
  try {
    const { content, metadata } = req.body;

    // Process content through our embedding service first
    const service = await initializeEmbeddingService();
    const processedResult = await service.processContent(content, metadata);

    req.app.locals.logger.info('Content processed and stored with embeddings', { 
      url: metadata?.url,
      embeddings: processedResult.embeddings?.length || 0,
      provider: processedResult.provider
    });

    res.json({ 
      success: true, 
      processed: processedResult,
      message: 'Content processed and embeddings generated successfully'
    });
  } catch (error) {
    req.app.locals.logger.error('Error processing content with embeddings:', error);
    res.status(500).json({ 
      error: 'Failed to process content with embeddings', 
      details: error.message 
    });
  }
});

export default router;