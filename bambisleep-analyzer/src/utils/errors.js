/**
 * Error handling utilities for MCP protocol
 * Defines standardized error classes and formatting for consistent error responses
 */
import logger from './logger.js';

/**
 * Base MCP Error class
 * @class MCPError
 * @extends Error
 */
export class MCPError extends Error {
  /**
   * Create an MCP Error
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {number} status - HTTP status code equivalent
   * @param {Object} details - Additional error details
   */
  constructor(message, code = 'INTERNAL_ERROR', status = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
    
    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    
    // Log error
    logger.error({
      error: {
        name: this.name,
        code: this.code,
        message: this.message,
        status: this.status,
        details: this.details,
        stack: this.stack
      }
    });
  }

  /**
   * Convert error to MCP protocol format
   * @returns {Object} MCP formatted error object
   */
  toMCPError() {
    return {
      error: {
        type: this.name,
        code: this.code,
        message: this.message,
        details: this.details
      }
    };
  }
}

/**
 * Validation Error class for schema validation failures
 * @class ValidationError
 * @extends MCPError
 */
export class ValidationError extends MCPError {
  /**
   * Create a Validation Error
   * @param {string} message - Error message
   * @param {Object} details - Validation details
   */
  constructor(message, details = {}) {
    super(message, 'VALIDATION_ERROR', 400, details);
  }
}

/**
 * Protocol Error class for MCP protocol violations
 * @class ProtocolError
 * @extends MCPError
 */
export class ProtocolError extends MCPError {
  /**
   * Create a Protocol Error
   * @param {string} message - Error message
   * @param {Object} details - Protocol details
   */
  constructor(message, details = {}) {
    super(message, 'PROTOCOL_ERROR', 400, details);
  }
}

/**
 * Not Found Error class
 * @class NotFoundError
 * @extends MCPError
 */
export class NotFoundError extends MCPError {
  /**
   * Create a Not Found Error
   * @param {string} message - Error message
   * @param {Object} details - Additional details
   */
  constructor(message, details = {}) {
    super(message, 'NOT_FOUND', 404, details);
  }
}

/**
 * Unauthorized Error class
 * @class UnauthorizedError
 * @extends MCPError
 */
export class UnauthorizedError extends MCPError {
  /**
   * Create an Unauthorized Error
   * @param {string} message - Error message
   * @param {Object} details - Additional details
   */
  constructor(message, details = {}) {
    super(message, 'UNAUTHORIZED', 401, details);
  }
}

/**
 * Connection Error class for MCP server connection issues
 * @class ConnectionError
 * @extends MCPError
 */
export class ConnectionError extends MCPError {
  /**
   * Create a Connection Error
   * @param {string} message - Error message
   * @param {string} serverName - MCP server name
   * @param {Object} details - Additional details
   */
  constructor(message, serverName, details = {}) {
    super(
      message, 
      'CONNECTION_ERROR', 
      503, 
      { ...details, server: serverName }
    );
  }
}

/**
 * Timeout Error class for MCP operation timeouts
 * @class TimeoutError
 * @extends MCPError
 */
export class TimeoutError extends MCPError {
  /**
   * Create a Timeout Error
   * @param {string} message - Error message
   * @param {string} operation - Operation that timed out
   * @param {Object} details - Additional details
   */
  constructor(message, operation, details = {}) {
    super(
      message, 
      'TIMEOUT_ERROR', 
      504, 
      { ...details, operation }
    );
  }
}

/**
 * Tool Execution Error class for MCP tool execution failures
 * @class ToolExecutionError
 * @extends MCPError
 */
export class ToolExecutionError extends MCPError {
  /**
   * Create a Tool Execution Error
   * @param {string} message - Error message
   * @param {string} toolName - Name of the tool that failed
   * @param {Object} details - Additional details
   */
  constructor(message, toolName, details = {}) {
    super(
      message, 
      'TOOL_EXECUTION_ERROR', 
      500, 
      { ...details, tool: toolName }
    );
  }
}

/**
 * Format a standard error response following MCP protocol
 * @param {Error} error - Error object
 * @returns {Object} Formatted error response
 */
export function formatErrorResponse(error) {
  if (error instanceof MCPError) {
    return error.toMCPError();
  }
  
  // Handle unknown errors
  const mcpError = new MCPError(
    error.message || 'An unknown error occurred',
    'INTERNAL_ERROR',
    500,
    { originalError: error.toString() }
  );
  
  return mcpError.toMCPError();
}

/**
 * Global error handler for uncaught exceptions
 * @param {Error} error - Uncaught error
 */
export function globalErrorHandler(error) {
  logger.fatal({
    message: 'Uncaught exception',
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    }
  });
  
  // Give logger time to flush
  setTimeout(() => {
    process.exit(1);
  }, 1000);
}

// Set up global error handlers
process.on('uncaughtException', globalErrorHandler);
process.on('unhandledRejection', (reason) => {
  globalErrorHandler(reason instanceof Error ? reason : new Error(String(reason)));
});
