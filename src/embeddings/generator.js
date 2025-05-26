import logger from '../utils/logger.js';
import { getConfig } from '../utils/config.js';
import { LMStudioProvider, OpenAIProvider, LocalMockProvider } from './models.js';

export class EmbeddingGenerator {
  constructor() {
    this.providers = [];
    this.currentProvider = null;
  }

  async initialize() {
    const config = await getConfig();
    const providerConfigs = config.embedding.providers.sort((a, b) => a.priority - b.priority);

    for (const providerConfig of providerConfigs) {
      let provider;
      
      switch (providerConfig.name) {
        case 'lmstudio':
          provider = new LMStudioProvider(providerConfig);
          break;
        case 'openai':
          provider = new OpenAIProvider(providerConfig);
          break;
        case 'local':
          provider = new LocalMockProvider(providerConfig);
          break;
        default:
          logger.warn(`Unknown embedding provider: ${providerConfig.name}`);
          continue;
      }

      this.providers.push(provider);
    }

    // Find the first available provider
    await this.selectProvider();
  }

  async selectProvider() {
    for (const provider of this.providers) {
      try {
        const isAvailable = await provider.isAvailable();
        if (isAvailable) {
          this.currentProvider = provider;
          logger.info(`Selected embedding provider: ${provider.name}`);
          return provider;
        }
      } catch (error) {
        logger.warn(`Provider ${provider.name} is not available:`, error.message);
      }
    }
    
    throw new Error('No embedding providers available');
  }

  async generateEmbedding(text, retryCount = 0) {
    if (!this.currentProvider) {
      await this.selectProvider();
    }

    try {
      const embedding = await this.currentProvider.generateEmbedding(text);
      logger.debug(`Generated embedding using ${this.currentProvider.name}`, {
        textLength: text.length,
        embeddingDimensions: embedding.length
      });
      return {
        embedding,
        provider: this.currentProvider.name,
        dimensions: embedding.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`Embedding generation failed with ${this.currentProvider.name}:`, error.message);
      
      const config = await getConfig();
      const maxRetries = config.embedding.retryAttempts || 3;
      
      if (retryCount < maxRetries) {
        logger.info(`Trying next provider (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Remove current provider and try next one
        const currentIndex = this.providers.indexOf(this.currentProvider);
        if (currentIndex < this.providers.length - 1) {
          this.currentProvider = this.providers[currentIndex + 1];
          return this.generateEmbedding(text, retryCount + 1);
        }
      }
      
      throw new Error(`All embedding providers failed. Last error: ${error.message}`);
    }
  }

  async generateEmbeddings(texts) {
    const results = [];
    
    for (const text of texts) {
      try {
        const result = await this.generateEmbedding(text);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to generate embedding for text:`, error);
        results.push({
          error: error.message,
          text: text.substring(0, 100) + '...',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  // Split long text into chunks for embedding
  chunkText(text, chunkSize = 512, overlap = 50) {
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = start + chunkSize;
      
      // Try to break at sentence or word boundaries
      if (end < text.length) {
        const sentenceEnd = text.lastIndexOf('.', end);
        const wordEnd = text.lastIndexOf(' ', end);
        
        if (sentenceEnd > start + chunkSize * 0.5) {
          end = sentenceEnd + 1;
        } else if (wordEnd > start + chunkSize * 0.5) {
          end = wordEnd;
        }
      }

      chunks.push(text.substring(start, end).trim());
      start = end - overlap;
    }

    return chunks;
  }
}

export default EmbeddingGenerator;
