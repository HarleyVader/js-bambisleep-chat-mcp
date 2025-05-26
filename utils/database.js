import { MongoClient } from 'mongodb';
import { logger } from './logger.js';
import { config } from './config.js';

export class DatabaseManager {
  constructor() {
    this.client = null;
    this.db = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      logger.info('Connecting to MongoDB...');
      this.client = new MongoClient(config.mongodb.uri, config.mongodb.options);
      await this.client.connect();
      this.db = this.client.db();
      this.isConnected = true;
      
      // Create indexes for better performance
      await this.createIndexes();
      
      logger.success('Connected to MongoDB successfully');
      return this.db;
    } catch (error) {
      logger.error('MongoDB connection failed', { error: error.message });
      throw error;
    }
  }

  async createIndexes() {
    try {
      const collection = this.db.collection('bambisleep_sites');
      
      // Create indexes for better query performance
      await collection.createIndex({ url: 1 }, { unique: true });
      await collection.createIndex({ addedAt: -1 });
      await collection.createIndex({ relevance_score: -1 });
      await collection.createIndex({ keywords: 1 });
      await collection.createIndex({ "analysis.contentType": 1 });
      
      logger.info('Database indexes created successfully');
    } catch (error) {
      logger.warn('Failed to create some indexes', { error: error.message });
    }
  }

  async saveBambiSleepSite(siteData) {
    this.ensureConnection();
    
    try {
      const collection = this.db.collection('bambisleep_sites');
      
      // Check if site already exists
      const existing = await collection.findOne({ url: siteData.url });
      if (existing) {
        // Update existing site with new analysis
        const result = await collection.updateOne(
          { url: siteData.url },
          {
            $set: {
              ...siteData,
              updatedAt: new Date(),
              analysisHistory: [
                ...(existing.analysisHistory || []),
                {
                  date: new Date(),
                  relevance_score: siteData.relevance_score,
                  analysis_method: siteData.analysis?.analysisMethod || 'unknown'
                }
              ].slice(-5) // Keep only last 5 analyses
            }
          }
        );
        
        logger.info('Updated existing site', { url: siteData.url });
        return { success: true, id: existing._id, updated: true };
      }
      
      // Insert new site
      const result = await collection.insertOne({
        ...siteData,
        addedAt: new Date(),
        updatedAt: new Date(),
        viewCount: 0,
        analysisHistory: [{
          date: new Date(),
          relevance_score: siteData.relevance_score,
          analysis_method: siteData.analysis?.analysisMethod || 'unknown'
        }]
      });
      
      logger.success('Saved new BambiSleep site', { 
        url: siteData.url, 
        id: result.insertedId,
        score: siteData.relevance_score 
      });
      
      return { success: true, id: result.insertedId, updated: false };
    } catch (error) {
      logger.error('Failed to save site', { url: siteData.url, error: error.message });
      throw new Error(`Failed to save site: ${error.message}`);
    }
  }

  async getStoredSites(options = {}) {
    this.ensureConnection();
    
    try {
      const {
        limit = 50,
        skip = 0,
        sortBy = 'addedAt',
        sortOrder = -1,
        minScore = 0,
        contentType = null,
        search = null
      } = options;
      
      const collection = this.db.collection('bambisleep_sites');
      
      // Build query
      let query = {};
      
      if (minScore > 0) {
        query.relevance_score = { $gte: minScore };
      }
      
      if (contentType) {
        query['analysis.contentType'] = contentType;
      }
      
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { content_summary: { $regex: search, $options: 'i' } },
          { keywords: { $in: [new RegExp(search, 'i')] } }
        ];
      }
      
      const cursor = collection.find(query)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit);
      
      const sites = await cursor.toArray();
      const total = await collection.countDocuments(query);
      
      logger.info('Retrieved stored sites', { 
        count: sites.length, 
        total, 
        query: Object.keys(query) 
      });
      
      return { sites, total, hasMore: skip + limit < total };
    } catch (error) {
      logger.error('Failed to retrieve sites', { error: error.message });
      throw new Error(`Failed to retrieve sites: ${error.message}`);
    }
  }

  async getSiteStats() {
    this.ensureConnection();
    
    try {
      const collection = this.db.collection('bambisleep_sites');
      
      const stats = await collection.aggregate([
        {
          $group: {
            _id: null,
            totalSites: { $sum: 1 },
            avgScore: { $avg: '$relevance_score' },
            highRelevance: {
              $sum: { $cond: [{ $gte: ['$relevance_score', 70] }, 1, 0] }
            },
            mediumRelevance: {
              $sum: { $cond: [{ $and: [{ $gte: ['$relevance_score', 40] }, { $lt: ['$relevance_score', 70] }] }, 1, 0] }
            },
            lowRelevance: {
              $sum: { $cond: [{ $lt: ['$relevance_score', 40] }, 1, 0] }
            },
            todayCount: {
              $sum: {
                $cond: [
                  { $gte: ['$addedAt', new Date(Date.now() - 24 * 60 * 60 * 1000)] },
                  1,
                  0
                ]
              }
            }
          }
        }
      ]).toArray();
      
      const contentTypes = await collection.aggregate([
        { $group: { _id: '$analysis.contentType', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]).toArray();
      
      const result = stats[0] || {
        totalSites: 0,
        avgScore: 0,
        highRelevance: 0,
        mediumRelevance: 0,
        lowRelevance: 0,
        todayCount: 0
      };
      
      result.contentTypes = contentTypes;
      
      logger.info('Retrieved site statistics', result);
      return result;
    } catch (error) {
      logger.error('Failed to get site stats', { error: error.message });
      throw error;
    }
  }

  async incrementViewCount(url) {
    this.ensureConnection();
    
    try {
      const collection = this.db.collection('bambisleep_sites');
      await collection.updateOne(
        { url },
        { $inc: { viewCount: 1 }, $set: { lastViewed: new Date() } }
      );
    } catch (error) {
      logger.warn('Failed to increment view count', { url, error: error.message });
    }
  }

  async deleteSite(url) {
    this.ensureConnection();
    
    try {
      const collection = this.db.collection('bambisleep_sites');
      const result = await collection.deleteOne({ url });
      
      if (result.deletedCount > 0) {
        logger.info('Deleted site', { url });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('Failed to delete site', { url, error: error.message });
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.connect();
      const result = await this.healthCheck();
      await this.disconnect();
      return result;
    } catch (error) {
      logger.error('Database test connection failed', { error: error.message });
      throw error;
    }
  }

  ensureConnection() {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.isConnected = false;
      this.db = null;
      this.client = null;
      logger.info('Disconnected from MongoDB');
    }
  }

  async healthCheck() {
    try {
      this.ensureConnection();
      await this.db.admin().ping();
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
    }
  }

  async getAllBambiSleepSites() {
    this.ensureConnection();
    
    try {
      const collection = this.db.collection('bambisleep_sites');
      const sites = await collection.find({}).toArray();
      
      logger.info(`Retrieved all ${sites.length} sites from database`);
      return sites;
    } catch (error) {
      logger.error('Failed to retrieve all sites', { error: error.message });
      throw new Error(`Failed to retrieve all sites: ${error.message}`);
    }
  }

  async searchBambiSleepSites(query, options = {}) {
    this.ensureConnection();
    
    try {
      const {
        limit = 50,
        skip = 0,
        minScore = 0,
        sortBy = 'relevance_score',
        sortOrder = -1
      } = options;
      
      const collection = this.db.collection('bambisleep_sites');
      
      // Build search query
      const searchQuery = {
        $and: [
          {
            $or: [
              { title: { $regex: query, $options: 'i' } },
              { description: { $regex: query, $options: 'i' } },
              { content: { $regex: query, $options: 'i' } },
              { keywords: { $in: [new RegExp(query, 'i')] } },
              { url: { $regex: query, $options: 'i' } }
            ]
          }
        ]
      };
      
      if (minScore > 0) {
        searchQuery.$and.push({ relevance_score: { $gte: minScore } });
      }
      
      const results = await collection.find(searchQuery)
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .toArray();
      
      logger.info(`Search found ${results.length} results for query: ${query}`);
      return results;
    } catch (error) {
      logger.error('Search failed', { error: error.message, query });
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async updateSiteAnalysis(url, newAnalysis) {
    this.ensureConnection();
    
    try {
      const collection = this.db.collection('bambisleep_sites');
      
      const updateDoc = {
        $set: {
          'analysis.aiGenerated': newAnalysis,
          'analysis.lastUpdated': new Date(),
          updatedAt: new Date()
        }
      };
      
      const result = await collection.updateOne({ url }, updateDoc);
      
      if (result.matchedCount === 0) {
        throw new Error('Site not found');
      }
      
      logger.info(`Updated analysis for site: ${url}`);
      return result;
    } catch (error) {
      logger.error('Failed to update site analysis', { error: error.message, url });
      throw new Error(`Failed to update site analysis: ${error.message}`);
    }
  }
}

// Export a singleton instance
export const databaseManager = new DatabaseManager();
