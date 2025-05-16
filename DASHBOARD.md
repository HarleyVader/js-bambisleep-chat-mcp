# BambiSleep MCP Dashboard

This project provides a dashboard for interacting with Model Context Protocol (MCP) tools for BambiSleep content analysis.

## Features

- Dashboard to view all available MCP commands
- Status monitoring for all MCP adapters
- Interactive command execution interface
- Session management and history

## Getting Started

### Prerequisites

- Node.js v16 or higher
- NPM or Yarn package manager

### Installation

1. Clone the repository
```
git clone https://github.com/HarleyVader/js-bambisleep-chat-mcp.git
cd js-bambisleep-chat-mcp
```

2. Install dependencies
```
npm install
```

3. Configure environment variables
```
cp .env.example .env
```
Edit the `.env` file with your configuration settings.

4. Start the application
```
npm start
```

For development with hot-reloading:
```
npm run dev
```

### Docker Installation

To run with Docker:

```
docker-compose up -d
```

See `DOCKER.md` for more information.

## Dashboard Usage

### Main Dashboard

The main dashboard at `http://localhost:3000/` shows:
- Overview of available MCP commands
- Status of all adapters
- Active sessions

### Using Commands

1. Click on a command in the dashboard to open its execution page
2. Fill in the required parameters
3. Click "Execute Command" to run
4. View the results in the Command Response section

### Checking Adapter Health

Click the "Health Check" button next to an adapter to check its current status.

## Available MCP Commands

The dashboard provides access to the following command toolsets:

### Analyzer Commands

- `analyzer.search` - Search for BambiSleep content
- `analyzer.fetchContent` - Fetch and analyze content from a URL
- `analyzer.storeVectors` - Store vector embeddings for content
- `analyzer.similarContent` - Search for similar content

### System Commands

- `system.info` - Get system information including available commands and adapters

## MCP Adapters

The system uses the following adapters:

- **DuckDuckGo** - Web search functionality
- **Fetch** - Content retrieval from URLs
- **Memory** - In-memory storage for session data
- **Milvus** - Vector database for semantic search

## Development

### Project Structure

- `/src` - Main source code
  - `/commands` - MCP command implementations
  - `/routes` - Express routes for the dashboard
- `/public` - Static assets (CSS, JavaScript)
- `/views` - EJS templates for the dashboard UI
- `/bambisleep-analyzer` - Core MCP implementation
  - `/src/adapters` - MCP adapter implementations
  - `/src/core` - Core MCP protocol implementation
  - `/src/models` - Data models for MCP

### Testing

```
npm test          # Run all tests
npm run test:unit # Run unit tests only
npm run test:integration # Run integration tests only
npm run test:contract # Run contract tests only
```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the Apache 2.0 License - see the LICENSE file for details.
