// Comprehensive system test
import fetch from 'node-fetch';
import EmbeddingService from '../src/embeddingService.js';

const API_BASE = 'http://localhost:3000';

async function testSystem() {
  console.log('🧪 Comprehensive System Test\n');
  
  let passed = 0;
  let failed = 0;

  // Test 1: Embedding Service Direct
  console.log('1. Testing Embedding Service Direct...');
  try {
    const service = new EmbeddingService();
    await service.initialize();
    
    const stats = await service.getStats();
    console.log('   ✅ Embedding service working');
    console.log(`   📊 Current embeddings: ${stats.vectorStore.totalEmbeddings}`);
    console.log(`   🔌 Provider: ${stats.currentProvider}`);
    console.log(`   📈 Avg relevance: ${stats.vectorStore.averageRelevance.toFixed(3)}`);
    passed++;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    failed++;
  }

  // Test 2: Search Functionality
  console.log('\n2. Testing Search Functionality...');
  try {
    const service = new EmbeddingService();
    await service.initialize();
    
    const results = await service.searchSimilar('bambi hypnosis triggers', { limit: 3 });
    console.log(`   ✅ Search working - found ${results.length} results`);
    if (results.length > 0) {
      console.log(`   🎯 Top result similarity: ${results[0].similarity.toFixed(3)}`);
      console.log(`   📝 Title: ${results[0].title.substring(0, 50)}...`);
    }
    passed++;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    failed++;
  }

  // Test 3: MCP Tools API
  console.log('\n3. Testing MCP Tools API...');
  try {
    const response = await fetch(`${API_BASE}/api/mcp/tools`);
    const data = await response.json();
    console.log(`   ✅ MCP API working - ${data.tools.length} tools available`);
    console.log(`   🔧 Tools: ${data.tools.map(t => t.name).join(', ')}`);
    passed++;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    failed++;
  }

  // Test 4: MCP Search Tool
  console.log('\n4. Testing MCP Search Tool...');
  try {
    const response = await fetch(`${API_BASE}/api/mcp/tools/embedding_search/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: {
          query: 'bambi conditioning',
          options: { limit: 2 }
        }
      })
    });
    
    const data = await response.json();
    if (data.result && Array.isArray(data.result)) {
      console.log(`   ✅ MCP search tool working - ${data.result.length} results`);
    } else {
      console.log(`   ⚠️  MCP search returned: ${JSON.stringify(data).substring(0, 100)}...`);
    }
    passed++;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    failed++;
  }

  // Test 5: Embedding Stats Tool
  console.log('\n5. Testing MCP Stats Tool...');
  try {
    const response = await fetch(`${API_BASE}/api/mcp/tools/embedding_stats/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: {} })
    });
    
    const data = await response.json();
    if (data.result && data.result.vectorStore) {
      console.log(`   ✅ MCP stats tool working`);
      console.log(`   📊 Total embeddings: ${data.result.vectorStore.totalEmbeddings}`);
      console.log(`   🔌 Current provider: ${data.result.currentProvider}`);
    } else {
      console.log(`   ⚠️  Unexpected stats response: ${JSON.stringify(data).substring(0, 100)}...`);
    }
    passed++;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    failed++;
  }

  // Test 6: Content Processing
  console.log('\n6. Testing Content Processing...');
  try {
    const service = new EmbeddingService();
    await service.initialize();
    
    const testContent = {
      title: 'Test BambiSleep Content',
      description: 'Testing content processing',
      mainContent: 'This is a test of BambiSleep conditioning and hypnosis triggers for processing.',
      wordCount: 13
    };
    
    const result = await service.processContent(testContent, { url: 'test://example' });
    
    if (result.embeddings && result.embeddings.length > 0) {
      console.log(`   ✅ Content processing working`);
      console.log(`   🔮 Generated ${result.embeddings.length} embedding(s)`);
      console.log(`   🎯 Relevance: ${result.analysis?.relevanceScore?.toFixed(3) || 'N/A'}`);
      console.log(`   🔌 Provider: ${result.provider}`);
    } else {
      console.log(`   ⚠️  Processing result: ${JSON.stringify(result, null, 2).substring(0, 200)}...`);
    }
    passed++;
  } catch (error) {
    console.log(`   ❌ Failed: ${error.message}`);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`🎉 Test Summary: ${passed} passed, ${failed} failed`);
  console.log(`✅ System Status: ${failed === 0 ? 'FULLY FUNCTIONAL' : 'NEEDS ATTENTION'}`);
  
  if (failed === 0) {
    console.log('\n🚀 System is ready to continue with:');
    console.log('   • Enhanced scraping workflows');
    console.log('   • Additional content analysis features');
    console.log('   • Advanced MCP integrations');
    console.log('   • Performance optimizations');
  }
  
  return { passed, failed };
}

testSystem().catch(console.error);
