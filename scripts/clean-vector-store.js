// Fix vector store index by cleaning up orphaned references
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function cleanVectorStoreIndex() {
  console.log('🧹 Cleaning Vector Store Index...\n');

  try {
    const embeddingsDir = path.resolve(__dirname, '../data/embeddings');
    const indexPath = path.join(embeddingsDir, 'index.json');

    // Load current index
    const index = await fs.readJson(indexPath);
    console.log(`📊 Current index has ${Object.keys(index).length} entries`);

    // Check which files actually exist
    const actualFiles = await fs.readdir(embeddingsDir);
    const jsonFiles = actualFiles.filter(f => f.endsWith('.json') && f !== 'index.json');
    console.log(`📁 Found ${jsonFiles.length} actual embedding files`);

    // Clean index - only keep entries for files that exist
    const cleanedIndex = {};
    let removed = 0;
    let kept = 0;

    for (const [id, entry] of Object.entries(index)) {
      const filename = `${id}.json`;
      if (jsonFiles.includes(filename)) {
        cleanedIndex[id] = entry;
        kept++;
      } else {
        console.log(`   🗑️  Removing orphaned entry: ${id}`);
        removed++;
      }
    }

    // Save cleaned index
    await fs.writeJson(indexPath, cleanedIndex, { spaces: 2 });

    console.log(`\n✅ Index cleaned successfully!`);
    console.log(`   📌 Kept: ${kept} entries`);
    console.log(`   🗑️  Removed: ${removed} orphaned entries`);
    console.log(`   💾 Updated index saved`);

    return { kept, removed };

  } catch (error) {
    console.error('❌ Failed to clean index:', error.message);
    throw error;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanVectorStoreIndex().catch(error => {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  });
}

export default cleanVectorStoreIndex;
