#!/usr/bin/env node
// Setup script for the LM Studio URL Scraper MCP Toolset
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname);

async function setupProject() {
  console.log('🚀 Setting up LM Studio URL Scraper MCP Toolset...\n');

  try {
    // Ensure all required directories exist
    const directories = [
      'data/raw',
      'data/processed', 
      'data/embeddings',
      'logs',
      'test',
      'public',
      'src/scraper',
      'src/analyzer',
      'src/embeddings', 
      'src/storage',
      'src/utils'
    ];

    console.log('📁 Creating directory structure...');
    for (const dir of directories) {
      const dirPath = path.join(projectRoot, dir);
      await fs.ensureDir(dirPath);
      console.log(`   ✅ ${dir}`);
    }

    // Create .env file if it doesn't exist
    const envPath = path.join(projectRoot, '.env');
    if (!await fs.pathExists(envPath)) {
      console.log('\n📝 Creating .env file...');
      const envContent = `# LM Studio URL Scraper MCP Configuration
PORT=3000
NODE_ENV=development

# LM Studio Configuration
LM_STUDIO_URL=http://192.168.0.178:7777
LM_STUDIO_MODEL=text-embedding-nomic-embed-text-v1.5@q8_0

# OpenAI Configuration (optional fallback)
# OPENAI_API_KEY=your_openai_api_key_here

# Logging Level
LOG_LEVEL=info

# Security
JWT_SECRET=your_jwt_secret_here_change_in_production
`;
      await fs.writeFile(envPath, envContent);
      console.log('   ✅ .env file created');
    } else {
      console.log('\n📝 .env file already exists');
    }

    // Create .gitignore if it doesn't exist
    const gitignorePath = path.join(projectRoot, '.gitignore');
    if (!await fs.pathExists(gitignorePath)) {
      console.log('\n📝 Creating .gitignore file...');
      const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*

# Environment variables
.env
.env.local
.env.production

# Logs
logs/
*.log

# Data directories (optional - comment out if you want to track data)
data/raw/
data/processed/
data/embeddings/

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Temporary files
tmp/
temp/
`;
      await fs.writeFile(gitignorePath, gitignoreContent);
      console.log('   ✅ .gitignore file created');
    } else {
      console.log('\n📝 .gitignore file already exists');
    }

    // Create a basic public/index.html if it doesn't exist
    const publicIndexPath = path.join(projectRoot, 'public', 'index.html');
    if (!await fs.pathExists(publicIndexPath)) {
      console.log('\n🌐 Creating basic web interface...');
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LM Studio URL Scraper MCP</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 30px; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .success { background-color: #d4edda; color: #155724; }
        .error { background-color: #f8d7da; color: #721c24; }
        .button { padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
        .button:hover { background: #0056b3; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🕷️ LM Studio URL Scraper MCP</h1>
        <p>Model Context Protocol Toolset for Web Scraping and Embedding Generation</p>
    </div>
    
    <div id="status"></div>
    
    <h2>Quick Actions</h2>
    <button class="button" onclick="testConnection()">Test LM Studio Connection</button>
    <button class="button" onclick="runScraper()">Run Scraper</button>
    <button class="button" onclick="generateEmbeddings()">Generate Embeddings</button>
    
    <h2>System Status</h2>
    <div id="system-status">Loading...</div>
    
    <script>
        async function testConnection() {
            showStatus('Testing LM Studio connection...', 'info');
            try {
                const response = await fetch('/api/mcp/test');
                const result = await response.json();
                showStatus(result.success ? 'Connection successful!' : 'Connection failed!', 
                          result.success ? 'success' : 'error');
            } catch (error) {
                showStatus('Connection test failed: ' + error.message, 'error');
            }
        }
        
        async function runScraper() {
            showStatus('Starting scraper...', 'info');
            try {
                const response = await fetch('/api/scraper/run', { method: 'POST' });
                const result = await response.json();
                showStatus('Scraper completed: ' + result.message, 'success');
            } catch (error) {
                showStatus('Scraper failed: ' + error.message, 'error');
            }
        }
        
        async function generateEmbeddings() {
            showStatus('Generating embeddings...', 'info');
            try {
                const response = await fetch('/api/scraper/embed', { method: 'POST' });
                const result = await response.json();
                showStatus('Embeddings generated: ' + result.message, 'success');
            } catch (error) {
                showStatus('Embedding generation failed: ' + error.message, 'error');
            }
        }
        
        function showStatus(message, type) {
            const statusDiv = document.getElementById('status');
            statusDiv.innerHTML = '<div class="status ' + type + '">' + message + '</div>';
        }
        
        // Load system status on page load
        async function loadSystemStatus() {
            try {
                const response = await fetch('/api/mcp/status');
                const status = await response.json();
                document.getElementById('system-status').innerHTML = 
                    '<pre>' + JSON.stringify(status, null, 2) + '</pre>';
            } catch (error) {
                document.getElementById('system-status').innerHTML = 
                    '<div class="error">Failed to load system status</div>';
            }
        }
        
        loadSystemStatus();
    </script>
</body>
</html>`;
      await fs.writeFile(publicIndexPath, htmlContent);
      console.log('   ✅ Basic web interface created');
    } else {
      console.log('\n🌐 Web interface already exists');
    }

    // Check if all dependencies are installed
    console.log('\n📦 Checking dependencies...');
    const packageJsonPath = path.join(projectRoot, 'package.json');
    const nodeModulesPath = path.join(projectRoot, 'node_modules');
    
    if (!await fs.pathExists(nodeModulesPath)) {
      console.log('   ⚠️  Node modules not found. Please run: npm install');
    } else {
      console.log('   ✅ Dependencies installed');
    }

    console.log('\n🎉 Setup complete! Next steps:');
    console.log('   1. Update .env file with your LM Studio URL and API keys');
    console.log('   2. Run: npm install (if not already done)');
    console.log('   3. Start the server: npm start');
    console.log('   4. Test the scraper: npm run scrape');
    console.log('   5. Generate embeddings: npm run embed');
    console.log('\n📖 Visit http://localhost:3000 for the web interface');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  setupProject().catch(error => {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  });
}

export default setupProject;
