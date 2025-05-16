/**
 * Default configuration for MCP BambiSleep Analyzer
 * This file contains settings for all environments
 */
export default {
  app: {
    name: 'bambisleep-analyzer',
    version: '1.0.0',
  },  mcp: {
    servers: {
      milvus: {
        uri: 'http://127.0.0.1:19530',
        collection: 'bambisleep_data',
        vectorDimension: 1536,
        schema: {
          fields: [
            { name: 'id', type: 'VARCHAR', isPrimary: true, maxLength: 100 },
            { name: 'url', type: 'VARCHAR', maxLength: 500 },
            { name: 'title', type: 'VARCHAR', maxLength: 200 },
            { name: 'content', type: 'VARCHAR', maxLength: 65535 },
            { name: 'summary', type: 'VARCHAR', maxLength: 1000 },
            { name: 'vector', type: 'FLOAT_VECTOR', dim: 1536 },
            { name: 'source', type: 'VARCHAR', maxLength: 100 },
            { name: 'retrieved_at', type: 'VARCHAR', maxLength: 50 },
          ]
        }
      },
      duckduckgo: {
        timeout: 20000, // Increased from 10000 ms
        maxResults: 30,
        searchKeywords: [
          'bambisleep', 
          'bambi sleep', 
          'bambi transformation', 
          'bambi hypnosis'
        ]
      },
      fetch: {
        timeout: 30000, // Increased from 15000 ms
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      memory: {
        persistent: true,
        storagePath: './data/memory'
      },
      puppeteer: {
        headless: true,
        defaultViewport: { width: 1920, height: 1080 },
        timeout: 30000 // ms
      }
    },
    // New timeout management configuration
    timeouts: {
      duckduckgo: 20000,
      'duckduckgo.search': 25000,
      fetch: 30000,
      'fetch.fetch': 35000,
      memory: 5000,
      milvus: 15000,
      default: 30000
    },
    // New retry configuration
    retries: {
      duckduckgo: 3,
      fetch: 3,
      memory: 1,
      milvus: 2,
      default: 2
    },
    }
  },
  logging: {
    level: 'info',
    format: 'json',
    logFilePath: './logs/app.log',
    maxSize: '10m',
    maxFiles: 5
  },
  validation: {
    schemaPath: './schemas',
    addFormats: true
  },
  session: {
    ttl: 3600 * 24, // 24 hours
    cleanupInterval: 3600 // 1 hour
  }
};
