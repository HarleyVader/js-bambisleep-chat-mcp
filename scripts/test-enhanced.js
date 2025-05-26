#!/usr/bin/env node

/**
 * Test script for enhanced LM Studio URL Scraper functionality
 * Tests browser automation, enhanced content analysis, and new API endpoints
 */

import { enhancedFetcher } from '../src/scraper/fetcher.js';
import { enhancedTextProcessor } from '../src/analyzer/textProcessor.js';
import BrowserManager from '../src/scraper/browser.js';

const TEST_URLS = [
  'https://bambisleep.miraheze.org/wiki/Main_Page',
  'https://bambisleep.miraheze.org/wiki/Bambi_Sleep',
  'https://reddit.com/r/BambiSleep'
];

async function testBrowserManager() {
  console.log('\n🌐 Testing Browser Manager...');
  
  const browserManager = new BrowserManager();
  
  try {
    // Test URL analysis
    for (const url of TEST_URLS.slice(0, 2)) { // Test first 2 URLs
      console.log(`\nTesting URL: ${url}`);
      
      const testResult = await browserManager.testUrl(url);
      console.log(`- Needs Browser: ${testResult.needsBrowser}`);
      console.log(`- JavaScript Content: ${testResult.hasJavaScript}`);
      console.log(`- Dynamic Elements: ${testResult.hasDynamicContent}`);
      console.log(`- Recommendation: ${testResult.needsBrowser ? 'Use browser automation' : 'Standard fetching sufficient'}`);
    }
    
    await browserManager.cleanup();
    console.log('✅ Browser Manager test completed');
  } catch (error) {
    console.error('❌ Browser Manager test failed:', error.message);
  }
}

async function testEnhancedFetcher() {
  console.log('\n📡 Testing Enhanced Fetcher...');
  
  try {
    for (const url of TEST_URLS.slice(0, 2)) { // Test first 2 URLs
      console.log(`\nFetching: ${url}`);
      
      const startTime = Date.now();
      const result = await enhancedFetcher.fetchUrl(url, { timeout: 15000 });
      const duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(`✅ Success (${duration}ms)`);
        console.log(`- Title: ${result.title?.substring(0, 60)}...`);
        console.log(`- Content Length: ${result.content?.length || 0} chars`);
        console.log(`- Browser Used: ${result.browserUsed || false}`);
        console.log(`- Method: ${result.method || 'fetch'}`);
      } else {
        console.log(`❌ Failed: ${result.error}`);
      }
    }
    
    console.log('✅ Enhanced Fetcher test completed');
  } catch (error) {
    console.error('❌ Enhanced Fetcher test failed:', error.message);
  }
}

async function testEnhancedAnalysis() {
  console.log('\n🧠 Testing Enhanced Content Analysis...');
  
  try {
    const testTexts = [
      'Bambi Sleep is a series of hypnosis audio files designed for conditioning and transformation.',
      'This is a general tutorial about web development and JavaScript frameworks.',
      'The hypnosis session includes triggers, mantras, and conditioning for submission training.',
      'Random text about cooking recipes and food preparation techniques.'
    ];
    
    for (let i = 0; i < testTexts.length; i++) {
      const text = testTexts[i];
      console.log(`\nAnalyzing text ${i + 1}: "${text.substring(0, 50)}..."`);
      
      const result = await enhancedTextProcessor.processText(text, { 
        enhanced: true,
        url: `test://example${i + 1}.com`
      });
      
      if (result.analysis) {
        console.log(`- Relevance Score: ${result.analysis.relevanceScore?.toFixed(3) || 'N/A'}`);
        console.log(`- Quality Score: ${result.analysis.qualityScore?.toFixed(3) || 'N/A'}`);
        console.log(`- Category: ${result.analysis.category || 'uncategorized'}`);
        console.log(`- Keywords Found: ${result.analysis.keywordsFound?.length || 0}`);
        console.log(`- Is Relevant: ${result.analysis.relevanceScore > 0.4 ? '✅' : '❌'}`);
      } else {
        console.log('- No analysis available');
      }
    }
    
    console.log('✅ Enhanced Analysis test completed');
  } catch (error) {
    console.error('❌ Enhanced Analysis test failed:', error.message);
  }
}

async function testFullPipeline() {
  console.log('\n🔄 Testing Full Enhanced Pipeline...');
  
  try {
    const url = TEST_URLS[0]; // Use the main wiki page
    console.log(`Testing full pipeline with: ${url}`);
    
    const startTime = Date.now();
    
    // Step 1: Fetch content
    console.log('Step 1: Fetching content...');
    const fetchResult = await enhancedFetcher.fetchUrl(url, { timeout: 15000 });
    
    if (!fetchResult.success) {
      throw new Error(`Fetch failed: ${fetchResult.error}`);
    }
    
    console.log(`✅ Content fetched (${fetchResult.content?.length || 0} chars)`);
    
    // Step 2: Process and analyze
    console.log('Step 2: Processing and analyzing...');
    const processResult = await enhancedTextProcessor.processText(
      fetchResult.content, 
      { 
        url,
        enhanced: true
      }
    );
    
    console.log(`✅ Content processed (${processResult.text?.length || 0} chars)`);
    
    // Step 3: Display results
    console.log('\n📊 Final Results:');
    console.log(`- URL: ${url}`);
    console.log(`- Title: ${fetchResult.title}`);
    console.log(`- Content Length: ${processResult.text?.length || 0} characters`);
    console.log(`- Browser Used: ${fetchResult.browserUsed || false}`);
    console.log(`- Processing Time: ${Date.now() - startTime}ms`);
    
    if (processResult.analysis) {
      console.log('\n🎯 Analysis Results:');
      console.log(`- Relevance Score: ${processResult.analysis.relevanceScore?.toFixed(3) || 'N/A'}`);
      console.log(`- Quality Score: ${processResult.analysis.qualityScore?.toFixed(3) || 'N/A'}`);
      console.log(`- Category: ${processResult.analysis.category || 'uncategorized'}`);
      console.log(`- Keywords Found: ${processResult.analysis.keywordsFound?.join(', ') || 'none'}`);
      console.log(`- Quality Indicators: ${JSON.stringify(processResult.analysis.qualityIndicators || {})}`);
    }
    
    console.log('\n✅ Full pipeline test completed successfully!');
    
  } catch (error) {
    console.error('❌ Full pipeline test failed:', error.message);
  }
}

async function main() {
  console.log('🚀 Starting Enhanced LM Studio URL Scraper Tests\n');
  console.log('=' .repeat(60));
  
  try {
    await testBrowserManager();
    await testEnhancedFetcher();
    await testEnhancedAnalysis();
    await testFullPipeline();
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎉 All tests completed!');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
  }
}

// Handle cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  // Add any cleanup logic here
  process.exit(0);
});

// Run tests
main().catch(console.error);
