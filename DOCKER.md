# BambiSleep Analyzer MCP Server - Docker Guide

This document provides instructions for building and running the BambiSleep Analyzer MCP Server using Docker.

## Prerequisites

- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

## Quick Start

### Windows (PowerShell)

```powershell
# Build the image and start all services
.\build-docker.ps1 all

# View logs
.\build-docker.ps1 logs

# Stop all services
.\build-docker.ps1 down
```

### Linux/macOS (Bash)

```bash
# Make the script executable
chmod +x build-docker.sh

# Build the image and start all services
./build-docker.sh all

# View logs
./build-docker.sh logs

# Stop all services
./build-docker.sh down
```

## Manual Build and Run

If you prefer to build and run the Docker containers manually:

```bash
# Build the Docker image
docker build -t bambisleep-mcp-server .

# Start all services with Docker Compose
docker-compose up -d

# View logs from the MCP server
docker-compose logs -f mcp-server

# Stop all services
docker-compose down
```

## Docker Compose Services

The Docker Compose configuration includes the following services:

- **mcp-server**: The BambiSleep Analyzer MCP server
- **milvus**: Vector database for similarity search
- **etcd**: Key-value store used by Milvus
- **minio**: Object storage used by Milvus

## Ports

- **MCP Server**: 3000
- **Milvus**: 19530 (API), 9091 (metrics)
- **MinIO**: 9000 (API), 9001 (console)

## Data Persistence

The following Docker volumes are created for data persistence:

- **mcp-data**: MCP server's memory storage
- **milvus-data**: Milvus database files
- **etcd-data**: Etcd database files
- **minio-data**: MinIO object storage

## Environment Variables

You can customize the following environment variables in the `docker-compose.yml` file:

- **NODE_ENV**: Node.js environment (development, production)
- **PORT**: Port for the MCP server

## Health Check

The MCP server includes a health check endpoint at:

```
http://localhost:3000/health
```

This endpoint returns the status of the MCP server and its adapters.

## Building for Production

For production environments, make sure to:

1. Use specific versions for Docker images
2. Set proper environment variables
3. Implement proper security measures (TLS, authentication)
4. Configure proper logging and monitoring
5. Set up a reverse proxy (like Nginx) for TLS termination

## Troubleshooting

If you encounter issues:

1. Check the logs: `docker-compose logs mcp-server`
2. Verify service health: `docker-compose ps`
3. Check that all dependencies are running correctly
4. Ensure Docker has enough resources allocated (CPU, memory)

## Security Considerations

- The default configuration is not secured for production use
- For production, secure the Milvus instance with authentication
- Add proper API authentication for the MCP server
- Encrypt sensitive data
- Use a non-root user in the container (already configured in the Dockerfile)
