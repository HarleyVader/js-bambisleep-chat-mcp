# PowerShell script to build and run the MCP server Docker image

# Helper functions
function Print-Header {
    param([string]$Text)
    
    Write-Host "`n=============================" -ForegroundColor Cyan
    Write-Host " $Text" -ForegroundColor Cyan
    Write-Host "=============================`n" -ForegroundColor Cyan
}

function Print-Info {
    param([string]$Text)
    
    Write-Host "🔵 $Text" -ForegroundColor Blue
}

function Print-Success {
    param([string]$Text)
    
    Write-Host "✅ $Text" -ForegroundColor Green
}

function Print-Error {
    param([string]$Text)
    
    Write-Host "❌ $Text" -ForegroundColor Red
}

# Check for Docker and Docker Compose
function Check-Requirements {
    Print-Header "Checking requirements"
    
    try {
        $dockerVersion = docker --version
        Print-Success "Docker is installed: $dockerVersion"
    }
    catch {
        Print-Error "Docker is not installed. Please install Docker Desktop for Windows first."
        exit 1
    }
    
    try {
        $composeVersion = docker-compose --version
        Print-Success "Docker Compose is installed: $composeVersion"
    }
    catch {
        Print-Error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    }
}

# Build the Docker image
function Build-Image {
    Print-Header "Building MCP Server Docker image"
    
    docker build -t bambisleep-mcp-server .
    
    if ($LASTEXITCODE -eq 0) {
        Print-Success "Docker image built successfully."
    }
    else {
        Print-Error "Failed to build Docker image."
        exit 1
    }
}

# Run using Docker Compose
function Start-Compose {
    Print-Header "Starting services with Docker Compose"
    
    docker-compose up -d
    
    if ($LASTEXITCODE -eq 0) {
        Print-Success "Services started successfully."
        Print-Info "MCP Server is running at http://localhost:3000"
        Print-Info "Health check endpoint: http://localhost:3000/health"
        Print-Info "Milvus is running at localhost:19530"
    }
    else {
        Print-Error "Failed to start services."
        exit 1
    }
}

# Show logs from the container
function Show-Logs {
    Print-Header "Showing MCP Server logs"
    
    docker-compose logs -f mcp-server
}

# Stop all services
function Stop-Services {
    Print-Header "Stopping services"
    
    docker-compose down
    
    if ($LASTEXITCODE -eq 0) {
        Print-Success "Services stopped successfully."
    }
    else {
        Print-Error "Failed to stop services."
        exit 1
    }
}

# Main script logic
param(
    [Parameter(Position=0)]
    [ValidateSet("build", "up", "logs", "down", "all")]
    [string]$Command = ""
)

switch ($Command) {
    "build" {
        Check-Requirements
        Build-Image
    }
    "up" {
        Check-Requirements
        Start-Compose
    }
    "logs" {
        Show-Logs
    }
    "down" {
        Stop-Services
    }
    "all" {
        Check-Requirements
        Build-Image
        Start-Compose
    }
    default {
        Write-Host "Usage: .\build-docker.ps1 [build|up|logs|down|all]" -ForegroundColor Yellow
        Write-Host "  build - Build the Docker image"
        Write-Host "  up    - Start all services"
        Write-Host "  logs  - Show logs from the MCP server"
        Write-Host "  down  - Stop all services"
        Write-Host "  all   - Build and start everything"
    }
}
