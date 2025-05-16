/**
 * Development environment configuration
 * This file overrides values from default.js for development
 */
export default {
  logging: {
    level: 'debug',
    format: 'pretty',
    logFilePath: './logs/dev-app.log'
  },
  mcp: {
    servers: {
      milvus: {
        uri: 'http://127.0.0.1:19530' // Local Milvus instance
      },
      puppeteer: {
        headless: false // Set to false for debugging
      }
    }
  }
};
