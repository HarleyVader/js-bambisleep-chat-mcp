/**
 * BambiSleep Website Analyzer with MCP Integration
 * Main entry point for the application
 */
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import ejsLayouts from 'express-ejs-layouts';

// Suppress config warning
process.env.SUPPRESS_NO_CONFIG_WARNING = 'true';

import config from '../bambisleep-analyzer/src/utils/config.js';
import logger from '../bambisleep-analyzer/src/utils/logger.js';
import protocol from '../bambisleep-analyzer/src/core/protocol.js';
import router from '../bambisleep-analyzer/src/core/router.js';

import { registerAnalyzerCommands } from './commands/index.js';
import dashboardRouter from './routes/dashboard.js';

// Initialize environment variables
dotenv.config();

// Import adapters - use dynamic imports
let DuckDuckGoAdapter, FetchAdapter, MemoryAdapter, MilvusAdapter;

// Initialize adapters
const adapters = {};

// Express app setup
const app = express();
const PORT = process.env.PORT || 3000;

// Set up __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set up static file serving
app.use(express.static(path.join(__dirname, '../public')));

// Set up EJS as the view engine
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');
app.use(ejsLayouts);
app.set('layout', 'layout');

// Health check endpoint
app.get('/health', async (req, res) => {
  const status = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    adapters: {}
  };
  
  // Track overall status
  let allAdaptersOk = true;
  
  // Check each adapter that exists
  if (adapters.duckduckgo) {
    try {
      status.adapters.duckduckgo = await adapters.duckduckgo.healthCheck();
      // Store the default timeout
      status.adapters.duckduckgo.defaultTimeout = adapters.duckduckgo.timeout || 10000;
    } catch (error) {
      status.adapters.duckduckgo = {
        status: 'error',
        error: error.message,
        lastError: error.message
      };
      allAdaptersOk = false;
    }
  }
  
  if (adapters.fetch) {
    try {
      status.adapters.fetch = await adapters.fetch.healthCheck();
      // Store the default timeout
      status.adapters.fetch.defaultTimeout = adapters.fetch.timeout || 15000;
    } catch (error) {
      status.adapters.fetch = {
        status: 'error',
        error: error.message,
        lastError: error.message
      };
      allAdaptersOk = false;
    }
  }
  
  if (adapters.memory) {
    try {
      status.adapters.memory = await adapters.memory.healthCheck();
    } catch (error) {
      status.adapters.memory = {
        status: 'error',
        error: error.message,
        lastError: error.message
      };
      allAdaptersOk = false;
    }
  }
  
  if (adapters.milvus) {
    try {
      status.adapters.milvus = await adapters.milvus.healthCheck();
    } catch (error) {
      status.adapters.milvus = {
        status: 'error',
        error: error.message,
        lastError: error.message
      };
      allAdaptersOk = false;
    }
  }
  
  // Update overall status if any adapter has an issue
  if (!allAdaptersOk) {
    status.status = 'degraded';
  }
  
  res.json(status);
});

// MCP command endpoint
app.post('/mcp/command', async (req, res) => {
  try {
    const command = protocol.parseCommand(req.body);
    const response = await router.handleCommand(command);
    res.json(response.toObject());
  } catch (error) {
    const errorResponse = protocol.createErrorResponse(
      req.body.sessionId || 'unknown-session',
      error
    );
    res.status(400).json(errorResponse.toObject());
  }
});

// Connect adapters and start server
async function startServer() {
  try {
    // Dynamically import adapter modules
    logger.info('Importing adapter modules');
    
    try {
      const duckDuckGoModule = await import('../bambisleep-analyzer/src/adapters/duckduckgo.js');
      const fetchModule = await import('../bambisleep-analyzer/src/adapters/fetch.js'); 
      const memoryModule = await import('../bambisleep-analyzer/src/adapters/memory.js');
      const milvusModule = await import('../bambisleep-analyzer/src/adapters/milvus.js');
      
      DuckDuckGoAdapter = duckDuckGoModule.default;
      FetchAdapter = fetchModule.default;
      MemoryAdapter = memoryModule.default;
      MilvusAdapter = milvusModule.default;
      
      logger.info('Successfully imported adapter modules');
    } catch (error) {
      logger.error(`Failed to import adapter modules: ${error.message}`);
      throw error;
    }
    
    // Create adapter instances
    logger.info('Creating adapter instances');
    adapters.duckduckgo = new DuckDuckGoAdapter();
    adapters.fetch = new FetchAdapter();
    adapters.memory = new MemoryAdapter();
    adapters.milvus = new MilvusAdapter();
    
    // Connect to all adapters
    logger.info('Connecting to adapters');
    await Promise.all([
      adapters.duckduckgo.connect(),
      adapters.fetch.connect(),
      adapters.memory.connect(),
      adapters.milvus.connect()
    ]);
    
    // Register command handlers
    logger.info('Registering command handlers');
    
    // Register analyzer commands
    registerAnalyzerCommands(router, adapters);
    
    // Register system info command
    router.registerCommand('system.info', async (command) => {
      return {
        version: process.env.npm_package_version || '1.0.0',
        name: process.env.npm_package_name || 'bambisleep-analyzer',
        commands: router.getAvailableCommands(),
        adapters: Object.keys(adapters).map(name => ({
          name,
          connected: adapters[name].connected
        }))
      };
    }, {
      description: 'Get system information'
    });
    
        // Mount dashboard routes
    app.use('/', dashboardRouter);
    
    // Start the server
    app.listen(PORT, () => {
      logger.info(`MCP Server running on port ${PORT}`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
      logger.info(`Dashboard available at http://localhost:${PORT}/`);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down');
  if (adapters) {
    await Promise.all([
      adapters.duckduckgo?.disconnect(),
      adapters.fetch?.disconnect(),
      adapters.memory?.disconnect(),
      adapters.milvus?.disconnect()
    ]);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down');
  if (adapters) {
    await Promise.all([
      adapters.duckduckgo?.disconnect(),
      adapters.fetch?.disconnect(),
      adapters.memory?.disconnect(),
      adapters.milvus?.disconnect()
    ]);
  }
  process.exit(0);
});

// Start the server
startServer();
