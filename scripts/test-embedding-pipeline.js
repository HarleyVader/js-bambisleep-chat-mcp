// Test script for the embedding pipeline
import EmbeddingService from '../src/embeddingService.js';

async function testEmbeddingPipeline() {
  console.log('🚀 Testing Embedding Pipeline...\n');

  try {
    // Initialize service
    console.log('1. Initializing EmbeddingService...');
    const service = new EmbeddingService();
    await service.initialize();
    console.log('✅ Service initialized successfully\n');

    // Test content processing
    console.log('2. Testing content processing...');
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
      url: 'https://test.bambisleep.com/test',
      timestamp: new Date().toISOString(),
      source: 'test'
    };

    const result = await service.processContent(testContent, testMetadata);
    console.log('✅ Content processed successfully');
    console.log(`   - Provider: ${result.provider}`);
    console.log(`   - Embeddings generated: ${result.embeddings?.length || 0}`);
    console.log(`   - Relevance score: ${result.analysis?.relevanceScore || 'N/A'}`);
    console.log(`   - Word count: ${result.analysis?.wordCount || 'N/A'}\n`);

    // Test search functionality
    console.log('3. Testing search functionality...');
    const searchResults = await service.searchSimilar('bambi hypnosis triggers', { limit: 5 });
    console.log('✅ Search completed successfully');
    console.log(`   - Results found: ${searchResults.length}`);
    if (searchResults.length > 0) {
      console.log(`   - Top result similarity: ${searchResults[0].similarity?.toFixed(3) || 'N/A'}`);
    }
    console.log('');

    // Test statistics
    console.log('4. Testing statistics...');
    const stats = await service.getStats();
    console.log('✅ Statistics retrieved successfully');
    console.log(`   - Total documents: ${stats.totalDocuments}`);
    console.log(`   - Total embeddings: ${stats.totalEmbeddings}`);
    console.log(`   - Current provider: ${stats.currentProvider}`);
    console.log(`   - Storage path: ${stats.storagePath}`);
    console.log('');

    // Test direct embedding generation
    console.log('5. Testing direct embedding generation...');
    const embeddingResult = await service.generateEmbedding('Test text for embedding');
    console.log('✅ Direct embedding generated successfully');
    console.log(`   - Provider: ${embeddingResult.provider}`);
    console.log(`   - Embedding dimensions: ${embeddingResult.embedding?.length || 'N/A'}`);
    console.log(`   - Processing time: ${embeddingResult.processingTime || 'N/A'}ms`);
    console.log('');

    console.log('🎉 All tests completed successfully!');
    
    return {
      success: true,
      results: {
        processing: result,
        search: searchResults,
        stats: stats,
        embedding: embeddingResult
      }
    };

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    return { success: false, error: error.message };
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testEmbeddingPipeline()
    .then(result => {
      if (result.success) {
        console.log('\n✅ Pipeline test completed successfully');
        process.exit(0);
      } else {
        console.log('\n❌ Pipeline test failed');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('\n💥 Unexpected error:', error);
      process.exit(1);
    });
}

export default testEmbeddingPipeline;
