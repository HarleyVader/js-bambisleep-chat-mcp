#!/usr/bin/env node

/**
 * Unified Test Suite for LM Studio URL Scraper Toolset
 * Combines all test functionality with bambisleep.info as primary test target
 */

import { enhancedFetcher } from './src/scraper/fetcher.js';
import { enhancedTextProcessor } from './src/analyzer/textProcessor.js';
import BrowserManager from './src/scraper/browser.js';
import EmbeddingService from './src/embeddingService.js';
import URLScraper from './lib/scraper.js';
import fetch from 'node-fetch';
import { BAMBISLEEP_KEYWORDS, calculateEnhancedRelevanceScore } from './src/analyzer/filters.js';

// Test URLs - primarily using bambisleep.info
const TEST_URLS = [
  'https://bambisleep.info',   
  'https://bambicloud.com/triggers',
  'https://www.reddit.com/r/BambiSleep/',
];

const API_BASE = 'http://localhost:3000';

class UnifiedTestSuite {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.results = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString().substring(11, 19);
    const icon = {
      'info': 'ℹ️',
      'success': '✅',
      'error': '❌',
      'warning': '⚠️',
      'debug': '🐛'
    }[type] || 'ℹ️';
    
    console.log(`[${timestamp}] ${icon} ${message}`);
  }

  async runTest(testName, testFunction) {
    this.log(`Testing ${testName}...`, 'info');
    const startTime = Date.now();
    
    try {
      const result = await testFunction();
      const duration = Date.now() - startTime;
      this.passed++;
      this.results.push({ test: testName, status: 'passed', duration, result });
      this.log(`${testName} passed (${duration}ms)`, 'success');
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.failed++;
      this.results.push({ test: testName, status: 'failed', duration, error: error.message });
      this.log(`${testName} failed: ${error.message} (${duration}ms)`, 'error');
      throw error;
    }
  }

  // Test 1: Basic URL Scraper
  async testBasicScraper() {
    const scraper = new URLScraper({
      timeout: 15000,
      maxRetries: 2,
      respectRobots: true
    });

    const testUrl = TEST_URLS[0]; // bambisleep.info
    this.log(`Testing basic scraper with: ${testUrl}`);

    const result = await scraper.scrapeUrl(testUrl);
    
    if (!result.success) {
      throw new Error(`Basic scraper failed: ${result.error}`);
    }

    this.log(`Content length: ${result.content?.mainContent?.length || 0} chars`);
    this.log(`Title: ${result.content?.title || 'N/A'}`);
    
    return {
      url: testUrl,
      contentLength: result.content?.mainContent?.length || 0,
      title: result.content?.title,
      success: result.success
    };
  }

  // Test 2: Browser Manager
  async testBrowserManager() {
    const browserManager = new BrowserManager();
    const testUrl = TEST_URLS[0];
    
    try {
      this.log(`Testing browser manager with: ${testUrl}`);
      
      const testResult = await browserManager.testUrl(testUrl);
      
      this.log(`Needs Browser: ${testResult.needsBrowser}`);
      this.log(`JavaScript Content: ${testResult.hasJavaScript}`);
      this.log(`Dynamic Elements: ${testResult.hasDynamicContent}`);
      
      await browserManager.cleanup();
      
      return {
        url: testUrl,
        needsBrowser: testResult.needsBrowser,
        hasJavaScript: testResult.hasJavaScript,
        hasDynamicContent: testResult.hasDynamicContent,
        recommendation: testResult.recommendation
      };
    } finally {
      await browserManager.cleanup();
    }
  }

  // Test 3: Enhanced Fetcher
  async testEnhancedFetcher() {
    const testUrl = TEST_URLS[0];
    this.log(`Testing enhanced fetcher with: ${testUrl}`);
    
    const result = await enhancedFetcher.smartFetch(testUrl, { timeout: 15000 });
    
    if (!result.success) {
      throw new Error(`Enhanced fetcher failed: ${result.error}`);
    }
    
    this.log(`Method used: ${result.method}`);
    this.log(`Content length: ${result.data?.content?.mainContent?.length || 0} chars`);
    this.log(`Title: ${result.data?.content?.title || 'N/A'}`);
    
    return {
      url: testUrl,
      method: result.method,
      contentLength: result.data?.content?.mainContent?.length || 0,
      title: result.data?.content?.title,
      success: result.success
    };
  }

  // Test 4: Enhanced Content Analysis
  async testEnhancedAnalysis() {
    const testTexts = [
      'BambiSleep is a hypnosis series designed to create bambi conditioning and transformation through triggers.',
      'This is general content about web development and JavaScript programming.',
      'The hypnosis session includes triggers, mantras, and conditioning for submission training with bambi.',
      'Random text about cooking recipes and food preparation techniques.'
    ];
    
    const results = [];
    
    for (let i = 0; i < testTexts.length; i++) {
      const text = testTexts[i];
      this.log(`Analyzing text ${i + 1}: "${text.substring(0, 50)}..."`);
      
      const result = await enhancedTextProcessor.processText(text, { 
        enhanced: true,
        url: `https://bambisleep.info/test${i + 1}`
      });
      
      if (result.analysis) {
        this.log(`Relevance Score: ${result.analysis.relevanceScore?.toFixed(3) || 'N/A'}`);
        this.log(`Quality Score: ${result.analysis.qualityScore?.toFixed(3) || 'N/A'}`);
        this.log(`Category: ${result.analysis.category || 'uncategorized'}`);
        this.log(`Keywords Found: ${result.analysis.keywordsFound?.length || 0}`);
      }
      
      results.push({
        text: text.substring(0, 50) + '...',
        relevanceScore: result.analysis?.relevanceScore,
        qualityScore: result.analysis?.qualityScore,
        category: result.analysis?.category,
        keywordsFound: result.analysis?.keywordsFound?.length || 0
      });
    }
    
    return results;
  }

  // Test 5: Embedding Service
  async testEmbeddingService() {
    const service = new EmbeddingService();
    await service.initialize();
    
    this.log('Testing embedding service initialization');
    
    // Test content processing
    const testContent = {
      title: 'BambiSleep Test Content',
      description: 'Test content for BambiSleep hypnosis system',
      mainContent: `
        BambiSleep is a hypnosis series designed to create a specific mental state.
        The triggers and conditioning work through repetitive exposure to audio files.
        Key concepts include bambi mode, good girl responses, and hypnotic triggers.
        This content explores themes of feminization and mental conditioning.
      `,
      headings: ['Introduction', 'Triggers', 'Effects'],
      wordCount: 45
    };

    const testMetadata = {
      url: 'https://bambisleep.info',
      timestamp: new Date().toISOString(),
      source: 'unified-test'
    };

    const result = await service.processContent(testContent, testMetadata);
    
    this.log(`Provider: ${result.provider}`);
    this.log(`Embeddings generated: ${result.embeddings?.length || 0}`);
    this.log(`Relevance score: ${result.analysis?.relevanceScore || 'N/A'}`);
    
    // Test search functionality
    this.log('Testing search functionality');
    const searchResults = await service.searchSimilar('bambi hypnosis triggers', { limit: 3 });
    this.log(`Search results: ${searchResults.length}`);
    
    if (searchResults.length > 0) {
      this.log(`Top result similarity: ${searchResults[0].similarity?.toFixed(3)}`);
    }
    
    // Get stats
    const stats = await service.getStats();
    this.log(`Total embeddings in store: ${stats.vectorStore.totalEmbeddings}`);
    this.log(`Current provider: ${stats.currentProvider}`);
    
    return {
      provider: result.provider,
      embeddingsGenerated: result.embeddings?.length || 0,
      relevanceScore: result.analysis?.relevanceScore,
      searchResults: searchResults.length,
      totalEmbeddings: stats.vectorStore.totalEmbeddings
    };
  }

  // Test 6: URL Testing Function (from fetcher.js)
  async testUrlTestFunction() {
    const testUrl = TEST_URLS[0];
    this.log(`Testing URL test function with: ${testUrl}`);
    
    const results = await enhancedFetcher.testUrl(testUrl);
    
    this.log(`URL accessible: ${results.accessible}`);
    this.log(`Requires browser: ${results.requiresBrowser}`);
    this.log(`Basic working: ${results.basicWorking}`);
    this.log(`Browser working: ${results.browserWorking}`);
    this.log(`Basic performance: ${results.performance.basic}ms`);
    this.log(`Browser performance: ${results.performance.browser}ms`);
    this.log(`Recommendations: ${results.recommendations.join(', ')}`);
    
    return {
      url: testUrl,
      accessible: results.accessible,
      requiresBrowser: results.requiresBrowser,
      basicWorking: results.basicWorking,
      browserWorking: results.browserWorking,
      performance: results.performance,
      recommendations: results.recommendations
    };
  }

  // Test 7: Batch Processing
  async testBatchProcessing() {
    const testUrls = TEST_URLS.slice(0, 2); // Use first 2 URLs
    this.log(`Testing batch processing with ${testUrls.length} URLs`);
    
    const result = await enhancedFetcher.batchFetch(testUrls, {
      concurrency: 2,
      delay: 1000
    });
    
    this.log(`Total processed: ${result.summary.total}`);
    this.log(`Successful: ${result.summary.successful}`);
    this.log(`Failed: ${result.summary.failed}`);
    this.log(`Success rate: ${(result.summary.successRate * 100).toFixed(1)}%`);
    
    return {
      total: result.summary.total,
      successful: result.summary.successful,
      failed: result.summary.failed,
      successRate: result.summary.successRate
    };
  }
  // Test 8: Relevance Calculation
  async testRelevanceCalculation() {
    const testContent = {
      mainContent: 'BambiSleep is a hypnosis series designed to create bambi conditioning and transformation through triggers and repetitive audio files.',
      title: 'BambiSleep Hypnosis Guide',
      description: 'Complete guide to BambiSleep conditioning and trigger training'
    };
    
    this.log('Testing relevance calculation with BambiSleep content');
    
    const result = calculateEnhancedRelevanceScore(testContent);
    
    this.log(`Relevance score: ${result.score.toFixed(3)}`);
    this.log(`Keywords found: ${Object.keys(result.details.keywordMatches).length} categories`);
    this.log(`Total matches: ${Object.values(result.details.keywordMatches).reduce((total, cat) => total + Object.keys(cat).length, 0)}`);
    
    return {
      score: result.score,
      categories: Object.keys(result.details.keywordMatches).length,
      totalMatches: Object.values(result.details.keywordMatches).reduce((total, cat) => total + Object.keys(cat).length, 0),
      details: result.details
    };
  }

  // Test 8.5: BambiSleep Content Structure Validation
  async testBambiSleepContentValidation() {
    const testUrl = TEST_URLS[0]; // bambisleep.info
    this.log(`Testing BambiSleep content structure validation with: ${testUrl}`);
    
    // Fetch the main page
    const result = await enhancedFetcher.smartFetch(testUrl, { timeout: 15000 });
    
    if (!result.success) {
      throw new Error(`Failed to fetch BambiSleep content: ${result.error}`);
    }
    
    const content = result.data.content;
    
    // Validate expected BambiSleep content elements
    const validations = {
      hasTitle: !!content.title,
      titleContainsBambi: content.title?.toLowerCase().includes('bambi') || false,
      hasMainContent: !!content.mainContent && content.mainContent.length > 100,
      contentContainsBambi: content.mainContent?.toLowerCase().includes('bambi') || false,
      contentContainsHypnosis: content.mainContent?.toLowerCase().includes('hypnosis') || false,
      hasReasonableWordCount: content.wordCount > 50,
      hasLinks: content.links && content.links.length > 0,
      hasHeadings: content.headings && content.headings.length > 0
    };
    
    // Calculate BambiSleep relevance score
    const relevanceResult = calculateEnhancedRelevanceScore(content);
    validations.highRelevanceScore = relevanceResult.score > 0.7;
    
    // Log validation results
    Object.entries(validations).forEach(([key, value]) => {
      this.log(`${key}: ${value ? '✅' : '❌'}`);
    });
    
    this.log(`BambiSleep relevance score: ${relevanceResult.score.toFixed(3)}`);
    this.log(`Content word count: ${content.wordCount || 0}`);
    this.log(`Number of links found: ${content.links?.length || 0}`);
    this.log(`Number of headings found: ${content.headings?.length || 0}`);
    
    const validationsPassed = Object.values(validations).filter(v => v).length;
    const totalValidations = Object.keys(validations).length;
    
    return {
      url: testUrl,
      validationsPassed,
      totalValidations,
      validationRate: validationsPassed / totalValidations,
      relevanceScore: relevanceResult.score,
      contentStats: {
        wordCount: content.wordCount || 0,
        linksCount: content.links?.length || 0,
        headingsCount: content.headings?.length || 0
      },
      validations
    };
  }

  // Test 9: MCP API (if server is running)
  async testMCPAPI() {
    try {
      this.log('Testing MCP API endpoints');
      
      // Test tools list
      const toolsResponse = await fetch(`${API_BASE}/api/mcp/tools`);
      const toolsData = await toolsResponse.json();
      
      this.log(`MCP tools available: ${toolsData.tools?.length || 0}`);
      
      // Test embedding search
      const searchResponse = await fetch(`${API_BASE}/api/mcp/tools/embedding_search/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: {
            query: 'bambi conditioning',
            options: { limit: 2 }
          }
        })
      });
      
      const searchData = await searchResponse.json();
      this.log(`MCP search results: ${searchData.result?.length || 0}`);
      
      // Test stats
      const statsResponse = await fetch(`${API_BASE}/api/mcp/tools/embedding_stats/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: {} })
      });
      
      const statsData = await statsResponse.json();
      this.log(`MCP stats - embeddings: ${statsData.result?.vectorStore?.totalEmbeddings || 0}`);
      
      return {
        toolsAvailable: toolsData.tools?.length || 0,
        searchResults: searchData.result?.length || 0,
        totalEmbeddings: statsData.result?.vectorStore?.totalEmbeddings || 0
      };
      
    } catch (error) {
      if (error.message.includes('ECONNREFUSED')) {
        this.log('Server not running - skipping MCP API tests', 'warning');
        return { skipped: true, reason: 'Server not running' };
      }
      throw error;
    }
  }

  // Test 10: Full Pipeline Integration
  async testFullPipeline() {
    const testUrl = TEST_URLS[0];
    this.log(`Testing full pipeline integration with: ${testUrl}`);
    
    // Step 1: Fetch content
    this.log('Step 1: Fetching content with enhanced fetcher');
    const fetchResult = await enhancedFetcher.smartFetch(testUrl, { timeout: 15000 });
    
    if (!fetchResult.success) {
      throw new Error(`Fetch failed: ${fetchResult.error}`);
    }
    
    // Step 2: Process and analyze
    this.log('Step 2: Processing content with enhanced analysis');
    const processResult = await enhancedTextProcessor.processText(
      fetchResult.data.content.mainContent, 
      { 
        url: testUrl,
        enhanced: true,
        title: fetchResult.data.content.title
      }
    );
    
    // Step 3: Generate embeddings
    this.log('Step 3: Generating embeddings');
    const service = new EmbeddingService();
    await service.initialize();
    
    const embeddingResult = await service.processContent({
      title: fetchResult.data.content.title,
      description: fetchResult.data.content.description,
      mainContent: processResult.text,
      wordCount: processResult.analysis?.wordCount || 0
    }, {
      url: testUrl,
      timestamp: new Date().toISOString(),
      source: 'unified-test-pipeline'
    });
    
    this.log(`Pipeline completed successfully`);
    this.log(`Content length: ${processResult.text?.length || 0} chars`);
    this.log(`Relevance score: ${processResult.analysis?.relevanceScore?.toFixed(3) || 'N/A'}`);
    this.log(`Quality score: ${processResult.analysis?.qualityScore?.toFixed(3) || 'N/A'}`);
    this.log(`Embeddings generated: ${embeddingResult.embeddings?.length || 0}`);
    
    return {
      url: testUrl,
      method: fetchResult.method,
      contentLength: processResult.text?.length || 0,
      relevanceScore: processResult.analysis?.relevanceScore,
      qualityScore: processResult.analysis?.qualityScore,
      category: processResult.analysis?.category,
      embeddingsGenerated: embeddingResult.embeddings?.length || 0,
      provider: embeddingResult.provider
    };
  }
  async runAllTests() {
    console.log('🚀 Starting Unified Test Suite for LM Studio URL Scraper Toolset\n');
    console.log('🎯 Primary test target: bambisleep.info (comprehensive testing)');
    console.log('📊 Testing all modules with BambiSleep-focused content analysis');
    console.log('=' .repeat(80));
    
    const startTime = Date.now();
    
    try {      // Run all tests in optimized order
      await this.runTest('Basic URL Scraper (bambisleep.info)', () => this.testBasicScraper());
      await this.runTest('Browser Manager (JS detection)', () => this.testBrowserManager());
      await this.runTest('Enhanced Fetcher (smart routing)', () => this.testEnhancedFetcher());
      await this.runTest('Enhanced Content Analysis (BambiSleep)', () => this.testEnhancedAnalysis());
      await this.runTest('Embedding Service (vector generation)', () => this.testEmbeddingService());
      await this.runTest('URL Test Function (capability detection)', () => this.testUrlTestFunction());
      await this.runTest('Batch Processing (multiple URLs)', () => this.testBatchProcessing());
      await this.runTest('Relevance Calculation (BambiSleep scoring)', () => this.testRelevanceCalculation());
      await this.runTest('BambiSleep Content Validation (structure)', () => this.testBambiSleepContentValidation());
      await this.runTest('MCP API (server integration)', () => this.testMCPAPI());
      await this.runTest('Full Pipeline Integration (end-to-end)', () => this.testFullPipeline());
      
    } catch (error) {
      this.log(`Critical test failure: ${error.message}`, 'error');
    }
    
    // Cleanup
    await this.cleanup();
    
    // Generate summary
    this.generateSummary(Date.now() - startTime);
  }

  async cleanup() {
    this.log('Cleaning up resources...');
    try {
      await enhancedFetcher.cleanup();
    } catch (error) {
      this.log(`Cleanup warning: ${error.message}`, 'warning');
    }
  }
  generateSummary(totalTime) {
    console.log('\n' + '=' .repeat(80));
    console.log('📊 UNIFIED TEST SUITE SUMMARY');
    console.log('=' .repeat(80));
    
    console.log(`\n🎯 Primary Target: ${TEST_URLS[0]} (BambiSleep Content Analysis)`);
    console.log(`⏱️  Total Execution Time: ${totalTime}ms`);
    console.log(`✅ Tests Passed: ${this.passed}`);
    console.log(`❌ Tests Failed: ${this.failed}`);
    console.log(`📈 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
    
    if (this.failed === 0) {
      console.log('\n🎉 ALL TESTS PASSED! BambiSleep scraper system is fully functional.');
      console.log('\n🚀 System ready for:');
      console.log('   • Production scraping of bambisleep.info content');
      console.log('   • Enhanced BambiSleep content analysis and scoring');
      console.log('   • Browser automation for dynamic content extraction');
      console.log('   • Vector embeddings and semantic search of hypnosis content');
      console.log('   • MCP integration with LM Studio for chat applications');
      console.log('   • Batch processing of multiple BambiSleep resources');
    } else {
      console.log('\n⚠️  Some tests failed. Check the logs above for details.');
      console.log('   System may have issues with bambisleep.info integration.');
    }
    
    // Detailed results
    console.log('\n📋 Detailed Test Results:');
    this.results.forEach((result, index) => {
      const status = result.status === 'passed' ? '✅' : '❌';
      const num = (index + 1).toString().padStart(2, ' ');
      const duration = `${result.duration}ms`.padStart(6, ' ');
      console.log(`${num}. ${status} ${result.test} (${duration})`);
      if (result.status === 'failed') {
        console.log(`     ❌ Error: ${result.error}`);
      }
    });
    
    console.log('\n' + '=' .repeat(80));
    console.log('🔗 For more information visit: https://bambisleep.info');
    console.log('=' .repeat(80));
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  try {
    await enhancedFetcher.cleanup();
  } catch (error) {
    console.log(`Cleanup error: ${error.message}`);
  }
  process.exit(0);
});

// Run the unified test suite
const testSuite = new UnifiedTestSuite();
testSuite.runAllTests()
  .then(() => {
    const exitCode = testSuite.failed > 0 ? 1 : 0;
    process.exit(exitCode);
  })
  .catch(error => {
    console.error('\n💥 Test suite crashed:', error);
    process.exit(1);
  });

export default UnifiedTestSuite;
