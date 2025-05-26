# LMStudio URL Scraper Toolset

This toolset is designed to scrape, analyze, and embed information from websites, with a focus on BambiSleep-related content. The system processes URLs from a predefined list, extracts relevant text and metadata, analyzes the content, and generates vector embeddings for use with large language models (LLMs) in LMStudio.

## Project Structure

```
js-bambisleep-chat-mcp/
├── src/
│   ├── scraper/             # Web scraping functionality
│   │   ├── fetcher.js       # URL content fetching module
│   │   ├── parser.js        # HTML parsing and text extraction
│   │   └── browser.js       # Browser automation helpers
│   ├── analyzer/            # Content analysis
│   │   ├── textProcessor.js # Text cleaning and preprocessing
│   │   ├── metadata.js      # Metadata extraction
│   │   └── filters.js       # Content filtering and relevance scoring
│   ├── embeddings/          # Embedding generation
│   │   ├── generator.js     # Vector embedding creation
│   │   ├── models.js        # Embedding model implementations
│   │   └── optimizer.js     # Embedding optimization utilities
│   ├── storage/             # Data persistence
│   │   ├── vectorStore.js   # Vector database interactions
│   │   ├── fileSystem.js    # Local file storage utilities
│   │   └── export.js        # Export functionality for LMStudio
│   └── utils/               # Shared utilities
│       ├── logger.js        # Logging functionality
│       ├── config.js        # Configuration management
│       └── helpers.js       # General helper functions
├── config/                  # Configuration files
│   ├── default.json         # Default configuration
│   └── scraper.json         # Scraper-specific settings
├── data/                    # Data storage
│   ├── raw/                 # Raw scraped content
│   ├── processed/           # Processed and analyzed content
│   └── embeddings/          # Generated embeddings
├── scripts/                 # Utility scripts
│   ├── setup.js             # Setup script
│   ├── scrape.js            # Standalone scraping script
│   └── embed.js             # Standalone embedding script
├── tests/                   # Test files
├── .github/
│   └── copilot-instructions.md # This file
├── urls.txt                 # URL list for scraping
├── package.json             # Project dependencies
└── README.md                # Project documentation
```

## Technology Stack

- **Runtime**: Node.js
- **Web Scraping**: Playwright (for JavaScript-heavy sites)
- **Content Analysis**: Natural language processing with compromise or nlp.js
- **Embeddings**: OpenAI API or local alternatives like Sentence Transformers
- **Vector Storage**: Local JSON files or vector databases like Qdrant
- **Testing**: Jest

## Implementation Instructions

### 1. URL Scraper Module

The scraper should:
- Read URLs from urls.txt or accept URLs as input
- Handle different website structures adaptively
- Respect robots.txt and implement rate limiting
- Extract main content text, discarding navigation, footers, etc.
- Capture metadata (title, description, keywords)
- Save raw HTML and processed text separately
- Handle errors gracefully with retries

Implementation details:
- Use Playwright for browser automation
- Implement both headless and headed modes
- Extract text using DOM selectors and text density analysis
- Implement content de-duplication

### 2. Content Analyzer Module

The analyzer should:
- Clean and normalize text (remove extra spaces, normalize unicode)
- Identify and extract key concepts and entities
- Generate content summaries of configurable length
- Score content relevance to BambiSleep topics
- Filter out irrelevant content
- Segment content into logical chunks for embedding

Implementation details:
- Use regular expressions and NLP libraries for text processing
- Implement keyword extraction and frequency analysis
- Create a domain-specific relevance scoring algorithm
- Use sentence and paragraph boundaries for chunking

### 3. Embedding Generator Module

The embedding generator should:
- Generate vector embeddings from text chunks
- Support multiple embedding models and dimensions
- Optimize embeddings for semantic search
- Provide utilities to combine or split embeddings
- Include metadata with each embedding
- Export in formats compatible with LMStudio

Implementation details:
- Use OpenAI's embedding API as primary option
- Provide fallback to local models
- Store embeddings with source URLs and timestamps
- Implement caching to avoid regenerating unchanged content

### 4. Storage Module

The storage module should:
- Save raw and processed data in organized directory structure
- Implement a vector database for efficient embedding storage and retrieval
- Provide export functionality in formats compatible with LMStudio
- Include versioning to track changes over time
- Support incremental updates

Implementation details:
- Use JSON for metadata and configuration storage
- Implement efficient binary storage for embeddings
- Create export scripts for different target systems
- Ensure proper error handling and data integrity checks

## Usage Examples

### Basic Scraping Workflow

```javascript
// Example code for scraping a list of URLs
const { scrapeUrls } = require('./src/scraper/fetcher');
const { processContent } = require('./src/analyzer/textProcessor');
const { generateEmbeddings } = require('./src/embeddings/generator');
const { saveToVectorStore } = require('./src/storage/vectorStore');

async function scrapeAndEmbed(urlsFilePath) {
  // Read and scrape URLs
  const scrapedData = await scrapeUrls(urlsFilePath);
  
  // Process and analyze content
  const processedData = await processContent(scrapedData);
  
  // Generate embeddings
  const embeddings = await generateEmbeddings(processedData);
  
  // Save to vector store
  await saveToVectorStore(embeddings);
  
  console.log(`Processed ${embeddings.length} embeddings from ${scrapedData.length} URLs`);
}

scrapeAndEmbed('./urls.txt');
```

### Filtering Relevant Content

```javascript
// Example code for filtering content by relevance
const { filterByRelevance } = require('./src/analyzer/filters');

async function scrapeAndFilterRelevant(urlsFilePath, relevanceThreshold = 0.7) {
  const scrapedData = await scrapeUrls(urlsFilePath);
  
  // Filter for relevant content only
  const relevantContent = await filterByRelevance(scrapedData, relevanceThreshold);
  
  console.log(`Found ${relevantContent.length} relevant items out of ${scrapedData.length} total`);
  
  // Continue with processing...
}
```

### Exporting for LMStudio

```javascript
// Example code for exporting to LMStudio format
const { exportForLMStudio } = require('./src/storage/export');

async function generateLMStudioExport(vectorStorePath, outputPath) {
  await exportForLMStudio(vectorStorePath, outputPath);
  console.log(`Export completed: ${outputPath}`);
}
```

## Development Guidelines

1. **Modularity**: Each component should work independently and have clear interfaces.
2. **Error Handling**: Implement robust error handling throughout the codebase.
3. **Configuration**: Use environment variables and config files for all adjustable parameters.
4. **Logging**: Implement comprehensive logging for debugging and monitoring.
5. **Testing**: Write unit tests for core functionality.
6. **Documentation**: Document all public APIs and provide usage examples.
7. **Performance**: Optimize for memory usage when handling large datasets.
8. **Extensibility**: Design the system to be easily extended with new features.

## Future Enhancements

- Multi-language support
- Image content analysis
- Audio/video content extraction
- Machine learning-based content relevance scoring
- Real-time content monitoring
- Distributed scraping with worker nodes
- Integration with additional vector databases
- Custom embedding model training

## Legal Considerations

- Ensure compliance with websites' terms of service
- Implement appropriate rate limiting to avoid overloading servers
- Respect robots.txt directives
- Do not scrape password-protected or private content without permission
- Consider data privacy regulations when storing scraped content