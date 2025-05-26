import dotenv from 'dotenv';
import { logger } from './logger.js';

dotenv.config();

class Config {
  constructor() {
    this.validateConfig();
  }

  get server() {
    return {
      port: parseInt(process.env.SERVER_PORT) || 6969,
      host: process.env.SERVER_HOST || 'localhost',
      env: process.env.NODE_ENV || 'development'
    };
  }
  get lmStudio() {
    return {
      host: process.env.LMS_HOST || 'localhost',
      port: parseInt(process.env.LMS_PORT) || 1234,
      baseURL: `http://${process.env.LMS_HOST || 'localhost'}:${process.env.LMS_PORT || 1234}/v1`,
      timeout: parseInt(process.env.LMS_TIMEOUT) || 30000,
      model: process.env.LMS_MODEL || 'llama-3.1-8b-lexi-uncensored-v2'
    };
  }

  get mongodb() {
    return {
      uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/bambisleep',
      options: {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      }
    };
  }
  get analysis() {
    return {
      minRelevanceScore: parseInt(process.env.MIN_RELEVANCE_SCORE) || 15,
      maxContentLength: parseInt(process.env.MAX_CONTENT_LENGTH) || 2000,
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 10000,
      bambiKeywords: [
        'bambisleep', 'bambi sleep', 'bimbo', 'hypnosis', 
        'feminization', 'sissy', 'conditioning', 'trance',
        'subliminal', 'brainwashing', 'mind control'
      ]
    };
  }

  get security() {
    return {
      allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:6969'],
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
      }
    };
  }

  validateConfig() {
    const requiredVars = ['MONGODB_URI'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }

    logger.info('Configuration validated successfully');
  }

  logConfig() {
    logger.info('Current configuration:', {
      server: this.server,
      lmStudio: { ...this.lmStudio, baseURL: this.lmStudio.baseURL },
      mongodb: { uri: this.mongodb.uri.replace(/\/\/.*@/, '//***:***@') }, // Hide credentials
      analysis: this.analysis,
      security: this.security
    });
  }
}

export const config = new Config();
