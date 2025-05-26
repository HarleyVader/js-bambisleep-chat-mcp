#!/usr/bin/env node
// Standalone embedding generation script
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import EmbeddingService from '../src/embeddingService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadScrapedData(inputDir) {
  const files = await fs.readdir(inputDir);
  const jsonFiles = files.filter(file => file.endsWith('.json') && !file.startsWith('scrape_summary'));
  
  const scrapedData = [];
  for (const file of jsonFiles) {
    try {
      const filepath = path.join(inputDir, file);
      const data = await fs.readJson(filepath);
      scrapedData.push(data);
    } catch (error) {
      logger.warn(`Failed to load scraped data from ${file}:`, error.message);
    }
  }
  
  return scrapedData;
}

async function generateEmbeddings(inputDir = '../data/raw', outputDir = '../data/embeddings') {
  console.log('🔮 Starting Embedding Generation Process...\n');

  try {
    // Initialize embedding service
    console.log('1. Initializing EmbeddingService...');
    const embeddingService = new EmbeddingService();
    await embeddingService.initialize();
    console.log(`   ✅ Service initialized with provider: ${embeddingService.currentProvider?.name || 'Unknown'}\n`);

    // Load scraped data
    const inputPath = path.resolve(__dirname, inputDir);
    const scrapedData = await loadScrapedData(inputPath);
    console.log(`📁 Loaded ${scrapedData.length} scraped files\n`);

    if (scrapedData.length === 0) {
      console.log('⚠️  No scraped data found. Run the scraper first with: npm run scrape');
      return;
    }

    // Ensure output directory exists
    const outputPath = path.resolve(__dirname, outputDir);
    await fs.ensureDir(outputPath);

    // Process each scraped item
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const embeddingResults = [];

    for (let i = 0; i < scrapedData.length; i++) {
      const item = scrapedData[i];
      console.log(`[${i + 1}/${scrapedData.length}] Processing: ${item.url || 'Unknown URL'}`);

      try {
        if (!item.success || !item.content) {
          console.log('   ⏭️  Skipping - No content available');
          skipped++;
          continue;
        }

        // Process content and generate embeddings
        const result = await embeddingService.processContent(item.content, item.metadata);

        if (result.skipped) {
          console.log(`   ⏭️  Skipped - ${result.reason}`);
          skipped++;
        } else if (result.embeddings && result.embeddings.length > 0) {
          console.log(`   ✅ Generated ${result.embeddings.length} embedding(s)`);
          console.log(`   📊 Provider: ${result.provider || 'Unknown'}`);
          console.log(`   🎯 Relevance: ${result.analysis?.relevanceScore?.toFixed(3) || 'N/A'}`);
          
          processed++;
          embeddingResults.push({
            source: item.url,
            embeddings: result.embeddings,
            analysis: result.analysis,
            provider: result.provider
          });
        } else {
          console.log('   ❌ Failed to generate embeddings');
          failed++;
        }

      } catch (error) {
        console.log(`   ❌ Exception: ${error.message}`);
        failed++;
        logger.error(`Failed to process ${item.url}:`, error);
      }
    }

    // Save summary
    const summary = {
      timestamp: new Date().toISOString(),
      total: scrapedData.length,
      processed,
      skipped,
      failed,
      provider: embeddingService.currentProvider?.name,
      results: embeddingResults.map(r => ({
        source: r.source,
        embeddingCount: r.embeddings?.length || 0,
        relevanceScore: r.analysis?.relevanceScore,
        provider: r.provider
      }))
    };

    const summaryPath = path.join(outputPath, `embedding_summary_${Date.now()}.json`);
    await fs.writeJson(summaryPath, summary, { spaces: 2 });

    console.log(`\n🎉 Embedding Generation Complete!`);
    console.log(`   ✅ Processed: ${processed}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   🔮 Provider: ${embeddingService.currentProvider?.name || 'Unknown'}`);
    console.log(`   📁 Summary saved: ${path.basename(summaryPath)}`);

    // Check vector store status
    try {
      const searchResults = await embeddingService.searchSimilar('test', { limit: 1 });
      console.log(`   🔍 Vector store contains ${searchResults.length > 0 ? 'data' : 'no data'}`);
    } catch (error) {
      console.log(`   ⚠️  Vector store check failed: ${error.message}`);
    }

  } catch (error) {
    logger.error('Embedding generation process failed:', error);
    console.error('❌ Process failed:', error.message);
    process.exit(1);
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const inputDir = process.argv[2] || '../data/raw';
  const outputDir = process.argv[3] || '../data/embeddings';
  
  generateEmbeddings(inputDir, outputDir).catch(error => {
    console.error('❌ Embedding generation failed:', error.message);
    process.exit(1);
  });
}

export default generateEmbeddings;
