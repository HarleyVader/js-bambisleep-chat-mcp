#!/bin/bash
# Script to build and run the MCP server Docker image

# Helper functions
print_header() {
    echo -e "\n============================="
    echo -e " $1"
    echo -e "=============================\n"
}

print_info() {
    echo -e "🔵 $1"
}

print_success() {
    echo -e "✅ $1"
}

print_error() {
    echo -e "❌ $1"
}

# Check for Docker and Docker Compose
check_requirements() {
    print_header "Checking requirements"
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    else
        print_success "Docker is installed."
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    else
        print_success "Docker Compose is installed."
    fi
}

# Build the Docker image
build_image() {
    print_header "Building MCP Server Docker image"
    
    docker build -t bambisleep-mcp-server .
    
    if [ $? -eq 0 ]; then
        print_success "Docker image built successfully."
    else
        print_error "Failed to build Docker image."
        exit 1
    fi
}

# Run using Docker Compose
run_compose() {
    print_header "Starting services with Docker Compose"
    
    docker-compose up -d
    
    if [ $? -eq 0 ]; then
        print_success "Services started successfully."
        print_info "MCP Server is running at http://localhost:3000"
        print_info "Health check endpoint: http://localhost:3000/health"
        print_info "Milvus is running at localhost:19530"
    else
        print_error "Failed to start services."
        exit 1
    fi
}

# Show logs from the container
show_logs() {
    print_header "Showing MCP Server logs"
    
    docker-compose logs -f mcp-server
}

# Stop all services
stop_services() {
    print_header "Stopping services"
    
    docker-compose down
    
    if [ $? -eq 0 ]; then
        print_success "Services stopped successfully."
    else
        print_error "Failed to stop services."
        exit 1
    fi
}

# Main script logic
case "$1" in
    build)
        check_requirements
        build_image
        ;;
    up)
        check_requirements
        run_compose
        ;;
    logs)
        show_logs
        ;;
    down)
        stop_services
        ;;
    all)
        check_requirements
        build_image
        run_compose
        ;;
    *)
        echo "Usage: $0 {build|up|logs|down|all}"
        echo "  build - Build the Docker image"
        echo "  up    - Start all services"
        echo "  logs  - Show logs from the MCP server"
        echo "  down  - Stop all services"
        echo "  all   - Build and start everything"
        ;;
esac
