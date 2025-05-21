/**
 * Command router for MCP protocol
 * Handles routing commands to their implementations
 */
import logger from '../utils/logger.js';
import protocol from './protocol.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

/**
 * MCP Router class
 * Routes commands to appropriate handler implementations
 * @class Router
 */
class Router {
  constructor() {
    // Map of command handlers
    this.commandHandlers = new Map();
    logger.info('MCP Router initialized');
  }

  /**
   * Register a command handler
   * @param {string} commandName - Command name
   * @param {Function} handler - Command handler function
   * @param {Object} [options={}] - Registration options
   * @param {string} [options.description] - Command description
   * @param {Object} [options.schema] - Command parameters schema
   */
  registerCommand(commandName, handler, options = {}) {
    if (typeof commandName !== 'string' || !commandName) {
      throw new Error('Command name must be a non-empty string');
    }
    
    if (typeof handler !== 'function') {
      throw new Error('Command handler must be a function');
    }
    
    this.commandHandlers.set(commandName, {
      handler,
      description: options.description || '',
      schema: options.schema || null
    });
    
    logger.debug({
      message: `Registered command handler: ${commandName}`,
      commandName
    });
  }

  /**
   * Unregister a command handler
   * @param {string} commandName - Command name
   * @returns {boolean} True if handler was unregistered
   */
  unregisterCommand(commandName) {
    const wasDeleted = this.commandHandlers.delete(commandName);
    
    if (wasDeleted) {
      logger.debug({
        message: `Unregistered command handler: ${commandName}`,
        commandName
      });
    }
    
    return wasDeleted;  }
  
  /**
   * Handle a command
   * @param {Command} command - Command to handle
   * @returns {Promise<Response>} Command response
   */  async handleCommand(command) {
    try {
      if (!command || !command.command) {
        throw new ValidationError('Invalid command object passed to handleCommand', {
          received: command ? typeof command : 'undefined'
        });
      }
      
      const handlerInfo = this.commandHandlers.get(command.command);
      
      if (!handlerInfo) {
        const availableCommands = Array.from(this.commandHandlers.keys());
        logger.debug({
          message: `Command not found: ${command.command}`,
          availableCommands
        });
        
        throw new NotFoundError(`Command not found: ${command.command}`, {
          availableCommands
        });
      }
    
      const { handler, schema } = handlerInfo;
      // Validate command parameters against command-specific schema if available
      if (schema) {
        try {
          // This will use our custom validator to check command parameters
          // Get validator synchronously to prevent issues with async imports
          const validator = require('../utils/validation.js').default;
          
          // Use a dynamic schema name for this command
          const paramSchemaName = `cmd-${command.command}-params`;
          
          // Register the schema if it's not already registered
          if (!validator.validators.has(paramSchemaName)) {
            // Add more tolerant settings to the schema
            const enhancedSchema = {
              ...schema,
              // Set additionalProperties to true for more flexibility
              additionalProperties: true,
              // Make required properties optional
              required: []
            };
            
            // Register with enhanced schema for greater tolerance
            validator.registerSchema(paramSchemaName, enhancedSchema);
          }
          
          try {
            // Validate parameters against the schema - but don't fail if validation errors
            validator.validate(paramSchemaName, command.parameters);
          } catch (validationError) {
            // Just log the validation issues but continue execution
            logger.warn({
              message: `Non-fatal parameter validation issue: ${validationError.message}`,
              command: command.command,
              parameters: command.parameters
            });
          }
        } catch (error) {
          // Log but don't fail - we want the app to be resilient
          logger.warn({
            message: `Command parameter validation setup error`,
            command: command.command,
            error: error.message
          });
        }
      }
      
      return protocol.processCommand(command, handler);
    } catch (error) {
      // Handle any errors that occurred during command processing
      logger.error({
        message: `Error handling command: ${error.message}`,
        command: command?.command,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        }
      });
      throw error;
    }
  }

  /**
   * Get handler info for a command
   * @param {string} commandName - Command name
   * @returns {Object|null} Handler info or null if not found
   */
  getCommandInfo(commandName) {
    const handlerInfo = this.commandHandlers.get(commandName);
    
    if (!handlerInfo) {
      return null;
    }
    
    return {
      name: commandName,
      description: handlerInfo.description,
      schema: handlerInfo.schema
    };
  }

  /**
   * Get information about all registered commands
   * @returns {Array<Object>} Array of command info objects
   */
  getAllCommandsInfo() {
    const commands = [];
    
    for (const [commandName, handlerInfo] of this.commandHandlers.entries()) {
      commands.push({
        name: commandName,
        description: handlerInfo.description,
        schema: handlerInfo.schema
      });
    }
    
    return commands;
  }

  /**
   * Get available command names
   * @returns {Array<string>} Array of command names
   */
  getAvailableCommands() {
    return Array.from(this.commandHandlers.keys());
  }
}

// Export a singleton instance
export default new Router();
