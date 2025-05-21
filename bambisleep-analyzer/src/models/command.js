/**
 * Command model for MCP protocol
 * Represents the standardized structure for incoming commands
 */
import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../utils/errors.js';
import validator from '../utils/validation.js';
import logger from '../utils/logger.js';

/**
 * MCP Command class
 * @class Command
 */
export class Command {
  /**
   * Create a new Command instance
   * @param {Object} data - Command data
   * @param {string} data.command - Command name
   * @param {string} data.sessionId - Session identifier
   * @param {Object} data.parameters - Command parameters
   */  constructor(data) {
    if (!data) {
      throw new ValidationError('Command data is required');
    }
    
    // Sanitize and normalize the command data with better error handling
    let commandName, sessionId, id, timestamp, parameters;
    
    try {
      // Handle command with more robust parsing
      if (typeof data.command === 'string') {
        commandName = data.command.trim();
      } else if (data.command) {
        commandName = String(data.command).trim();
      } else {
        throw new ValidationError('Command name must be provided');
      }
      
      // Ensure we have a non-empty command
      if (commandName.length === 0) {
        throw new ValidationError('Command name cannot be empty');
      }
      
      // Handle sessionId with more robust parsing
      if (typeof data.sessionId === 'string') {
        sessionId = data.sessionId.trim();
      } else if (data.sessionId) {
        sessionId = String(data.sessionId).trim();
      } else {
        throw new ValidationError('Session ID must be provided');
      }
      
      // Ensure we have a non-empty sessionId
      if (sessionId.length === 0) {
        throw new ValidationError('Session ID cannot be empty');
      }
      
      // Generate UUID if no ID is provided or convert existing to string
      id = data.id ? String(data.id) : uuidv4();
      
      // Handle timestamp with robust parsing or generate a new one
      timestamp = data.timestamp || new Date().toISOString();
      
      // Ensure parameters is an object
      if (data.parameters === null || data.parameters === undefined) {
        parameters = {};
      } else if (typeof data.parameters === 'object') {
        parameters = data.parameters;
      } else {
        // Try to convert to object if possible
        try {
          parameters = JSON.parse(data.parameters);
        } catch (e) {
          parameters = {};
        }
      }
    
      // Create normalized data object 
      const normalizedData = {
        command: commandName,
        sessionId: sessionId,
        id: id,
        timestamp: timestamp,
        parameters: parameters
      };
      
      // Validate with more lenient error handling
      try {
        const validatedData = validator.validate('mcpCommand', normalizedData);
        
        this.command = validatedData.command;
        this.sessionId = validatedData.sessionId;
        this.parameters = validatedData.parameters || {};
        this.id = validatedData.id || id;
        this.timestamp = validatedData.timestamp || timestamp;
      } catch (validationError) {
        // If validation fails, use the normalized data anyway
        // This ensures we can still work with imperfect data
        this.command = normalizedData.command;
        this.sessionId = normalizedData.sessionId;
        this.parameters = normalizedData.parameters;
        this.id = normalizedData.id;
        this.timestamp = normalizedData.timestamp;
        
        // Log the validation error but don't throw
        logger.warn({
          message: `Command validation warning: ${validationError.message}`,
          command: this.command,
          sessionId: this.sessionId,
          error: validationError.message
        });
      }
    } catch (error) {
      // Only throw critical errors that prevent command creation
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError(`Invalid command data: ${error.message}`, { 
        cause: error,
        details: {
          originalData: data
        }
      });
    }
  }

  /**
   * Convert to plain object
   * @returns {Object} Plain object representation
   */
  toObject() {
    return {
      id: this.id,
      command: this.command,
      sessionId: this.sessionId,
      parameters: this.parameters,
      timestamp: this.timestamp
    };
  }

  /**
   * Create a Command from plain object
   * @param {Object} obj - Plain object representation
   * @returns {Command} New Command instance
   */
  static fromObject(obj) {
    return new Command(obj);
  }
}

export default Command;
