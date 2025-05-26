// Test embedding generation
import EmbeddingService from '../src/embeddingService.js';

console.log('🚀 Testing embedding generation...');

try {
  const service = new EmbeddingService();
  await service.initialize();
  
  // Test generating an embedding
  console.log('📝 Generating embedding for test text...');
  const result = await service.generateEmbedding('BambiSleep hypnosis trigger test');
  
  console.log('✅ Embedding generated:', {
    provider: result.provider,
    dimensions: result.embedding?.length,
    processingTime: result.processingTime
  });
  
  // Test content processing
  console.log('📚 Processing test content...');
  const content = {
    title: 'Test BambiSleep Content',
    mainContent: 'This is test content about BambiSleep hypnosis with triggers and conditioning.',
    description: 'Test description',
    headings: ['Test Heading'],
    wordCount: 12
  };
  
  const metadata = {
    url: 'https://test.example.com',
    timestamp: new Date().toISOString()
  };
  
  const processResult = await service.processContent(content, metadata);
  console.log('✅ Content processed:', {
    provider: processResult.provider,
    embeddingsCount: processResult.embeddings?.length,
    relevanceScore: processResult.analysis?.relevanceScore,
    storageKey: processResult.storageKey
  });
  
  // Test search
  console.log('🔍 Testing search...');
  const searchResults = await service.searchSimilar('bambi hypnosis', { limit: 3 });
  console.log('✅ Search completed:', {
    resultsFound: searchResults.length,
    topSimilarity: searchResults[0]?.similarity
  });
  
  console.log('🎉 All embedding tests passed!');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  if (error.message.includes('ECONNREFUSED') || error.message.includes('404')) {
    console.log('ℹ️  This is expected if LM Studio is not running - the system should fall back to local embeddings');
  }
}
