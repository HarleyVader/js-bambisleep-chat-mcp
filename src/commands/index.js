/**
 * Command handlers for the BambiSleep analyzer
 * This file registers all command handlers for the MCP server
 */

import logger from '../../bambisleep-analyzer/src/utils/logger.js';

/**
 * Register analyzer commands
 * @param {Router} router - MCP router
 * @param {Object} adapters - MCP adapters
 */
export function registerAnalyzerCommands(router, adapters) {
  // Search for BambiSleep content
  router.registerCommand('analyzer.search', async (command, session) => {
    logger.info('Executing analyzer.search command');
    const { query, maxResults = 10 } = command.parameters;
    
    // Search using DuckDuckGo
    const searchResults = await adapters.duckduckgo.execute('search', {
      query: `${query} site:bambisleep.com`,
      max_results: maxResults
    });
    
    // Store search results in session
    return {
      results: searchResults.results,
      query,
      sessionState: {
        lastSearch: {
          query,
          timestamp: new Date().toISOString(),
          resultCount: searchResults.results.length
        }
      }
    };
  }, {
    description: 'Search for BambiSleep content',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxResults: { type: 'number' }
      },
      required: ['query']
    }
  });
  
  // Fetch and analyze content
  router.registerCommand('analyzer.fetchContent', async (command, session) => {
    logger.info('Executing analyzer.fetchContent command');
    const { url } = command.parameters;
    
    // Fetch content using Fetch adapter
    const content = await adapters.fetch.execute('fetch', {
      url,
      extract_text: true
    });
    
    // Store in memory for later processing
    await adapters.memory.execute('store', {
      key: `content:${new URL(url).hostname}:${Date.now()}`,
      value: {
        url,
        title: content.title,
        text: content.text,
        html: content.html,
        fetchedAt: new Date().toISOString()
      }
    });
    
    return {
      url,
      title: content.title,
      textLength: content.text.length,
      sessionState: {
        lastFetch: {
          url,
          timestamp: new Date().toISOString()
        }
      }
    };
  }, {
    description: 'Fetch and analyze content',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' }
      },
      required: ['url']
    }
  });
  
  // Store vector embeddings
  router.registerCommand('analyzer.storeVectors', async (command, session) => {
    logger.info('Executing analyzer.storeVectors command');
    const { url, content, title, vectors } = command.parameters;
    
    // Store in Milvus
    const result = await adapters.milvus.execute('insert', {
      collection: 'bambisleep_content',
      data: {
        id: `content:${new URL(url).hostname}:${Date.now()}`,
        url,
        title,
        content: content.substring(0, 65000), // Truncate if too long
        vector: vectors,
        source: 'analyzer',
        retrieved_at: new Date().toISOString()
      }
    });
    
    return {
      stored: true,
      id: result.id,
      url
    };
  }, {
    description: 'Store vector embeddings',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        content: { type: 'string' },
        title: { type: 'string' },
        vectors: { type: 'array' }
      },
      required: ['url', 'content', 'vectors']
    }
  });
  
  // Search similar content
  router.registerCommand('analyzer.similarContent', async (command, session) => {
    logger.info('Executing analyzer.similarContent command');
    const { query, maxResults = 5 } = command.parameters;
    
    // Search Milvus for similar content
    const results = await adapters.milvus.execute('search', {
      collection: 'bambisleep_content',
      query,
      limit: maxResults
    });
    
    return {
      results: results.map(item => ({
        id: item.id,
        url: item.url,
        title: item.title,
        similarity: item.score,
        retrievedAt: item.retrieved_at
      }))
    };
  }, {
    description: 'Search for similar content',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        maxResults: { type: 'number' }
      },
      required: ['query']
    }
  });
}

export default { registerAnalyzerCommands };
