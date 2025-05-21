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
   */  parseCommand(rawCommand) {
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
      
      // Ensure commandData is an object (be more permissive about object-like structures)
      if (!commandData) {
        throw new ProtocolError('Command data cannot be null or undefined', {
          receivedType: typeof commandData
        });
      }
      
      // Try to normalize data if it's not a proper object
      if (typeof commandData !== 'object') {
        try {
          commandData = { 
            command: String(commandData),
            sessionId: 'auto-generated',
            parameters: {}
          };
          logger.warn({
            message: 'Converted non-object command data to object',
            originalType: typeof rawCommand
          });
        } catch (error) {
          throw new ProtocolError('Command data must be convertible to object', {
            receivedType: typeof commandData
          });
        }
      }
      
      // Fix missing properties with defaults to be more resilient
      if (!commandData.command) {
        if (commandData.name) {
          commandData.command = commandData.name;
          logger.warn('Using "name" property as command name');
        } else if (commandData.cmd) {
          commandData.command = commandData.cmd;
          logger.warn('Using "cmd" property as command name');
        } else {
          throw new ProtocolError('Missing required command name property', {
            receivedCommand: JSON.stringify(commandData).substring(0, 100)
          });
        }
      }
      
      if (!commandData.sessionId) {
        // Auto-generate a sessionId if missing
        commandData.sessionId = `auto-${Date.now()}`;
        logger.warn({
          message: 'Auto-generated sessionId for command',
          commandName: commandData.command,
          generatedSessionId: commandData.sessionId
        });
      }
      
      // Normalize parameters to ensure it's always an object
      if (!commandData.parameters) {
        commandData.parameters = {};
      } else if (typeof commandData.parameters !== 'object') {
        try {
          // Try to parse if it's a string
          if (typeof commandData.parameters === 'string') {
            commandData.parameters = JSON.parse(commandData.parameters);
          } else {
            // Otherwise create an empty object
            commandData.parameters = {};
          }
        } catch (error) {
          commandData.parameters = {};
          logger.warn({
            message: 'Could not parse parameters, using empty object',
            original: commandData.parameters
          });
        }
      }
      
      // Log the command being processed for debugging
      logger.debug({
        message: 'Processing MCP command',
        command: commandData.command,
        sessionId: commandData.sessionId,
        hasParameters: commandData.parameters ? true : false
      });
      
      // Create Command with better error handling
      try {
        return new Command(commandData);
      } catch (cmdError) {
        logger.error({
          message: 'Command constructor error',
          error: cmdError.message,
          commandData: {
            command: commandData.command,
            sessionId: commandData.sessionId
          }
        });
        
        // Try one more time with a simplified version
        const simplifiedCommand = {
          command: String(commandData.command || ''),
          sessionId: String(commandData.sessionId || ''),
          parameters: {}
        };
        
        return new Command(simplifiedCommand);
      }
    } catch (error) {
      if (error instanceof ValidationError) {
        logger.error({
          message: 'Command validation failed',
          error: error.message,
          details: error.details || {},
          commandData: typeof rawCommand === 'object' ? 
            { command: rawCommand.command, sessionId: rawCommand.sessionId } : 
            'Invalid format'
        });
        
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
          logger.info({
            message: 'Created new session for command',
            sessionId: session.id,
            commandId: command.id
          });
        } else {
          logger.error({
            message: 'Session error during command processing',
            error: error.message,
            stackTrace: error.stack,
            commandId: command.id
          });
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
      
      // Execute command implementation with timeout
      let result;
      try {
        result = await implementation(command, session);
      } catch (implError) {
        commandLogger.error({
          message: 'Command implementation failed',
          error: implError.message,
          stackTrace: implError.stack
        });
        throw implError;
      }
      
      // Update session state if needed
      if (result && result.sessionState) {
        try {
          sessionManager.updateSession(command.sessionId, result.sessionState);
          delete result.sessionState; // Remove from response
        } catch (sessionError) {
          commandLogger.error({
            message: 'Failed to update session after command',
            error: sessionError.message
          });
          // Continue with response even if session update fails
        }
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
        error: {
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack
        }
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
