#!/usr/bin/env node

import dotenv from 'dotenv';
import { BambiSleepAnalyzer } from './utils/bambisleep-analyzer.js';

dotenv.config();

async function testMCPEnhancement() {
  console.log('🧪 Testing MCP Server Enhancement...');
  
  try {
    // Test analyzer initialization
    const analyzer = new BambiSleepAnalyzer();
    console.log('✅ BambiSleepAnalyzer initialized successfully');
    
    // Test LM Studio connection
    await analyzer.testConnection();
    console.log('✅ LM Studio connection working');
    
    console.log('🎉 MCP Server enhancement test completed successfully!');
    console.log('\nNew MCP tools available:');
    console.log('- analyze_database_content: AI analysis of all BambiSleep content');
    console.log('- generate_bambisleep_content: AI content generation (guides, stories, analysis)');
    console.log('- search_bambisleep_content: Enhanced search with AI summaries');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMCPEnhancement();
