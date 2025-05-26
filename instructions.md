I'll update the instructions document with the latest information from the MCP TypeScript SDK repository.

```markdown
# Model Context Protocol (MCP) Integration Guide

## Overview

The Model Context Protocol (MCP) is a standardized way for AI applications to connect with external data sources and tools. This guide provides instructions for implementing an MCP client and/or server in our project.

## What is MCP?

MCP allows AI models like Claude to:
- Access data from your local files, databases, or content repositories
- Utilize tools like GitHub, Google Maps, or web browsers
- Perform tasks that would otherwise be outside the model's capabilities

Think of MCP as a universal adapter for AI applications, similar to what USB-C is for physical devices.

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) lets you build servers that expose data and functionality to LLM applications in a secure, standardized way. Think of it like a web API, but specifically designed for LLM interactions.

## Architecture

MCP follows a client-server architecture:
- **Hosts**: LLM applications (like Claude Desktop) that initiate connections
- **Clients**: Maintain 1:1 connections with servers, inside the host application
- **Servers**: Provide context, tools, and prompts to clients

## Key Components

### 1. Resources
- File-like data that can be read by clients
- Examples: API responses, file contents, database records
- Identified by unique URIs
- Can be discovered through resource listings or URI templates
- Similar to GET endpoints in a REST API - they provide data but shouldn't perform significant computation or have side effects

### 2. Tools
- Functions that can be called by the LLM (with user approval)
- Enable AI models to perform calculations, access external APIs, etc.
- Defined with schemas that specify input parameters and expected outputs
- Can return text, images, audio, or resource references
- Unlike resources, tools are expected to perform computation and have side effects

### 3. Prompts
- Pre-written templates to help users accomplish specific tasks
- User-controlled and explicitly selected
- Can include dynamic arguments for customization
- Support multi-modal content (text, images, audio)
- Reusable templates that help LLMs interact with your server effectively

## Implementation Considerations

### For Client Implementation
1. **Transport Support**: Implement stdio (standard) or Streamable HTTP (replaces the deprecated HTTP+SSE)
2. **Capability Negotiation**: Handle protocol version and feature negotiation
3. **Human in the Loop**: Always provide user interface to review and approve tool execution
4. **Security**: Validate all inputs, sanitize data, implement proper auth if needed

### For Server Implementation
1. **Feature Exposure**: Decide which capabilities to expose (resources, tools, prompts)
2. **Error Handling**: Implement robust error management
3. **Security**: Validate inputs, implement proper access controls, protect sensitive data
4. **Documentation**: Clearly document all tools, resources, and prompts

## Security Best Practices
1. **User Consent**: Always obtain explicit user consent for data access and operations
2. **Data Privacy**: Protect user data with appropriate access controls
3. **Tool Safety**: Treat tools as arbitrary code execution with appropriate caution
4. **Validation**: Validate all inputs thoroughly to prevent injection attacks

## Getting Started

### Installation
```
npm install @modelcontextprotocol/sdk
```

### Setting Up a Client
1. Initialize the client with appropriate capabilities
2. Implement transport layer (stdio or Streamable HTTP)
3. Handle capability negotiation during initialization
4. Implement resource discovery and reading
5. Add tool discovery and execution with user approval

```javascript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["server.js"]
});

const client = new Client({
  name: "example-client",
  version: "1.0.0"
});

await client.connect(transport);

// List prompts
const prompts = await client.listPrompts();

// Get a prompt
const prompt = await client.getPrompt({
  name: "example-prompt",
  arguments: {
    arg1: "value"
  }
});

// List resources
const resources = await client.listResources();

// Read a resource
const resource = await client.readResource({
  uri: "file:///example.txt"
});

// Call a tool
const result = await client.callTool({
  name: "example-tool",
  arguments: {
    arg1: "value"
  }
});
```

### Setting Up a Server
1. Define server capabilities (resources, tools, prompts)
2. Implement handlers for resource requests
3. Create tool definitions and implementations
4. Add prompt templates and handlers
5. Test with the MCP Inspector tool

```javascript
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create an MCP server
const server = new McpServer({
  name: "Demo",
  version: "1.0.0"
});

// Add an addition tool
server.tool("add",
  { a: z.number(), b: z.number() },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

// Add a dynamic greeting resource
server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => ({
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}!`
    }]
  })
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Transport Options

### stdio
For command-line tools and direct integrations:

```javascript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "example-server",
  version: "1.0.0"
});

// ... set up server resources, tools, and prompts ...

const transport = new StdioServerTransport();
await server.connect(transport);
```

### Streamable HTTP
For remote servers, set up a Streamable HTTP transport that handles both client requests and server-to-client notifications.

## Testing
1. Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to test your server implementation
2. Verify all resources are properly exposed
3. Test tool execution with various inputs
4. Ensure prompt templates render correctly

## Dynamic Servers
You can offer an initial set of tools/prompts/resources, and later add additional ones based on user action or external state changes:

```javascript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "Dynamic Example",
  version: "1.0.0"
});

const listMessageTool = server.tool(
  "listMessages",
  { channel: z.string() },
  async ({ channel }) => ({
    content: [{ type: "text", text: await listMessages(channel) }]
  })
);

const putMessageTool = server.tool(
  "putMessage",
  { channel: z.string(), message: z.string() },
  async ({ channel, message }) => ({
    content: [{ type: "text", text: await putMessage(channel, message) }]
  })
);

// Disable a tool initially
putMessageTool.disable();

// Later enable it when needed
putMessageTool.enable();

// Connect as normal
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Resources
- [MCP Documentation](https://modelcontextprotocol.io/)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Python SDK](https://github.com/modelcontextprotocol/python-sdk)
- [Example Servers](https://github.com/modelcontextprotocol/servers)
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [MCP Specification](https://spec.modelcontextprotocol.io/)

## Best Practices
1. Start with simple implementations and iterate
2. Follow protocol specifications carefully
3. Implement robust error handling
4. Document your implementation thoroughly
5. Consider security at every step
6. Use Zod for parameter validation with tools and prompts
7. Handle errors gracefully with appropriate error responses
8. Test with both stdio and Streamable HTTP transports if applicable
9. Implement backwards compatibility if needed for older clients
