#!/usr/bin/env node

/**
 * Comprehensive System Test for BambiSleep Toolsheet
 * Tests all major components and provides detailed feedback
 */

import { logger } from './utils/logger.js';
import { config } from './utils/config.js';
import { WebsiteAnalyzer } from './utils/analyzer.js';
import { DatabaseManager } from './utils/database.js';

class SystemTester {
  constructor() {
    this.analyzer = new WebsiteAnalyzer();
    this.database = new DatabaseManager();
    this.testResults = {};
  }

  async runAllTests() {
    console.log('🧪 Starting BambiSleep System Tests...\n');
    
    try {
      await this.testConfiguration();
      await this.testDatabase();
      await this.testWebsiteAnalyzer();
      await this.testLMStudio();
      await this.testFullWorkflow();
      
      this.printResults();
    } catch (error) {
      logger.error('System test failed', { error: error.message });
      console.error('❌ System test failed:', error.message);
    } finally {
      await this.cleanup();
    }
  }

  async testConfiguration() {
    console.log('📋 Testing Configuration...');
    try {
      const cfg = config;
      console.log(`  ✅ Server port: ${cfg.server.port}`);
      console.log(`  ✅ MongoDB URI: ${cfg.mongodb.uri.replace(/\/\/.*@/, '//***:***@')}`);
      console.log(`  ✅ LM Studio: ${cfg.lmStudio.baseURL}`);
      console.log(`  ✅ Min relevance score: ${cfg.analysis.minRelevanceScore}%`);
      this.testResults.configuration = true;
    } catch (error) {
      console.log(`  ❌ Configuration error: ${error.message}`);
      this.testResults.configuration = false;
    }
    console.log();
  }

  async testDatabase() {
    console.log('🗄️ Testing Database Connection...');
    try {
      const result = await this.database.testConnection();
      console.log(`  ✅ MongoDB connection: ${result.status}`);
      console.log(`  ✅ Database health check passed`);
      this.testResults.database = true;
    } catch (error) {
      console.log(`  ❌ Database error: ${error.message}`);
      this.testResults.database = false;
    }
    console.log();
  }

  async testWebsiteAnalyzer() {
    console.log('🔍 Testing Website Analyzer...');
    try {
      // Test a simple website fetch
      const testUrl = 'https://httpbin.org/html';
      console.log(`  📡 Testing website fetch: ${testUrl}`);
      const content = await this.analyzer.fetchWebsite(testUrl);
      console.log(`  ✅ Content fetched: ${content.title || 'No title'}`);
      console.log(`  ✅ Content length: ${content.contentLength} characters`);
      
      // Test keyword analysis
      const mockContent = {
        url: 'https://test.com/bambisleep',
        title: 'BambiSleep Hypnosis Test',
        metaDescription: 'Test hypnosis content',
        headings: [{text: 'Conditioning and Trance'}],
        bodyText: 'This is about bambisleep hypnosis conditioning and bimbo transformation'
      };
      
      const analysis = this.analyzer.performKeywordAnalysis(mockContent);
      console.log(`  ✅ Keyword analysis: ${analysis.score}% relevance`);
      console.log(`  ✅ Found keywords: ${analysis.foundKeywords.join(', ')}`);
      
      this.testResults.analyzer = true;
    } catch (error) {
      console.log(`  ❌ Analyzer error: ${error.message}`);
      this.testResults.analyzer = false;
    }
    console.log();
  }

  async testLMStudio() {
    console.log('🧠 Testing LM Studio Connection...');
    try {
      const isConnected = await this.analyzer.testLMStudioConnection();
      if (isConnected) {
        console.log(`  ✅ LM Studio connected and ready`);
        this.testResults.lmstudio = true;
      } else {
        console.log(`  ⚠️ LM Studio not available - using fallback analysis`);
        this.testResults.lmstudio = false;
      }
    } catch (error) {
      console.log(`  ❌ LM Studio error: ${error.message}`);
      this.testResults.lmstudio = false;
    }
    console.log();
  }

  async testFullWorkflow() {
    console.log('🔄 Testing Full Analysis Workflow...');
    try {
      await this.database.connect();
      
      // Test analyzing a BambiSleep-related URL
      const testUrl = 'https://reddit.com/r/BambiSleep';
      console.log(`  🎯 Analyzing: ${testUrl}`);
      
      const content = await this.analyzer.fetchWebsite(testUrl);
      const analysis = await this.analyzer.analyzeBambiSleepRelevance(content);
      
      console.log(`  ✅ Analysis complete: ${analysis.relevanceScore}% relevance`);
      console.log(`  ✅ BambiSleep related: ${analysis.isBambiSleep ? 'Yes' : 'No'}`);
      console.log(`  ✅ Analysis method: ${analysis.analysisMethod}`);
      
      // Test database save
      if (analysis.isBambiSleep && analysis.relevanceScore >= config.analysis.minRelevanceScore) {
        const siteData = {
          url: content.url,
          title: content.title,
          content_summary: analysis.summary,
          relevance_score: analysis.relevanceScore,
          keywords: analysis.keywords,
          analysis: analysis
        };
        
        const result = await this.database.saveBambiSleepSite(siteData);
        console.log(`  ✅ Database save: ${result.success ? 'Success' : 'Failed'}`);
      }
      
      // Test retrieval
      const sites = await this.database.getAllBambiSleepSites();
      console.log(`  ✅ Total sites in database: ${sites.length}`);
      
      this.testResults.workflow = true;
    } catch (error) {
      console.log(`  ❌ Workflow error: ${error.message}`);
      this.testResults.workflow = false;
    }
    console.log();
  }

  printResults() {
    console.log('📊 Test Results Summary:');
    console.log('========================');
    
    const tests = [
      { name: 'Configuration', key: 'configuration' },
      { name: 'Database', key: 'database' },
      { name: 'Website Analyzer', key: 'analyzer' },
      { name: 'LM Studio', key: 'lmstudio' },
      { name: 'Full Workflow', key: 'workflow' }
    ];
    
    tests.forEach(test => {
      const status = this.testResults[test.key] ? '✅ PASS' : '❌ FAIL';
      console.log(`  ${test.name}: ${status}`);
    });
    
    const passedTests = Object.values(this.testResults).filter(Boolean).length;
    const totalTests = Object.keys(this.testResults).length;
    
    console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All systems operational!');
    } else if (passedTests >= totalTests - 1) {
      console.log('⚠️ System mostly operational with minor issues');
    } else {
      console.log('❌ System has significant issues that need attention');
    }
  }

  async cleanup() {
    try {
      await this.database.disconnect();
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const tester = new SystemTester();
  tester.runAllTests();
}

export { SystemTester };
