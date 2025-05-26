// Simple test for embedding service
import EmbeddingService from '../src/embeddingService.js';

console.log('🚀 Starting simple embedding test...');

try {
  const service = new EmbeddingService();
  console.log('✅ EmbeddingService created');
  
  await service.initialize();
  console.log('✅ Service initialized');
  
  const stats = await service.getStats();
  console.log('✅ Stats retrieved:', stats);
  
  console.log('🎉 Simple test completed successfully!');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  console.error('Stack:', error.stack);
}
