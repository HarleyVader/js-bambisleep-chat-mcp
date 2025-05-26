import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import winston from 'winston';

import scraperRoutes from './routes/scraper.js';
import mcpRoutes from './routes/mcp.js';
import { errorHandler } from './middleware/errorHandler.js';
import EmbeddingService from './src/embeddingService.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const LM_STUDIO_URL = process.env.LM_STUDIO_URL || 'http://192.168.0.178:7777';

// Initialize embedding service
let embeddingService = null;

async function initializeEmbeddingService() {
  if (!embeddingService) {
    embeddingService = new EmbeddingService();
    await embeddingService.initialize();
  }
  return embeddingService;
}

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(cors({
  origin: [LM_STUDIO_URL, 'http://localhost:3000'],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Make logger available to routes
app.locals.logger = logger;

// Routes
app.use('/api/scraper', scraperRoutes);
app.use('/api/mcp', mcpRoutes);

// OpenAI-compatible chat completions endpoint
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { messages, model, temperature, max_tokens, stream } = req.body;
    
    logger.info('Chat completion request received', {
      model: model || 'default',
      messageCount: messages?.length || 0,
      temperature,
      max_tokens,
      stream: !!stream
    });

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        error: {
          message: 'Messages array is required and must not be empty',
          type: 'invalid_request_error',
          code: 'invalid_messages'
        }
      });
    }

    // For now, return a mock response in OpenAI format
    // In production, this would forward to LM Studio or process locally
    const response = {
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: model || 'llama-3.2-3b-claude-3.7-sonnet-reasoning-distilled@q4_0',
      choices: [{
        index: 0,
        message: {
          role: 'assistant',
          content: 'This is a placeholder response. The BambiSleep chat system is ready to process your request with the scraped wiki content.'
        },
        finish_reason: 'stop'
      }],
      usage: {
        prompt_tokens: 50,
        completion_tokens: 25,
        total_tokens: 75
      }
    };

    if (stream) {
      // Handle streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      res.write(`data: ${JSON.stringify(response)}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.json(response);
    }

  } catch (error) {
    logger.error('Chat completion error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error during chat completion',
        type: 'server_error',
        code: 'internal_error'
      }
    });
  }
});

// OpenAI-compatible embeddings endpoint
app.post('/v1/embeddings', async (req, res) => {
  try {
    const { input, model, encoding_format } = req.body;
    
    logger.info('Embeddings request received', {
      model: model || 'default',
      inputType: Array.isArray(input) ? 'array' : typeof input,
      inputLength: Array.isArray(input) ? input.length : (input?.length || 0),
      encoding_format
    });

    // Validate required fields
    if (!input) {
      return res.status(400).json({
        error: {
          message: 'Input is required',
          type: 'invalid_request_error',
          code: 'invalid_input'
        }
      });
    }

    // Convert input to array format
    const inputs = Array.isArray(input) ? input : [input];
    
    try {
      // Use our embedding service
      const service = await initializeEmbeddingService();
      const embeddings = [];
      
      for (let i = 0; i < inputs.length; i++) {
        const text = inputs[i];
        const result = await service.generateEmbedding(text);
        
        embeddings.push({
          object: 'embedding',
          index: i,
          embedding: result.embedding
        });
      }

      const response = {
        object: 'list',
        data: embeddings,
        model: model || 'text-embedding-nomic-embed-text-v1.5@q8_0',
        usage: {
          prompt_tokens: inputs.reduce((sum, text) => sum + (text?.length || 0), 0),
          total_tokens: inputs.reduce((sum, text) => sum + (text?.length || 0), 0)
        }
      };

      logger.info('Embeddings generated successfully', {
        count: embeddings.length,
        provider: service.currentProvider
      });

      res.json(response);

    } catch (embeddingError) {
      logger.error('Embedding service error:', embeddingError);
      
      // Fallback to mock embeddings if service fails
      const embeddings = inputs.map((text, index) => ({
        object: 'embedding',
        index,
        embedding: Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
      }));

      const response = {
        object: 'list',
        data: embeddings,
        model: model || 'text-embedding-nomic-embed-text-v1.5@q8_0 (fallback)',
        usage: {
          prompt_tokens: inputs.reduce((sum, text) => sum + (text?.length || 0), 0),
          total_tokens: inputs.reduce((sum, text) => sum + (text?.length || 0), 0)
        }
      };

      logger.warn('Using fallback mock embeddings due to service error');
      res.json(response);
    }

  } catch (error) {
    logger.error('Embeddings generation error:', error);
    res.status(500).json({
      error: {
        message: 'Internal server error during embeddings generation',
        type: 'server_error',
        code: 'internal_error'
      }
    });
  }
});

// Main dashboard route
app.get('/', (req, res) => {
  res.render('index', {
    title: 'LM Studio URL Scraper MCP',
    lmStudioUrl: LM_STUDIO_URL
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    lmStudioUrl: LM_STUDIO_URL 
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page Not Found',
    error: { status: 404, message: 'Page not found' }
  });
});

app.listen(PORT, () => {
  logger.info(`URL Scraper MCP Server running on port ${PORT}`);
  logger.info(`LM Studio integration endpoint: ${LM_STUDIO_URL}`);
});

export default app;