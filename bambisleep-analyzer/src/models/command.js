/**
 * Command model for MCP protocol
 * Represents the standardized structure for incoming commands
 */
import { v4 as uuidv4 } from 'uuid';
import { ValidationError } from '../utils/errors.js';
import validator from '../utils/validation.js';

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
   */
  constructor(data) {
    if (!data) {
      throw new ValidationError('Command data is required');
    }
    
    // Validate command structure
    const validatedData = validator.validate('mcpCommand', data);
    
    this.command = validatedData.command;
    this.sessionId = validatedData.sessionId;
    this.parameters = validatedData.parameters || {};
    this.id = validatedData.id || uuidv4();
    this.timestamp = validatedData.timestamp || new Date().toISOString();
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
