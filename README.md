# BambiSleep Chat MCP

A Model Context Protocol (MCP) server that integrates with LM Studio to analyze websites for BambiSleep hypnosis content and provide a web dashboard for managing discovered sites.

## Features

- 🧠 **LM Studio Integration**: Uses LM Studio's API for intelligent content analysis
- 🔍 **Website Analysis**: Fetches and analyzes web content for BambiSleep relevance
- 📊 **Smart Scoring**: AI-powered relevance scoring with fallback keyword matching
- 💾 **MongoDB Storage**: Stores analyzed sites in MongoDB database
- 🎨 **Beautiful Dashboard**: Modern EJS-based web interface
- 🛠️ **CLI Tools**: Command-line interface for testing and management
- 🔌 **MCP Protocol**: Full MCP server implementation for integration with AI assistants

## Prerequisites

1. **LM Studio**: Download and install from [lmstudio.ai](https://lmstudio.ai)
2. **MongoDB**: Running MongoDB instance (local or remote)
3. **Node.js**: Version 18 or higher

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy and modify the `.env` file:

```bash
SERVER_PORT=6969
LMS_PORT=1234
LMS_HOST=localhost

# MongoDB Configuration  
MONGODB_URI=mongodb://brandynette:CNNvfZi@192.168.0.178:27017/bambisleep?authSource=admin
```

### 3. Start LM Studio

1. Open LM Studio
2. Download a model (recommended: Qwen2.5-7B-Instruct or Llama-3.1-8B-Instruct)
3. Start the server from the "Developer" tab or via CLI:
   ```bash
   npx lmstudio install-cli
   lms server start
   ```

### 4. Test the Setup

```bash
npm run cli test
```

## Usage

### Web Dashboard

Start the web server:

```bash
npm start
```

Visit `http://localhost:6969` to access the dashboard where you can:
- Analyze new URLs
- View stored BambiSleep sites
- See relevance scores and content summaries

### CLI Commands

```bash
# Test connections
npm run cli test

# Analyze a specific URL
npm run cli analyze https://example.com

# List all stored sites
npm run cli list

# Start web server
npm run cli server
```

### MCP Server

Run as an MCP server for integration with AI assistants:

```bash
npm run mcp
```

## LM Studio Tools

The system provides these tools to LM Studio:

1. **fetch_website**: Fetches and extracts content from websites
2. **compare_bambisleep_content**: Analyzes content for BambiSleep relevance using AI
3. **save_bambisleep_site**: Saves relevant sites to the database
4. **get_stored_sites**: Retrieves stored sites from the database

## API Endpoints

- `POST /api/analyze-url`: Analyze a URL for BambiSleep content
- `GET /api/sites`: Get all stored BambiSleep sites
- `GET /`: Dashboard homepage

## Example Analysis Flow

1. User submits a URL through the dashboard
2. System fetches the website content
3. LM Studio analyzes the content for BambiSleep relevance
4. If relevant (score > 50%), the site is automatically saved to the database
5. Results are displayed in the dashboard

## Supported Models

The system works with any LM Studio compatible model, but performs best with:

- **Qwen2.5-7B-Instruct** (Native tool use support)
- **Llama-3.1-8B-Instruct** (Native tool use support)
- **Ministral-8B-Instruct** (Native tool use support)

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Dashboard │    │   CLI Tools     │    │   MCP Server    │
│   (EJS/Express) │    │   (Commander)   │    │   (stdio)       │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────┬───────────┴──────────────────────┘
                     │
          ┌─────────────────┐
          │   Core Engine   │
          │   (Node.js)     │
          └─────────┬───────┘
                    │
     ┌──────────────┼──────────────┐
     │              │              │
┌────▼────┐    ┌────▼────┐    ┌────▼────┐
│LM Studio│    │MongoDB  │    │Web Fetch│
│ (API)   │    │(Storage)│    │(Cheerio)│
└─────────┘    └─────────┘    └─────────┘
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
