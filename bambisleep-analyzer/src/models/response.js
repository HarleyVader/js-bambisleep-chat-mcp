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
   * @param {Object} error - Error details
   * @param {string} error.type - Error type
   * @param {string} error.message - Error message
   * @param {string} [error.code] - Error code
   * @param {Object} [error.details] - Additional error details
   * @returns {Response} Response instance
   */
  static error(sessionId, error) {
    return new Response({
      sessionId,
      error: {
        type: error.type || 'Error',
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'An unknown error occurred',
        details: error.details || {}
      }
    });
  }

  /**
   * Create a new Response instance
   * @param {Object} data - Response data
   */
  constructor(data) {
    if (!data) {
      throw new ValidationError('Response data is required');
    }
    
    // Validate response structure
    const validatedData = validator.validate('mcpResponse', data);
    
    this.sessionId = validatedData.sessionId;
    
    if ('result' in validatedData) {
      this.result = validatedData.result;
    } else if ('error' in validatedData) {
      this.error = validatedData.error;
    } else {
      throw new ValidationError('Response must contain either result or error');
    }
    
    this.id = validatedData.id || uuidv4();
    this.timestamp = validatedData.timestamp || new Date().toISOString();
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
    
    if (this.isSuccess()) {
      obj.result = this.result;
    } else {
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
