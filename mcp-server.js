import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { MongoClient } from 'mongodb';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { BambiSleepAnalyzer } from './utils/bambisleep-analyzer.js';

dotenv.config();

// LM Studio client configuration
const lmStudioClient = new OpenAI({
  baseURL: `http://${process.env.LMS_HOST || 'localhost'}:${process.env.LMS_PORT || 1234}/v1`,
  apiKey: 'lm-studio'
});

// MongoDB connection
let db;
let analyzer;
const connectToMongoDB = async () => {
  try {
    const client = await MongoClient.connect(process.env.MONGODB_URI);
    db = client.db();
    analyzer = new BambiSleepAnalyzer();
    console.log('Connected to MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
};

class BambiSleepMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'bambisleep-analyzer',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'fetch_website',
            description: 'Fetch and analyze website content for BambiSleep relevance',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'URL to fetch and analyze'
                }
              },
              required: ['url']
            }
          },
          {
            name: 'compare_bambisleep_content',
            description: 'Compare website content with known BambiSleep patterns using LM Studio',
            inputSchema: {
              type: 'object',
              properties: {
                content: {
                  type: 'object',
                  description: 'Website content to analyze'
                }
              },
              required: ['content']
            }
          },
          {
            name: 'save_bambisleep_site',
            description: 'Save a BambiSleep-related site to the database',
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                title: { type: 'string' },
                summary: { type: 'string' },
                relevanceScore: { type: 'number' },
                keywords: { 
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: ['url', 'title', 'summary', 'relevanceScore']
            }
          },          {
            name: 'get_stored_sites',
            description: 'Retrieve stored BambiSleep sites from database',
            inputSchema: {
              type: 'object',
              properties: {
                limit: {
                  type: 'number',
                  description: 'Limit number of results'
                }
              }
            }
          },
          {
            name: 'analyze_database_content',
            description: 'Perform comprehensive AI analysis of all BambiSleep content in database',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'generate_bambisleep_content',
            description: 'Generate BambiSleep content using AI',
            inputSchema: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  description: 'Content type: guide, story, analysis, script',
                  enum: ['guide', 'story', 'analysis', 'script']
                },
                topic: { type: 'string', description: 'Content topic' },
                audience: { type: 'string', description: 'Target audience' },
                length: { type: 'string', description: 'Content length' },
                theme: { type: 'string', description: 'Story theme (for stories)' },
                perspective: { type: 'string', description: 'Narrative perspective (for stories)' },
                setting: { type: 'string', description: 'Story setting (for stories)' },
                save: { type: 'boolean', description: 'Save content to database' }
              },
              required: ['type']
            }
          },
          {
            name: 'search_bambisleep_content',
            description: 'Search BambiSleep content in database with AI summaries',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Search query' },
                limit: { type: 'number', description: 'Limit number of results', default: 10 }
              },
              required: ['query']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {        switch (name) {
          case 'fetch_website':
            return await this.handleFetchWebsite(args.url);
          
          case 'compare_bambisleep_content':
            return await this.handleCompareBambiSleep(args.content);
          
          case 'save_bambisleep_site':
            return await this.handleSaveSite(args);
          
          case 'get_stored_sites':
            return await this.handleGetStoredSites(args.limit || 50);
          
          case 'analyze_database_content':
            return await this.handleAnalyzeDatabaseContent();
          
          case 'generate_bambisleep_content':
            return await this.handleGenerateContent(args);
          
          case 'search_bambisleep_content':
            return await this.handleSearchContent(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error.message}`
            }
          ]
        };
      }
    });

    // List resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'bambisleep://sites',
            name: 'BambiSleep Sites Database',
            description: 'Collection of analyzed BambiSleep-related websites',
            mimeType: 'application/json'
          }
        ]
      };
    });

    // Read resources
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      if (uri === 'bambisleep://sites') {
        const sites = await this.getStoredSites();
        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(sites, null, 2)
            }
          ]
        };
      }
      
      throw new Error(`Unknown resource: ${uri}`);
    });
  }

  async handleFetchWebsite(url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      const $ = cheerio.load(response.data);
      
      const content = {
        url,
        title: $('title').text() || '',
        metaDescription: $('meta[name="description"]').attr('content') || '',
        headings: $('h1, h2, h3').map((i, el) => $(el).text()).get().join(' '),
        bodyText: $('body').text().replace(/\s+/g, ' ').trim().substring(0, 2000),
        fetchedAt: new Date().toISOString()
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(content, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to fetch ${url}: ${error.message}`);
    }
  }

  async handleCompareBambiSleep(content) {
    const prompt = `Analyze this website content to determine if it's related to BambiSleep hypnosis content.

BambiSleep is a specific hypnosis series known for:
- Feminization and bimbification themes
- Hypnotic conditioning
- Adult transformation content
- Sissy training elements

Website Content:
Title: ${content.title}
Meta Description: ${content.metaDescription}
Headings: ${content.headings}
Body Text: ${content.bodyText?.substring(0, 1000)}

Analyze and provide:
1. Is this BambiSleep related? (yes/no)
2. Relevance score (0-100)
3. Brief content summary
4. Key indicators found
5. Confidence level`;

    try {
      const response = await lmStudioClient.chat.completions.create({
        model: "any",
        messages: [
          {
            role: "system",
            content: "You are an expert content analyzer specializing in hypnosis and adult content categorization. Provide detailed, objective analysis."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      const analysis = response.choices[0].message.content;

      // Parse keywords and score from the analysis
      const text = (content.title + ' ' + content.bodyText).toLowerCase();
      const bambiKeywords = ['bambisleep', 'bambi sleep', 'bimbo', 'hypnosis', 'feminization', 'sissy', 'conditioning'];
      const foundKeywords = bambiKeywords.filter(keyword => text.includes(keyword));
      
      const result = {
        isBambiSleep: foundKeywords.length > 0 || analysis.toLowerCase().includes('yes'),
        relevanceScore: Math.min(foundKeywords.length * 15, 100),
        summary: analysis,
        keywords: foundKeywords,
        analysisDate: new Date().toISOString()
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error('LM Studio analysis error:', error);
      
      // Fallback analysis
      const text = (content.title + ' ' + content.bodyText).toLowerCase();
      const bambiKeywords = ['bambisleep', 'bambi sleep', 'bimbo', 'hypnosis', 'feminization', 'sissy'];
      const foundKeywords = bambiKeywords.filter(keyword => text.includes(keyword));
      
      const result = {
        isBambiSleep: foundKeywords.length > 0,
        relevanceScore: Math.min(foundKeywords.length * 20, 100),
        summary: `Keyword-based analysis. Found: ${foundKeywords.join(', ')}`,
        keywords: foundKeywords,
        analysisDate: new Date().toISOString()
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }
  }

  async handleSaveSite(siteData) {
    if (!db) {
      throw new Error('Database not connected');
    }

    try {
      const collection = db.collection('bambisleep_sites');
      
      // Check if site already exists
      const existing = await collection.findOne({ url: siteData.url });
      if (existing) {
        return {
          content: [
            {
              type: 'text',
              text: 'Site already exists in database'
            }
          ]
        };
      }

      const result = await collection.insertOne({
        ...siteData,
        addedAt: new Date()
      });

      return {
        content: [
          {
            type: 'text',
            text: `Site saved successfully with ID: ${result.insertedId}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to save site: ${error.message}`);
    }
  }

  async handleGetStoredSites(limit = 50) {
    if (!db) {
      throw new Error('Database not connected');
    }

    try {
      const collection = db.collection('bambisleep_sites');
      const sites = await collection.find({})
        .sort({ addedAt: -1 })
        .limit(limit)
        .toArray();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(sites, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to retrieve sites: ${error.message}`);
    }  }

  async handleAnalyzeDatabaseContent() {
    if (!analyzer) {
      throw new Error('Analyzer not initialized');
    }

    try {
      const report = await analyzer.analyzeDatabaseContent();
      
      return {
        content: [
          {
            type: 'text',
            text: `Database Analysis Complete!\n\n${report}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to analyze database: ${error.message}`);
    }
  }

  async handleGenerateContent(args) {
    if (!analyzer) {
      throw new Error('Analyzer not initialized');
    }

    try {
      const content = await analyzer.writeBambiSleepContent(
        args.type,
        {
          topic: args.topic,
          audience: args.audience,
          length: args.length,
          theme: args.theme,
          perspective: args.perspective,
          setting: args.setting
        },
        args.save || false
      );
      
      return {
        content: [
          {
            type: 'text',
            text: `Generated ${args.type.toUpperCase()} Content:\n\n${content}\n\n${args.save ? '✅ Content saved to database' : ''}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to generate content: ${error.message}`);
    }
  }

  async handleSearchContent(args) {
    if (!analyzer) {
      throw new Error('Analyzer not initialized');
    }

    try {
      const results = await analyzer.searchDatabaseContent(args.query, args.limit || 10);
      
      return {
        content: [
          {
            type: 'text',
            text: `Search Results for "${args.query}":\n\n${JSON.stringify(results, null, 2)}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to search content: ${error.message}`);
    }
  }

  async getStoredSites() {
    if (!db) return [];
    
    try {
      const collection = db.collection('bambisleep_sites');
      return await collection.find({}).sort({ addedAt: -1 }).toArray();
    } catch (error) {
      console.error('Error getting stored sites:', error);
      return [];
    }
  }

  async run() {
    await connectToMongoDB();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('BambiSleep MCP server running on stdio');
  }
}

const server = new BambiSleepMCPServer();
server.run().catch(console.error);
