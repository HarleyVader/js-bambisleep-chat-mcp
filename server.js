import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';
import { WebsiteAnalyzer } from './utils/analyzer.js';
import { DatabaseManager } from './utils/database.js';
import { BambiSleepAnalyzer } from './utils/bambisleep-analyzer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Initialize services
const analyzer = new WebsiteAnalyzer();
const database = new DatabaseManager();
const aiAnalyzer = new BambiSleepAnalyzer();

// Rate limiting
const limiter = rateLimit(config.security.rateLimit);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));
app.use(cors({
  origin: config.security.allowedOrigins,
  credentials: true
}));
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { 
    ip: req.ip, 
    userAgent: req.get('User-Agent')?.substring(0, 100) 
  });
  next();
});

// Initialize database connection
let isInitialized = false;
async function initialize() {
  if (isInitialized) return;
  
  try {
    logger.info('Initializing BambiSleep Chat MCP Server...');
    
    // Connect to database
    await database.connect();
    
    // Test LM Studio connection
    const lmStudioOk = await analyzer.testLMStudioConnection();
    if (!lmStudioOk) {
      logger.warn('LM Studio connection failed - AI analysis will use fallback mode');
    }
    
    config.logConfig();
    isInitialized = true;
    logger.success('Server initialization completed');
  } catch (error) {
    logger.error('Server initialization failed', { error: error.message });
    throw error;
  }
}

// API Routes
app.post('/api/analyze-url', async (req, res) => {
  try {
    await initialize();
    
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    logger.info('Starting URL analysis', { url, ip: req.ip });

    // Fetch website content
    const content = await analyzer.fetchWebsite(url);
    
    // Analyze for BambiSleep relevance
    const analysis = await analyzer.analyzeBambiSleepRelevance(content);
    
    // Save to database if relevant
    let savedToDatabase = false;
    if (analysis.isBambiSleep && analysis.relevanceScore >= config.analysis.minRelevanceScore) {
      const siteData = {
        url: content.url,
        title: content.title,
        content_summary: analysis.summary,
        relevance_score: analysis.relevanceScore,
        keywords: analysis.keywords,
        analysis: analysis,
        content: {
          metaDescription: content.metaDescription,
          headings: content.headings,
          linksCount: content.links?.length || 0,
          imagesCount: content.images?.length || 0
        }
      };
      
      const result = await database.saveBambiSleepSite(siteData);
      savedToDatabase = result.success;
    }

    res.json({
      content: {
        url: content.url,
        title: content.title,
        metaDescription: content.metaDescription,
        contentLength: content.contentLength
      },
      analysis,
      savedToDatabase
    });

  } catch (error) {
    logger.error('URL analysis failed', { url: req.body.url, error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/sites', async (req, res) => {
  try {
    await initialize();
    
    const {
      page = 1,
      limit = 20,
      sortBy = 'addedAt',
      sortOrder = 'desc',
      minScore = 0,
      contentType,
      search
    } = req.query;
    
    const options = {
      skip: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit),
      sortBy,
      sortOrder: sortOrder === 'desc' ? -1 : 1,
      minScore: parseInt(minScore),
      contentType,
      search
    };
    
    const result = await database.getStoredSites(options);
    res.json(result);
  } catch (error) {
    logger.error('Failed to get sites', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    await initialize();
    const stats = await database.getSiteStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get stats', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sites/:url/view', async (req, res) => {
  try {
    await initialize();
    const url = decodeURIComponent(req.params.url);
    await database.incrementViewCount(url);
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to increment view count', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sites/:url', async (req, res) => {
  try {
    await initialize();
    const url = decodeURIComponent(req.params.url);
    const deleted = await database.deleteSite(url);
    
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Site not found' });
    }
  } catch (error) {
    logger.error('Failed to delete site', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await database.healthCheck();
    const lmStudioHealth = await analyzer.testLMStudioConnection();
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        lmStudio: { status: lmStudioHealth ? 'healthy' : 'unhealthy' }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Dashboard route
app.get('/', async (req, res) => {
  try {
    await initialize();
    
    const { sites } = await database.getStoredSites({ limit: 50 });
    const stats = await database.getSiteStats();
    
    res.render('dashboard', { 
      sites, 
      stats,
      config: {
        serverPort: config.server.port,
        lmStudioHost: config.lmStudio.host,
        lmStudioPort: config.lmStudio.port
      }
    });
  } catch (error) {
    logger.error('Dashboard error', { error: error.message });
    res.render('dashboard', { 
      sites: [], 
      stats: { totalSites: 0, avgScore: 0, highRelevance: 0, todayCount: 0 },
      error: error.message,
      config: {
        serverPort: config.server.port,
        lmStudioHost: config.lmStudio.host,
        lmStudioPort: config.lmStudio.port
      }
    });
  }
});

// Enhanced AI endpoints
app.post('/api/ai/analyze-database', async (req, res) => {
  try {
    await initialize();
    logger.info('Starting AI database analysis');
    
    const report = await aiAnalyzer.analyzeDatabaseContent();
    
    res.json({
      success: true,
      report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('AI database analysis failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/generate-content', async (req, res) => {
  try {
    await initialize();
    
    const { type, specifications, saveToDatabase } = req.body;
    
    if (!type) {
      return res.status(400).json({ error: 'Content type is required' });
    }
    
    logger.info('Generating AI content', { type, specifications });
    
    const content = await aiAnalyzer.writeBambiSleepContent(type, specifications, saveToDatabase);
    
    res.json({
      success: true,
      content,
      type,
      wordCount: content.split(' ').length,
      savedToDatabase: saveToDatabase,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('AI content generation failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/search', async (req, res) => {
  try {
    await initialize();
    
    const { query, limit = 10 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    logger.info('AI-powered search', { query, limit });
    
    const results = await aiAnalyzer.searchDatabaseContent(query, { limit });
    
    res.json({
      success: true,
      query,
      results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('AI search failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ai/test-connection', async (req, res) => {
  try {
    const response = await aiAnalyzer.testConnection();
    
    res.json({
      success: true,
      message: 'LM Studio connection successful',
      response,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('LM Studio test failed', { error: error.message });
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error', { 
    error: error.message, 
    stack: error.stack,
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn('404 - Route not found', { url: req.url, method: req.method });
  res.status(404).json({ error: 'Route not found' });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  
  try {
    await database.disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  
  try {
    await database.disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
  }
  
  process.exit(0);
});

// Start server
const startServer = async () => {
  try {
    await initialize();
    
    const server = app.listen(config.server.port, () => {
      logger.success(`BambiSleep Chat MCP Server running on port ${config.server.port}`, {
        dashboard: `http://localhost:${config.server.port}`,
        environment: config.server.env
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${config.server.port} is already in use`);
      } else {
        logger.error('Server error', { error: error.message });
      }
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();
