import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

export async function exportForLMStudio(vectorStore, outputPath) {
  try {
    const embeddings = await vectorStore.listEmbeddings();
    const lmStudioFormat = {
      version: "1.0",
      created: new Date().toISOString(),
      description: "BambiSleep scraped content embeddings",
      embeddings: []
    };

    for (const entry of embeddings) {
      try {
        const embeddingData = await vectorStore.getEmbedding(entry.id);
        
        lmStudioFormat.embeddings.push({
          id: entry.id,
          text: embeddingData.metadata.cleanedContent || embeddingData.metadata.summary || '',
          title: embeddingData.metadata.title || 'Untitled',
          source: embeddingData.metadata.source || 'unknown',
          embedding: embeddingData.embedding,
          metadata: {
            provider: embeddingData.provider,
            dimensions: embeddingData.dimensions,
            relevanceScore: embeddingData.metadata.relevanceScore,
            wordCount: embeddingData.metadata.wordCount,
            savedAt: embeddingData.metadata.savedAt
          }
        });
      } catch (error) {
        logger.warn(`Failed to export embedding ${entry.id}:`, error.message);
      }
    }

    await fs.writeFile(outputPath, JSON.stringify(lmStudioFormat, null, 2));
    logger.info(`Exported ${lmStudioFormat.embeddings.length} embeddings to ${outputPath}`);
    
    return lmStudioFormat;
  } catch (error) {
    logger.error('Failed to export for LM Studio:', error);
    throw error;
  }
}

export async function exportToCSV(vectorStore, outputPath) {
  try {
    const embeddings = await vectorStore.listEmbeddings();
    const csvRows = ['id,title,source,provider,dimensions,relevanceScore,wordCount,savedAt'];

    for (const entry of embeddings) {
      const row = [
        entry.id,
        `"${(entry.title || '').replace(/"/g, '""')}"`,
        `"${(entry.source || '').replace(/"/g, '""')}"`,
        entry.provider || '',
        entry.dimensions || '',
        entry.relevanceScore || '',
        entry.wordCount || '',
        entry.savedAt || ''
      ].join(',');
      
      csvRows.push(row);
    }

    await fs.writeFile(outputPath, csvRows.join('\n'));
    logger.info(`Exported ${embeddings.length} embeddings to CSV: ${outputPath}`);
    
    return csvRows.length - 1; // Exclude header
  } catch (error) {
    logger.error('Failed to export to CSV:', error);
    throw error;
  }
}

export async function importFromJSON(vectorStore, filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const importData = JSON.parse(data);
    
    let imported = 0;
    let skipped = 0;

    for (const item of importData.embeddings || []) {
      try {
        const embeddingData = {
          embedding: item.embedding,
          provider: item.metadata?.provider || 'imported',
          dimensions: item.metadata?.dimensions || item.embedding.length
        };

        const metadata = {
          source: item.source,
          title: item.title,
          cleanedContent: item.text,
          relevanceScore: item.metadata?.relevanceScore,
          wordCount: item.metadata?.wordCount,
          importedAt: new Date().toISOString(),
          originalSavedAt: item.metadata?.savedAt
        };

        await vectorStore.saveEmbedding(item.id, embeddingData, metadata);
        imported++;
      } catch (error) {
        logger.warn(`Failed to import embedding ${item.id}:`, error.message);
        skipped++;
      }
    }

    logger.info(`Import completed: ${imported} imported, ${skipped} skipped`);
    return { imported, skipped };
  } catch (error) {
    logger.error('Failed to import from JSON:', error);
    throw error;
  }
}
