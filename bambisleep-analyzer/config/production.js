/**
 * Production environment configuration
 * This file overrides values from default.js for production
 */
export default {
  logging: {
    level: 'warn',
    format: 'json',
    logFilePath: './logs/prod-app.log'
  },
  mcp: {
    servers: {
      milvus: {
        uri: process.env.MILVUS_URI || 'http://milvus:19530' // Can be overridden with environment variable
      },
      puppeteer: {
        headless: true, // Always headless in production
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    }
  },
  validation: {
    schemaPath: './schemas',
    addFormats: false // Disable for performance in production
  }
};
