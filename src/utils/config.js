import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let config = null;

export async function loadConfig() {
  if (config) return config;
  
  try {
    const configPath = path.join(__dirname, '../../config/default.json');
    const configFile = await fs.readFile(configPath, 'utf8');
    config = JSON.parse(configFile);
    
    // Override with environment variables
    if (process.env.OPENAI_API_KEY) {
      const openaiProvider = config.embedding.providers.find(p => p.name === 'openai');
      if (openaiProvider) {
        openaiProvider.apiKey = process.env.OPENAI_API_KEY;
      }
    }
    
    if (process.env.LM_STUDIO_URL) {
      const lmStudioProvider = config.embedding.providers.find(p => p.name === 'lmstudio');
      if (lmStudioProvider) {
        lmStudioProvider.url = process.env.LM_STUDIO_URL;
      }
    }
    
    return config;
  } catch (error) {
    console.error('Failed to load config:', error);
    // Return default config
    return {
      embedding: {
        providers: [
          {
            name: 'local',
            type: 'mock',
            dimensions: 384,
            priority: 1
          }
        ],
        chunkSize: 512,
        overlap: 50,
        timeout: 30000,
        retryAttempts: 3
      }
    };
  }
}

export async function getConfig() {
  return config || await loadConfig();
}
