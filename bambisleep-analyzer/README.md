# Model Context Protocol (MCP) Implementation

This directory contains the implementation of the Model Context Protocol (MCP) for the BambiSleep Website Analyzer. The implementation follows the MCP specification for enabling AI models to interact with external tools in a standardized way.

## Core Components

### Protocol Layer

The protocol layer handles parsing, validating, and processing MCP messages.

- `protocol.js` - Core protocol implementation
- `router.js` - Command routing logic
- `session.js` - Session state management

### Models

Data models representing MCP objects:

- `command.js` - Command model
- `response.js` - Response model

### Adapters

Adapters for connecting to external MCP servers:

- `base-adapter.js` - Base adapter class with common functionality
- `duckduckgo.js` - DuckDuckGo search adapter
- `fetch.js` - Web page content fetching adapter
- `memory.js` - Persistent memory adapter
- `milvus.js` - Milvus vector database adapter

### Utilities

Helper utilities for the MCP implementation:

- `config.js` - Configuration management
- `errors.js` - Error types and handling
- `logger.js` - Structured logging
- `timeout-manager.js` - Request timeout management
- `validation.js` - Schema validation

## Architecture

The implementation follows a layered architecture:

1. **Core Protocol Layer** - Handles the core MCP logic
2. **Interface/Adapter Layer** - Connects to external MCP tools
3. **Utility Layer** - Provides support functionality

## Usage

To use the MCP implementation:

1. Register command handlers with the router
2. Process incoming commands through the protocol
3. Return responses according to the MCP specification

Example:

```javascript
import router from './core/router.js';
import protocol from './core/protocol.js';

// Register a command handler
router.registerCommand('analyze', async (command, session) => {
  // Command implementation
  const result = await someAnalysisFunction(command.parameters);
  
  // Return result and optional session state updates
  return {
    analysis: result,
    sessionState: {
      lastAnalysis: new Date().toISOString()
    }
  };
}, {
  description: 'Analyze website content',
  schema: {
    type: 'object',
    properties: {
      url: { type: 'string' }
    },
    required: ['url']
  }
});

// Process a command
const command = protocol.parseCommand({
  command: 'analyze',
  sessionId: 'some-session-id',
  parameters: {
    url: 'https://example.com'
  }
});

const response = await router.handleCommand(command);
```

## Error Handling

The implementation provides comprehensive error handling with standardized error responses:

- ValidationError - When command validation fails
- NotFoundError - When a resource (command, session, etc.) is not found
- ConnectionError - When connection to an external MCP server fails
- TimeoutError - When a command execution times out
- ToolExecutionError - When an external tool execution fails

## Testing

Tests are available in the `tests` directory:

- Unit tests - Test individual components
- Integration tests - Test component interactions
- Contract tests - Test compliance with the MCP specification

Run tests with:

```
npm test
```

## Schema Validation

All MCP messages are validated against JSON schemas to ensure protocol compliance:

- Command schema - Validates incoming commands
- Response schema - Validates outgoing responses
- Error schema - Validates error responses

## Session Management

Sessions provide persistent state across multiple command invocations:

- Sessions are created automatically if not found
- Session state is isolated between sessions
- Expired sessions are cleaned up automatically

## Best Practices

1. Always validate commands against schemas
2. Use immutable session state
3. Handle errors gracefully
4. Implement proper timeout handling
5. Use structured logging
6. Follow the MCP specification strictly

## References

- [MCP Specification](https://github.com/microsoft/model-context-protocol)
- [AI Protocol Interoperability](https://github.com/microsoft/AI-System-for-Tool-Use)
