# Docker Setup Guide for MCP Server

This guide explains how to set up, configure, and deploy the BambiSleep Analyzer MCP Server using Docker.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Configuration](#configuration)
4. [Building the Image](#building-the-image)
5. [Running with Docker Compose](#running-with-docker-compose)
6. [Production Deployment](#production-deployment)
7. [Monitoring and Maintenance](#monitoring-and-maintenance)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Ensure you have the following installed:

- Docker: [Install Docker](https://docs.docker.com/get-docker/)
- Docker Compose: [Install Docker Compose](https://docs.docker.com/compose/install/)
- Git (for cloning the repository)

## Initial Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/js-bambisleep-chat-mcp.git
   cd js-bambisleep-chat-mcp
   ```

2. Create an environment file:
   ```bash
   cp .env.example .env
   ```

3. Edit the `.env` file with your preferred settings.

## Configuration

### Environment Variables

The following environment variables can be configured:

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Node.js environment | production |
| PORT | Server port | 3000 |
| LOG_LEVEL | Logging level | info |
| MILVUS_URI | Milvus server URI | http://milvus:19530 |
| MILVUS_COLLECTION | Milvus collection name | bambisleep_data |
| MEMORY_PERSISTENT | Enable persistent memory | true |
| MEMORY_STORAGE_PATH | Path for memory storage | /app/data/memory |
| DUCKDUCKGO_TIMEOUT | DuckDuckGo request timeout | 10000 |
| FETCH_TIMEOUT | Web fetch timeout | 15000 |

### Docker Compose Configuration

The `docker-compose.yml` file includes:

- **MCP Server**: The main application
- **Milvus**: Vector database for similarity search
- **Etcd**: Key-value store used by Milvus
- **MinIO**: Object storage used by Milvus

You can modify the Docker Compose file to customize:
- Port mappings
- Volume mounts
- Resource limits
- Network settings

## Building the Image

### Using the Helper Scripts

#### Windows (PowerShell):
```powershell
.\build-docker.ps1 build
```

#### Linux/macOS:
```bash
chmod +x build-docker.sh
./build-docker.sh build
```

### Manual Build

```bash
docker build -t bambisleep-mcp-server .
```

## Running with Docker Compose

### Using Helper Scripts

#### Windows (PowerShell):
```powershell
.\build-docker.ps1 up
```

#### Linux/macOS:
```bash
./build-docker.sh up
```

### Manual Run

```bash
docker-compose up -d
```

### Checking the Service

- MCP Server: http://localhost:3000/health
- Milvus: http://localhost:19530
- MinIO Console: http://localhost:9001 (username: minioadmin, password: minioadmin)

## Production Deployment

For production deployment, consider the following:

### Security Enhancements

1. Set up a reverse proxy (Nginx, Traefik) for TLS termination
2. Configure authentication for the API
3. Secure Milvus with authentication
4. Use Docker secrets for sensitive information
5. Apply network security policies

### High Availability

1. Use Docker Swarm or Kubernetes for orchestration
2. Implement health checks and automatic restarts
3. Set up container monitoring
4. Configure backups for all data volumes

### Sample Docker Swarm Deployment

```bash
# Initialize Docker Swarm
docker swarm init

# Deploy the stack
docker stack deploy -c docker-compose.yml mcp-stack
```

## Monitoring and Maintenance

### Viewing Logs

#### Using Helper Scripts

```powershell
.\build-docker.ps1 logs
```

#### Manual Log View

```bash
docker-compose logs -f mcp-server
```

### Container Management

```bash
# List running containers
docker-compose ps

# Restart a service
docker-compose restart mcp-server

# Stop all services
docker-compose down
```

### Data Backup

```bash
# Backup volume data
docker run --rm -v mcp-data:/source -v $(pwd)/backups:/backup alpine tar -czf /backup/mcp-data-$(date +%Y%m%d).tar.gz -C /source .
```

## Troubleshooting

### Common Issues

1. **Service fails to start**
   - Check logs: `docker-compose logs mcp-server`
   - Verify environment variables
   - Check disk space

2. **Connection issues between services**
   - Check network configuration
   - Verify service hostnames match Docker Compose service names
   - Check if all services are running: `docker-compose ps`

3. **Performance issues**
   - Monitor container resources: `docker stats`
   - Adjust container resource limits
   - Check host machine resources

### Debugging

For interactive debugging:

```bash
# Run a shell in the container
docker-compose exec mcp-server /bin/sh

# Check network connectivity
docker-compose exec mcp-server ping milvus
```

---

For more information, refer to the [MCP Server Documentation](README.md).
