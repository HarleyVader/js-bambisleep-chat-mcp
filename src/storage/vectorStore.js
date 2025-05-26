import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import logger from '../utils/logger.js';

export class VectorStore {
  constructor(storePath = './data/embeddings') {
    this.storePath = storePath;
    this.indexPath = path.join(storePath, 'index.json');
    this.index = {};
  }

  async initialize() {
    try {
      await fs.mkdir(this.storePath, { recursive: true });
      
      // Load existing index
      try {
        const indexData = await fs.readFile(this.indexPath, 'utf8');
        this.index = JSON.parse(indexData);
        logger.info(`Loaded vector store index with ${Object.keys(this.index).length} entries`);
      } catch (error) {
        // Index doesn't exist yet, start fresh
        this.index = {};
        logger.info('Starting with empty vector store index');
      }
    } catch (error) {
      logger.error('Failed to initialize vector store:', error);
      throw error;
    }
  }

  async saveEmbedding(id, embeddingData, metadata = {}) {
    try {
      const embeddingId = id || this.generateId(metadata.source || 'unknown');
      const timestamp = new Date().toISOString();
      
      const entry = {
        id: embeddingId,
        embedding: embeddingData.embedding,
        provider: embeddingData.provider,
        dimensions: embeddingData.dimensions,
        metadata: {
          ...metadata,
          savedAt: timestamp
        }
      };

      // Save embedding data to separate file
      const embeddingFilePath = path.join(this.storePath, `${embeddingId}.json`);
      await fs.writeFile(embeddingFilePath, JSON.stringify(entry, null, 2));

      // Update index
      this.index[embeddingId] = {
        id: embeddingId,
        filePath: embeddingFilePath,
        provider: embeddingData.provider,
        dimensions: embeddingData.dimensions,
        source: metadata.source,
        title: metadata.title,
        wordCount: metadata.wordCount,
        relevanceScore: metadata.relevanceScore,
        savedAt: timestamp
      };

      await this.saveIndex();
      logger.debug(`Saved embedding ${embeddingId} to vector store`);
      
      return embeddingId;
    } catch (error) {
      logger.error('Failed to save embedding:', error);
      throw error;
    }
  }

  async getEmbedding(id) {
    try {
      if (!this.index[id]) {
        throw new Error(`Embedding ${id} not found in index`);
      }

      const filePath = this.index[id].filePath;
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      logger.error(`Failed to get embedding ${id}:`, error);
      throw error;
    }
  }

  async searchSimilar(queryEmbedding, limit = 10, threshold = 0.7) {
    try {
      const results = [];

      for (const [id, indexEntry] of Object.entries(this.index)) {
        try {
          const embeddingData = await this.getEmbedding(id);
          const similarity = this.cosineSimilarity(queryEmbedding, embeddingData.embedding);
          
          if (similarity >= threshold) {
            results.push({
              id,
              similarity,
              metadata: indexEntry,
              embeddingData
            });
          }
        } catch (error) {
          logger.warn(`Failed to load embedding ${id} for similarity search:`, error.message);
        }
      }

      // Sort by similarity descending and limit results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      logger.error('Failed to search similar embeddings:', error);
      throw error;
    }
  }

  async listEmbeddings(filter = {}) {
    const results = [];
    
    for (const [id, entry] of Object.entries(this.index)) {
      let matches = true;
      
      if (filter.source && !entry.source?.includes(filter.source)) {
        matches = false;
      }
      
      if (filter.provider && entry.provider !== filter.provider) {
        matches = false;
      }
      
      if (filter.minRelevance && entry.relevanceScore < filter.minRelevance) {
        matches = false;
      }
      
      if (matches) {
        results.push(entry);
      }
    }
    
    return results;
  }

  async deleteEmbedding(id) {
    try {
      if (!this.index[id]) {
        throw new Error(`Embedding ${id} not found`);
      }

      const filePath = this.index[id].filePath;
      await fs.unlink(filePath);
      delete this.index[id];
      await this.saveIndex();
      
      logger.info(`Deleted embedding ${id}`);
    } catch (error) {
      logger.error(`Failed to delete embedding ${id}:`, error);
      throw error;
    }
  }

  async saveIndex() {
    try {
      await fs.writeFile(this.indexPath, JSON.stringify(this.index, null, 2));
    } catch (error) {
      logger.error('Failed to save vector store index:', error);
      throw error;
    }
  }

  generateId(source) {
    const timestamp = Date.now();
    const hash = crypto.createHash('md5').update(source + timestamp).digest('hex');
    return `emb_${hash.substring(0, 12)}`;
  }

  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  async getStats() {
    const stats = {
      totalEmbeddings: Object.keys(this.index).length,
      providers: {},
      averageRelevance: 0,
      totalDiskUsage: 0
    };

    let relevanceSum = 0;
    let relevanceCount = 0;

    for (const entry of Object.values(this.index)) {
      // Count by provider
      stats.providers[entry.provider] = (stats.providers[entry.provider] || 0) + 1;
      
      // Calculate average relevance
      if (entry.relevanceScore !== undefined) {
        relevanceSum += entry.relevanceScore;
        relevanceCount++;
      }
      
      // Calculate disk usage
      try {
        const fileStat = await fs.stat(entry.filePath);
        stats.totalDiskUsage += fileStat.size;
      } catch (error) {
        // File might not exist
      }
    }

    if (relevanceCount > 0) {
      stats.averageRelevance = relevanceSum / relevanceCount;
    }

    return stats;
  }
}

export default VectorStore;
