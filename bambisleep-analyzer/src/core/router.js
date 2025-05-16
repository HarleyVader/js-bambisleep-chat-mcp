/**
 * Command router for MCP protocol
 * Handles routing commands to their implementations
 */
import logger from '../utils/logger.js';
import protocol from './protocol.js';
import { NotFoundError } from '../utils/errors.js';

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
    
    return wasDeleted;
  }

  /**
   * Handle a command
   * @param {Command} command - Command to handle
   * @returns {Promise<Response>} Command response
   */
  async handleCommand(command) {
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
    
    const { handler } = handlerInfo;
    
    return protocol.processCommand(command, handler);
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
