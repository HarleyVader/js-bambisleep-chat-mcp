# LM Studio URL Scraper MCP Toolset

A comprehensive URL scraper with Model Context Protocol (MCP) integration, intelligent content analysis, and vector embedding generation for LM Studio. Built with Node.js, Express, and a modular embedding system.

## Features

- **Ethical Web Scraping**: Respects robots.txt and implements rate limiting
- **Batch Processing**: Scrape multiple URLs simultaneously
- **Intelligent Content Analysis**: BambiSleep-specific content relevance scoring
- **Vector Embeddings**: Multi-provider embedding generation (LM Studio, OpenAI, local fallback)
- **Semantic Search**: Similarity search across processed content
- **MCP Integration**: Direct integration with LM Studio via REST API
- **Web Interface**: User-friendly dashboard with real-time feedback
- **Content Storage**: Organized storage with vector database functionality
- **Error Handling**: Comprehensive error handling and logging with provider fallback
- **Security**: Built-in security measures and input validation

## Architecture

### Core Components

- **Embedding Service** (`src/embeddingService.js`): Main orchestrator for content processing
- **Embedding Providers** (`src/embeddings/models.js`): LM Studio, OpenAI, and local mock providers
- **Text Analyzer** (`src/analyzer/textProcessor.js`): Content analysis and relevance scoring
- **Vector Storage** (`src/storage/vectorStore.js`): Embedding storage and similarity search
- **Content Scraper** (`lib/scraper.js`): Web scraping with robots.txt compliance

### Provider Fallback System

1. **LM Studio Provider**: Primary provider for local embedding generation
2. **OpenAI Provider**: Fallback for cloud-based embeddings
3. **Local Mock Provider**: Deterministic fallback using text hashing

The system automatically detects when LM Studio has no models loaded (404 errors) and gracefully falls back to alternative providers.

## Installation

1. Clone or create the project directory:
```bash
mkdir lmstudio-url-scraper-mcp
cd lmstudio-url-scraper-mcp