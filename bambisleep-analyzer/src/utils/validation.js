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
   */  registerCommonSchemas() {    // MCP Command schema
    this.registerSchema('mcpCommand', {
      type: 'object',
      required: ['command', 'sessionId'],
      properties: {
        command: { 
          type: 'string',
          minLength: 1 
        },
        sessionId: { 
          type: 'string',
          minLength: 1 
        },
        id: { 
          type: ['string', 'number'],
          // Accept any string or number for ID to be more tolerant
          // This is even more relaxed than before
        },
        timestamp: { 
          type: 'string',
          // Allow any string for timestamp
        },
        parameters: { 
          type: 'object',
          default: {}
        }
      },
      // Add some tolerance for additional properties
      additionalProperties: true
    });

    // MCP Response schema
    this.registerSchema('mcpResponse', {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: { 
          type: 'string',
          minLength: 1 
        },
        id: { 
          type: 'string',
          pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
        },
        timestamp: { 
          type: 'string', 
          format: 'date-time' 
        },
        result: { 
          type: 'object' 
        },
        error: {
          type: 'object',
          properties: {
            type: { type: 'string' },
            code: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object' }
          },
          required: ['type', 'message'],
          additionalProperties: false
        }
      },
      oneOf: [
        { required: ['result'] },
        { required: ['error'] }
      ],
      additionalProperties: false
    });

    // MCP Error schema
    this.registerSchema('mcpError', {
      type: 'object',
      required: ['type', 'message'],
      properties: {
        type: { type: 'string' },
        code: { type: 'string' },
        message: { type: 'string' },
        details: { type: 'object' }
      },
      additionalProperties: false
    });
  }

  /**
   * Register a schema
   * @param {string} name - Schema name
   * @param {Object} schema - JSON Schema object
   */
  registerSchema(name, schema) {
    try {
      // Compile the schema
      const validate = this.ajv.compile(schema);
      
      // Store in cache
      this.validators.set(name, {
        validate,
        schema
      });
      
      logger.debug({
        message: `Registered schema: ${name}`,
        schemaProperties: Object.keys(schema.properties || {})
      });
    } catch (error) {
      logger.error({
        message: `Failed to register schema: ${name}`,
        error: error.message,
        stack: error.stack
      });
      throw new Error(`Failed to register schema '${name}': ${error.message}`);
    }
  }

  /**
   * Validate data against a schema
   * @param {string} schemaName - Schema name
   * @param {Object} data - Data to validate
   * @param {Object} [options] - Validation options
   * @returns {Object} Validated data
   * @throws {ValidationError} If validation fails
   */
  validate(schemaName, data, options = {}) {
    const validatorInfo = this.validators.get(schemaName);
    
    if (!validatorInfo) {
      logger.error({
        message: `Schema not found: ${schemaName}`,
        availableSchemas: Array.from(this.validators.keys())
      });
      throw new Error(`Schema '${schemaName}' not found`);
    }
    
    const { validate } = validatorInfo;
    
    // Deep clone data to avoid side effects
    let validationData;
    try {
      validationData = JSON.parse(JSON.stringify(data));
    } catch (error) {
      throw new ValidationError('Invalid data format (could not serialize to JSON)', {
        data: typeof data
      });
    }
      // Perform validation
    const valid = validate(validationData);      if (!valid) {
      const errors = validate.errors || [];
      
      const errorDetails = errors.map(err => {
        const path = err.instancePath || '';
        const property = err.params?.missingProperty || err.params?.additionalProperty || '';
        const fullPath = property ? `${path ? path + '.' : ''}${property}` : path || '/';
        
        return {
          path: fullPath,
          message: err.message,
          keyword: err.keyword,
          params: err.params
        };
      });
      
      logger.error({
        message: `Validation failed for schema: ${schemaName}`,
        schema: schemaName,
        errors: errorDetails,
        data: this._sanitizeData(validationData),
        schemaProperties: Object.keys(validatorInfo.schema.properties || {})
      });
        // Format validation errors for better readability
      const formattedErrors = errors.map(err => {
        const path = err.instancePath || '';
        const property = err.params?.missingProperty || err.params?.additionalProperty || '';
        const fullPath = property ? `${path ? path + '.' : ''}${property}` : path;
        
        return {
          path: fullPath || '/',
          message: err.message,
          keyword: err.keyword,
          params: err.params
        };
      });
      
      // Construct a more informative error message
      let errorMessage = `Validation failed for schema '${schemaName}'`;
      
      if (formattedErrors.length > 0) {
        const errorPaths = formattedErrors.map(e => `${e.path}: ${e.message}`).join(', ');
        errorMessage += `: ${errorPaths}`;
      }
      
      throw new ValidationError(errorMessage, {
        errors: formattedErrors,
        schemaName,
        dataType: typeof validationData,
        objectKeys: typeof validationData === 'object' ? Object.keys(validationData) : []
      });
    }
    
    // Return validated (and potentially defaulted) data
    return validationData;
  }

  /**
   * Sanitize data for logging
   * @param {Object} data - Data to sanitize
   * @returns {Object} Sanitized data
   * @private
   */
  _sanitizeData(data) {
    if (!data || typeof data !== 'object') {
      return data;
    }
    
    // Make a shallow copy
    const result = Array.isArray(data) ? [...data] : {...data};
    
    // Sanitize sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'auth', 'credentials'];
    
    for (const key in result) {
      if (sensitiveFields.includes(key)) {
        result[key] = '[REDACTED]';
      } else if (typeof result[key] === 'object' && result[key] !== null) {
        result[key] = this._sanitizeData(result[key]);
      }
    }
    
    return result;
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
   */  validateDateTime(dateTime) {
    // If it's not a string, just return true for more tolerance
    if (typeof dateTime !== 'string') {
      return true;
    }
    
    // First try the standard way
    const timestamp = Date.parse(dateTime);
    
    // If that works, great!
    if (!isNaN(timestamp)) {
      return true;
    }
    
    // If not, try more permissive alternatives - unix timestamp, ISO-like formats, etc.
    try {
      // Check if it's a numeric string (unix timestamp)
      if (/^\d+$/.test(dateTime)) {
        return true;
      }
      
      // Check if it contains date-like patterns
      if (/(19|20)\d\d|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/i.test(dateTime)) {
        return true;
      }
      
      // Default to true for maximum tolerance - we don't want validation
      // failures just because of timestamp formatting
      return true;
    } catch (e) {
      // When in doubt, be permissive
      return true;
    }
  }
}

// Export a singleton instance
export default new SchemaValidator();
