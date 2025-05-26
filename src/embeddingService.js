import EmbeddingGenerator from './embeddings/generator.js';
import VectorStore from './storage/vectorStore.js';
import { processScrapedContent } from './analyzer/textProcessor.js';
import { getConfig } from './utils/config.js';
import logger from './utils/logger.js';

export class EmbeddingService {
  constructor() {
    this.generator = new EmbeddingGenerator();
    this.vectorStore = new VectorStore();
    this.config = null;
  }

  async initialize() {
    try {
      this.config = await getConfig();
      await this.generator.initialize();
      await this.vectorStore.initialize();
      logger.info('Embedding service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize embedding service:', error);
      throw error;
    }
  }

  get currentProvider() {
    return this.generator?.currentProvider;
  }

  // Direct embedding generation method
  async generateEmbedding(text) {
    return await this.generator.generateEmbedding(text);
  }

  // Process content and generate embeddings
  async processContent(content, metadata = {}) {
    try {
      // Process the content
      const processedData = processScrapedContent({ content, metadata }, this.config.analyzer);
      
      logger.info('Processing content', {
        source: processedData.source,
        title: processedData.content?.title,
        wordCount: processedData.content?.wordCount,
        relevanceScore: processedData.processed?.relevanceScore,
        isRelevant: processedData.isRelevant
      });

      // Skip irrelevant content if configured to do so
      if (!processedData.isRelevant && this.config.analyzer?.skipIrrelevant) {
        logger.info('Skipping irrelevant content', { source: processedData.source });
        return {
          processed: processedData,
          skipped: true,
          reason: 'Low relevance score'
        };
      }

      // Prepare text for embedding
      const textToEmbed = processedData.processed.cleanedContent || processedData.processed.summary;
      
      if (!textToEmbed || textToEmbed.length < 10) {
        logger.warn('Content too short for embedding', { source: processedData.source });
        return {
          processed: processedData,
          skipped: true,
          reason: 'Content too short'
        };
      }

      // Chunk text if it's too long
      const chunks = this.generator.chunkText(textToEmbed, this.config.embedding.chunkSize, this.config.embedding.overlap);
      const embeddingResults = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        try {
          // Generate embedding for chunk
          const embeddingData = await this.generator.generateEmbedding(chunk);
          
          // Prepare metadata
          const chunkMetadata = {
            source: processedData.source,
            title: processedData.content?.title || 'Untitled',
            chunk: i,
            totalChunks: chunks.length,
            cleanedContent: chunk,
            summary: processedData.processed.summary,
            relevanceScore: processedData.processed.relevanceScore,
            wordCount: chunk.split(/\s+/).length,
            originalWordCount: processedData.content?.wordCount,
            keyPhrases: processedData.processed.keyPhrases,
            scrapedAt: processedData.metadata?.scrapedAt,
            processedAt: processedData.processed.processedAt
          };

          // Save to vector store
          const embeddingId = await this.vectorStore.saveEmbedding(null, embeddingData, chunkMetadata);
          
          embeddingResults.push({
            id: embeddingId,
            chunk: i,
            embeddingData,
            metadata: chunkMetadata
          });

          logger.debug('Saved embedding chunk', {
            id: embeddingId,
            chunk: i,
            provider: embeddingData.provider,
            dimensions: embeddingData.embedding?.length
          });

        } catch (chunkError) {
          logger.error('Failed to process chunk', { 
            chunk: i, 
            error: chunkError.message 
          });
          // Continue with other chunks
        }
      }

      const result = {
        processed: processedData,
        embeddings: embeddingResults,
        provider: embeddingResults[0]?.embeddingData?.provider,
        storageKey: processedData.source,
        analysis: processedData.processed
      };

      logger.info('Content processing completed', {
        source: processedData.source,
        embeddingsGenerated: embeddingResults.length,
        provider: result.provider
      });

      return result;

    } catch (error) {
      logger.error('Failed to process content:', error);
      throw error;
    }
  }

  // Search for similar content
  async searchSimilar(query, options = {}) {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generator.generateEmbedding(query);
      
      // Search for similar embeddings
      const results = await this.vectorStore.searchSimilar(
        queryEmbedding.embedding,
        options.limit || 10,
        options.threshold || 0.7
      );

      logger.info('Similarity search completed', {
        query: query.substring(0, 100),
        resultsFound: results.length,
        provider: queryEmbedding.provider
      });

      return results;

    } catch (error) {
      logger.error('Similarity search failed:', error);
      throw error;
    }
  }

  // Get service statistics
  async getStats() {
    try {
      const vectorStats = await this.vectorStore.getStats();
      const providerStatus = {};

      // Check provider availability
      for (const provider of this.generator.providers) {
        try {
          providerStatus[provider.name] = {
            available: await provider.isAvailable(),
            priority: provider.priority
          };
        } catch (error) {
          providerStatus[provider.name] = {
            available: false,
            error: error.message,
            priority: provider.priority
          };
        }
      }

      return {
        vectorStore: vectorStats,
        providers: providerStatus,
        currentProvider: this.generator.currentProvider?.name || 'none',
        config: {
          chunkSize: this.config?.embedding?.chunkSize,
          overlap: this.config?.embedding?.overlap,
          relevanceThreshold: this.config?.analyzer?.relevanceThreshold
        }
      };

    } catch (error) {
      logger.error('Failed to get stats:', error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  async processAndEmbedContent(scrapedData) {
    return await this.processContent(scrapedData.content, scrapedData.metadata);
  }

  // Legacy method for backward compatibility
  async searchSimilarContent(query, options = {}) {
    const results = await this.searchSimilar(query, options);
    const queryEmbedding = await this.generator.generateEmbedding(query);
    
    return {
      query,
      results,
      queryEmbedding: {
        provider: queryEmbedding.provider,
        dimensions: queryEmbedding.embedding?.length
      }
    };
  }
}

export default EmbeddingService;
