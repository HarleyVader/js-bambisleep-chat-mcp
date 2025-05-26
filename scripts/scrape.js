#!/usr/bin/env node
// Standalone scraping script
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import URLScraper from '../lib/scraper.js';
import logger from '../src/utils/logger.js';
import { getConfig } from '../src/utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadUrls(urlsFile) {
  try {
    const content = await fs.readFile(urlsFile, 'utf8');
    const urls = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(line => {
        const parts = line.split(' ');
        return {
          url: parts[0],
          priority: parseInt(parts[1]) || 5,
          tags: parts[2] ? parts[2].split(',') : []
        };
      })
      .sort((a, b) => a.priority - b.priority);
    
    return urls;
  } catch (error) {
    logger.error('Failed to load URLs file:', error);
    throw error;
  }
}

async function scrapeUrls(urlsFile = '../urls.txt', outputDir = '../data/raw') {
  console.log('🕷️  Starting URL Scraping Process...\n');

  try {
    // Load configuration
    const config = await getConfig();
    
    // Initialize scraper
    const scraper = new URLScraper(config.scraper);
    
    // Load URLs
    const urlsPath = path.resolve(__dirname, urlsFile);
    const urls = await loadUrls(urlsPath);
    console.log(`📋 Loaded ${urls.length} URLs to scrape\n`);

    // Ensure output directory exists
    const outputPath = path.resolve(__dirname, outputDir);
    await fs.ensureDir(outputPath);

    // Scrape each URL
    const results = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < urls.length; i++) {
      const { url, priority, tags } = urls[i];
      console.log(`[${i + 1}/${urls.length}] Scraping: ${url} (Priority: ${priority})`);

      try {
        const result = await scraper.scrapeUrl(url);
        
        if (result.success) {
          // Generate filename based on URL
          const urlObj = new URL(url);
          const filename = `${urlObj.hostname}_${Date.now()}.json`;
          const filepath = path.join(outputPath, filename);
          
          // Add metadata
          result.metadata = {
            ...result.metadata,
            priority,
            tags,
            originalUrl: url,
            scrapedAt: new Date().toISOString(),
            filename
          };

          // Save to file
          await fs.writeJson(filepath, result, { spaces: 2 });
          
          console.log(`   ✅ Success - Saved to ${filename}`);
          console.log(`   📊 Content: ${result.content?.mainContent?.length || 0} chars`);
          
          successful++;
          results.push({ url, success: true, filename, ...result });
        } else {
          console.log(`   ❌ Failed: ${result.error}`);
          failed++;
          results.push({ url, success: false, error: result.error });
        }

      } catch (error) {
        console.log(`   ❌ Exception: ${error.message}`);
        failed++;
        results.push({ url, success: false, error: error.message });
      }

      // Rate limiting delay
      if (i < urls.length - 1) {
        await new Promise(resolve => setTimeout(resolve, config.scraper?.delay || 1000));
      }
    }

    // Save summary
    const summary = {
      timestamp: new Date().toISOString(),
      total: urls.length,
      successful,
      failed,
      results
    };

    const summaryPath = path.join(outputPath, `scrape_summary_${Date.now()}.json`);
    await fs.writeJson(summaryPath, summary, { spaces: 2 });

    console.log(`\n📈 Scraping Complete!`);
    console.log(`   ✅ Successful: ${successful}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📁 Summary saved: ${path.basename(summaryPath)}`);

  } catch (error) {
    logger.error('Scraping process failed:', error);
    process.exit(1);
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const urlsFile = process.argv[2] || '../urls.txt';
  const outputDir = process.argv[3] || '../data/raw';
  
  scrapeUrls(urlsFile, outputDir).catch(error => {
    console.error('❌ Scraping failed:', error.message);
    process.exit(1);
  });
}

export default scrapeUrls;
