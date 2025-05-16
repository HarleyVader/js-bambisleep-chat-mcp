# MCP Server for BambiSleep Analyzer
# Multi-stage Docker build for optimized production image

# STAGE 1: Build dependencies
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app

# Copy package files and install all dependencies (including dev)
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Run linting and tests
# RUN npm run lint
# Uncomment if you want to run tests during build
# RUN npm run test

# STAGE 2: Production image
FROM node:20-slim AS runner

# Set working directory
WORKDIR /app

# Create a non-root user for running the app
RUN groupadd -r mcpuser && useradd -r -g mcpuser mcpuser \
    && mkdir -p /app/data/memory \
    && chown -R mcpuser:mcpuser /app

# Copy package files 
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy application code from builder
COPY --from=builder /app/src ./src
COPY --from=builder /app/bambisleep-analyzer ./bambisleep-analyzer

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set permissions for the application
RUN chown -R mcpuser:mcpuser /app

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Switch to non-root user
USER mcpuser

# Create volume for persistent data
VOLUME ["/app/data/memory"]

# Expose the server port
EXPOSE 3000

# Health check using the built-in health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Command to run the application
CMD ["npm", "start"]
