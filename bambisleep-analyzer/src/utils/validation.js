/**
 * Schema validation utility using Ajv JSON Schema validator
 * Provides reusable validation functions for MCP messages
 */
import Ajv from 'ajv';
import logger from './logger.js';
import { ValidationError } from './errors.js';
import config from './config.js';

// Get validation configuration
const validationConfig = config.get('validation', {
  addFormats: true
});

/**
 * Schema Validator class
 * @class SchemaValidator
 */
class SchemaValidator {
  constructor() {
    // Initialize Ajv with configuration options
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strictTypes: false,
      strictTuples: false
    });
    
    // Add formats if needed
    if (validationConfig.addFormats) {
      // Add common formats for validation
      this.ajv.addFormat('uri', this.validateUri);
      this.ajv.addFormat('date-time', this.validateDateTime);
    }
    
    // Cache for compiled validators
    this.validators = new Map();
    
    // Pre-compile common schemas
    this.registerCommonSchemas();
  }

  /**
   * Register common MCP schemas
   * @private
   */
  registerCommonSchemas() {
    // MCP Command schema
    this.registerSchema('mcpCommand', {
      type: 'object',
      required: ['command', 'sessionId'],
      properties: {
        command: { type: 'string' },
        sessionId: { type: 'string' },
        parameters: {
          type: 'object',
          additionalProperties: true
        }
      },
      additionalProperties: false
    });
    
    // MCP Response schema
    this.registerSchema('mcpResponse', {
      type: 'object',
      oneOf: [
        {
          required: ['result'],
          properties: {
            result: { type: 'object', additionalProperties: true },
            sessionId: { type: 'string' }
          },
          additionalProperties: false
        },
        {
          required: ['error'],
          properties: {
            error: {
              type: 'object',
              required: ['type', 'message'],
              properties: {
                type: { type: 'string' },
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object', additionalProperties: true }
              },
              additionalProperties: false
            },
            sessionId: { type: 'string' }
          },
          additionalProperties: false
        }
      ]
    });
  }

  /**
   * Register a schema for later use
   * @param {string} name - Schema name
   * @param {Object} schema - JSON Schema definition
   */
  registerSchema(name, schema) {
    try {
      // Compile and cache the schema validator
      const validate = this.ajv.compile(schema);
      this.validators.set(name, validate);
      
      logger.debug(`Registered schema: ${name}`);
    } catch (error) {
      logger.error({
        message: `Failed to register schema: ${name}`,
        error
      });
      throw new ValidationError(`Failed to register schema: ${name}`, {
        schemaName: name,
        error: error.message
      });
    }
  }

  /**
   * Validate data against a named schema
   * @param {string} schemaName - Name of the registered schema
   * @param {Object} data - Data to validate
   * @returns {Object} Validated data
   * @throws {ValidationError} If validation fails
   */
  validate(schemaName, data) {
    const validate = this.validators.get(schemaName);
    
    if (!validate) {
      throw new ValidationError(`Schema not found: ${schemaName}`);
    }
    
    const valid = validate(data);
    
    if (!valid) {
      const errors = this.formatValidationErrors(validate.errors);
      
      logger.debug({
        message: `Validation failed for schema: ${schemaName}`,
        errors,
        data
      });
      
      throw new ValidationError(`Validation failed for schema: ${schemaName}`, {
        schemaName,
        errors
      });
    }
    
    return data;
  }

  /**
   * Format validation errors for better readability
   * @param {Array} errors - AJV validation errors
   * @returns {Array} Formatted errors
   * @private
   */
  formatValidationErrors(errors) {
    if (!errors) return [];
    
    return errors.map(error => {
      const { instancePath, message, keyword, params } = error;
      const path = instancePath || 'root';
      
      return {
        path,
        message: `${path} ${message}`,
        keyword,
        params
      };
    });
  }

  /**
   * Validate URI format
   * @param {string} uri - URI to validate
   * @returns {boolean} True if valid
   * @private
   */
  validateUri(uri) {
    try {
      new URL(uri);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Validate date-time format
   * @param {string} dateTime - Date-time string to validate
   * @returns {boolean} True if valid
   * @private
   */
  validateDateTime(dateTime) {
    const timestamp = Date.parse(dateTime);
    return !isNaN(timestamp);
  }
}

// Export a singleton instance
export default new SchemaValidator();
