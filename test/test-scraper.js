// Basic scraper test file
import URLScraper from '../lib/scraper.js';
import logger from '../src/utils/logger.js';

async function testScraper() {
  console.log('🧪 Testing URL Scraper...\n');

  try {
    const scraper = new URLScraper({
      timeout: 10000,
      maxRetries: 2,
      respectRobots: true
    });

    // Test with a simple, reliable URL
    const testUrl = 'https://httpbin.org/html';
    console.log(`Testing URL: ${testUrl}`);

    const result = await scraper.scrapeUrl(testUrl);
    
    if (result.success) {
      console.log('✅ Scraper test passed');
      console.log(`   - Status: ${result.statusCode}`);
      console.log(`   - Content length: ${result.content?.mainContent?.length || 0} chars`);
      console.log(`   - Title: ${result.content?.title || 'N/A'}`);
    } else {
      console.log('❌ Scraper test failed');
      console.log(`   - Error: ${result.error}`);
    }

  } catch (error) {
    console.error('❌ Test failed with exception:', error.message);
    process.exit(1);
  }
}

testScraper().catch(console.error);
