import axios from 'axios';
import logger from '../utils/logger.js';
import { getConfig } from '../utils/config.js';

export class EmbeddingProvider {
  constructor(providerConfig) {
    this.config = providerConfig;
    this.name = providerConfig.name;
    this.priority = providerConfig.priority || 999;
  }

  async generateEmbedding(text) {
    throw new Error('generateEmbedding must be implemented by subclass');
  }

  async isAvailable() {
    return true;
  }
}

export class LMStudioProvider extends EmbeddingProvider {
  async generateEmbedding(text) {
    try {
      const response = await axios.post(`${this.config.url}${this.config.endpoint}`, {
        input: text,
        model: this.config.model,
        encoding_format: 'float'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LMStudio-URL-Scraper-MCP/1.0'
        },
        timeout: this.config.timeout || 30000
      });

      if (response.data && response.data.data && response.data.data.length > 0) {
        return response.data.data[0].embedding;
      }
      throw new Error('Invalid response format from LM Studio');
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error('LM Studio: No embedding model loaded. Please load an embedding model in LM Studio.');
      }
      throw error;
    }
  }

  async isAvailable() {
    try {
      const response = await axios.get(`${this.config.url}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}

export class OpenAIProvider extends EmbeddingProvider {
  async generateEmbedding(text) {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await axios.post(`${this.config.url}${this.config.endpoint}`, {
        input: text,
        model: this.config.model,
        encoding_format: 'float'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        timeout: this.config.timeout || 30000
      });

      if (response.data && response.data.data && response.data.data.length > 0) {
        return response.data.data[0].embedding;
      }
      throw new Error('Invalid response format from OpenAI');
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error('OpenAI: Invalid API key');
      }
      throw error;
    }
  }

  async isAvailable() {
    return !!this.config.apiKey;
  }
}

export class LocalMockProvider extends EmbeddingProvider {
  async generateEmbedding(text) {
    // Generate a deterministic mock embedding based on text hash
    const hash = this.simpleHash(text);
    const dimensions = this.config.dimensions || 384;
    const embedding = [];
    
    for (let i = 0; i < dimensions; i++) {
      // Use hash and index to generate consistent values
      const value = Math.sin((hash + i) * 0.1) * 2 - 1;
      embedding.push(value);
    }
    
    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / magnitude);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  async isAvailable() {
    return true;
  }
}
