/**
 * Response model for MCP protocol
 * Represents the standardized structure for outgoing responses
 */
import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../utils/errors.js';
import validator from '../utils/validation.js';

/**
 * MCP Response class
 * @class Response
 */
export class Response {
  /**
   * Create a success response
   * @param {string} sessionId - Session identifier
   * @param {Object} result - Response result data
   * @returns {Response} Response instance
   */
  static success(sessionId, result = {}) {
    return new Response({
      sessionId,
      result
    });
  }

  /**
   * Create an error response
   * @param {string} sessionId - Session identifier
   * @param {Object|Error} error - Error details or Error object
   * @returns {Response} Response instance
   */
  static error(sessionId, error) {
    // Map common error types to standardized MCP error types
    let errorType = 'Error';
    let errorCode = 'UNKNOWN_ERROR';
    let errorMessage = 'An unknown error occurred';
    let errorDetails = {};
    
    // Handle Error objects
    if (error instanceof Error) {
      errorType = error.name || 'Error';
      errorMessage = error.message || errorMessage;
      errorCode = error.code || this._mapErrorTypeToCode(errorType);
      errorDetails = error.details || {};
      
      // Include stack trace in details during development
      if (process.env.NODE_ENV === 'development') {
        errorDetails.stack = error.stack;
      }
    } 
    // Handle error info objects
    else if (typeof error === 'object' && error !== null) {
      errorType = error.type || errorType;
      errorCode = error.code || this._mapErrorTypeToCode(errorType);
      errorMessage = error.message || errorMessage;
      errorDetails = error.details || {};
    }
    
    return new Response({
      sessionId,
      error: {
        type: errorType,
        code: errorCode,
        message: errorMessage,
        details: errorDetails
      }
    });
  }

  /**
   * Map error type to a standardized error code
   * @param {string} errorType - Error type/name
   * @returns {string} Standardized error code
   * @private
   */
  static _mapErrorTypeToCode(errorType) {
    // Map common error types to standard MCP error codes
    const errorCodeMap = {
      'ValidationError': 'VALIDATION_ERROR',
      'NotFoundError': 'NOT_FOUND',
      'ConnectionError': 'CONNECTION_ERROR',
      'TimeoutError': 'TIMEOUT',
      'ProtocolError': 'PROTOCOL_ERROR',
      'ToolExecutionError': 'EXECUTION_ERROR',
      'TypeError': 'INVALID_TYPE',
      'RangeError': 'OUT_OF_RANGE',
      'SyntaxError': 'SYNTAX_ERROR',
      'ReferenceError': 'REFERENCE_ERROR'
    };
    
    return errorCodeMap[errorType] || 'UNKNOWN_ERROR';
  }

  /**
   * Create a new Response instance
   * @param {Object} data - Response data
   * @param {string} data.sessionId - Session identifier
   * @param {Object} [data.result] - Response result data
   * @param {Object} [data.error] - Error details
   */
  constructor(data) {
    if (!data || !data.sessionId) {
      throw new Error('Response requires sessionId');
    }
    
    // Validate that exactly one of result or error is provided
    if (!data.result && !data.error) {
      throw new Error('Response must include either result or error');
    }
    
    if (data.result && data.error) {
      throw new Error('Response cannot include both result and error');
    }
    
    this.sessionId = data.sessionId;
    this.id = data.id || uuidv4();
    this.timestamp = data.timestamp || new Date().toISOString();
    
    if (data.result !== undefined) {
      this.result = data.result;
    }
    
    if (data.error !== undefined) {
      this.error = data.error;
    }
  }

  /**
   * Check if response is successful
   * @returns {boolean} True if this is a success response
   */
  isSuccess() {
    return 'result' in this;
  }

  /**
   * Check if response is an error
   * @returns {boolean} True if this is an error response
   */
  isError() {
    return 'error' in this;
  }

  /**
   * Convert to plain object
   * @returns {Object} Plain object representation
   */
  toObject() {
    const obj = {
      id: this.id,
      sessionId: this.sessionId,
      timestamp: this.timestamp
    };
    
    if (this.result !== undefined) {
      obj.result = this.result;
    }
    
    if (this.error !== undefined) {
      obj.error = this.error;
    }
    
    return obj;
  }

  /**
   * Create a Response from plain object
   * @param {Object} obj - Plain object representation
   * @returns {Response} New Response instance
   */
  static fromObject(obj) {
    return new Response(obj);
  }
}

export default Response;
