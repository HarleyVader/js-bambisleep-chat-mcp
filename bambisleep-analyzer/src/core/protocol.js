/**
 * Core MCP Protocol implementation
 * Handles parsing and validating MCP messages
 */
import Command from '../models/command.js';
import Response from '../models/response.js';
import logger from '../utils/logger.js';
import { ValidationError, ProtocolError } from '../utils/errors.js';
import sessionManager from './session.js';

/**
 * MCP Protocol class
 * Core implementation of the MCP protocol logic
 * @class Protocol
 */
class Protocol {
  constructor() {
    logger.info('MCP Protocol initialized');
  }

  /**
   * Parse and validate an incoming MCP command
   * @param {Object|string} rawCommand - Raw command data
   * @returns {Command} Validated Command object
   * @throws {ProtocolError} If command fails validation
   */
  parseCommand(rawCommand) {
    try {
      // Parse if string
      let commandData = rawCommand;
      if (typeof rawCommand === 'string') {
        try {
          commandData = JSON.parse(rawCommand);
        } catch (error) {
          throw new ProtocolError('Invalid JSON in command', {
            rawCommand: typeof rawCommand === 'string' ? rawCommand.substring(0, 100) : 'not a string',
            parseError: error.message
          });
        }
      }
      
      // Validate and create Command
      return new Command(commandData);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw new ProtocolError(`Invalid command format: ${error.message}`, {
          validationErrors: error.details?.errors || [],
          rawCommand: typeof rawCommand === 'string' ? rawCommand.substring(0, 100) : rawCommand
        });
      }
      throw error;
    }
  }

  /**
   * Create a success response
   * @param {string} sessionId - Session ID
   * @param {Object} result - Result data
   * @returns {Response} Success response
   */
  createSuccessResponse(sessionId, result) {
    return Response.success(sessionId, result);
  }

  /**
   * Create an error response
   * @param {string} sessionId - Session ID
   * @param {Error} error - Error object
   * @returns {Response} Error response
   */
  createErrorResponse(sessionId, error) {
    // Format error for MCP protocol
    const errorData = {
      type: error.name || 'Error',
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unknown error occurred',
      details: error.details || {}
    };
    
    return Response.error(sessionId, errorData);
  }

  /**
   * Process an MCP command with its implementation
   * @param {Command} command - Validated command
   * @param {Function} implementation - Command implementation function
   * @returns {Promise<Response>} Command response
   */
  async processCommand(command, implementation) {
    try {
      // Ensure we have a valid session
      let session;
      try {
        session = sessionManager.getSession(command.sessionId);
      } catch (error) {
        if (error instanceof ValidationError || error.code === 'NOT_FOUND') {
          // Create a new session if not found or invalid
          session = sessionManager.createSession();
          command.sessionId = session.id; // Update command with new session ID
        } else {
          throw error;
        }
      }
      
      // Log command processing
      const commandLogger = logger.child({
        sessionId: command.sessionId,
        commandId: command.id,
        command: command.command
      });
      
      commandLogger.debug({
        message: 'Processing command',
        parameters: command.parameters
      });
      
      // Execute command implementation
      const result = await implementation(command, session);
      
      // Update session state if needed
      if (result.sessionState) {
        sessionManager.updateSession(command.sessionId, result.sessionState);
        delete result.sessionState; // Remove from response
      }
      
      commandLogger.debug({
        message: 'Command processed successfully'
      });
      
      // Create success response
      return this.createSuccessResponse(command.sessionId, result);
    } catch (error) {
      logger.error({
        message: `Command processing failed: ${error.message}`,
        command: command.toObject(),
        error
      });
      
      // Create error response
      return this.createErrorResponse(command.sessionId, error);
    }
  }

  /**
   * Get a list of all available commands in the protocol
   * @returns {Array<string>} List of available commands
   */
  getAvailableCommands() {
    // This would typically be populated by the router
    return [];
  }
}

// Export a singleton instance
export default new Protocol();
