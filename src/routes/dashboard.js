/**
 * Dashboard routes for the MCP toolset
 * Provides frontend UI for interacting with MCP commands
 */

import express from 'express';
import protocol from '../../bambisleep-analyzer/src/core/protocol.js';
import router from '../../bambisleep-analyzer/src/core/router.js';
import logger from '../../bambisleep-analyzer/src/utils/logger.js';
import sessionManager from '../../bambisleep-analyzer/src/core/session.js';

const dashboardRouter = express.Router();

/**
 * Main dashboard page
 * Shows all available MCP commands and adapter status
 */
dashboardRouter.get('/', async (req, res) => {
  try {
    // Get system info to display adapters and commands
    const systemInfo = await router.handleCommand(protocol.parseCommand({
      command: 'system.info',
      sessionId: 'dashboard',
      id: 'dashboard-system-info',
      parameters: {}
    }));

    res.render('dashboard', {
      title: 'MCP Dashboard',
      adapters: systemInfo.result.adapters,
      commands: systemInfo.result.commands.map(cmd => {
        const cmdInfo = router.getCommandInfo(cmd);
        return {
          name: cmd,
          description: cmdInfo?.description || 'No description available',
          schema: cmdInfo?.schema || null
        };
      })
    });
  } catch (error) {
    logger.error(`Dashboard render error: ${error.message}`);
    res.status(500).render('error', {
      title: 'Error',
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : ''
      }
    });
  }
});

/**
 * View for specific MCP command
 */
dashboardRouter.get('/command/:commandName', (req, res) => {
  try {
    const { commandName } = req.params;
    const commandInfo = router.getCommandInfo(commandName);
    
    if (!commandInfo) {
      return res.status(404).render('error', {
        title: 'Command Not Found',
        error: {
          message: `Command ${commandName} not found`,
          stack: ''
        }
      });
    }
    
    res.render('command', {
      title: `MCP Command: ${commandName}`,
      command: commandInfo
    });
  } catch (error) {
    logger.error(`Command view error: ${error.message}`);
    res.status(500).render('error', {
      title: 'Error',
      error: {
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : ''
      }
    });
  }
});

/**
 * API endpoint to execute a command
 */
dashboardRouter.post('/api/execute', async (req, res) => {
  try {
    const { command, parameters, sessionId = 'dashboard', timeout, enableRetry } = req.body;
    
    if (!command) {
      return res.status(400).json({
        error: 'Command is required'
      });
    }
    
    // Process the parameters to convert special types
    const processedParams = {};
    for (const [key, value] of Object.entries(parameters || {})) {
      if (value === 'true') {
        processedParams[key] = true;
      } else if (value === 'false') {
        processedParams[key] = false;
      } else if (!isNaN(value) && value !== '') {
        processedParams[key] = Number(value);
      } else {
        processedParams[key] = value;
      }
    }
    
    // Handle retry logic
    const maxRetries = enableRetry ? 3 : 1;
    let lastError = null;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        // Calculate timeout with backoff for retries
        const retryTimeout = timeout ? Number(timeout) * (retryCount + 1) : undefined;        // Create a well-formed command object with enhanced validation safeguards
        const cmdRequest = {
          command: String(command).trim(), // Force to string and trim for safety
          sessionId: String(sessionId || 'dashboard').trim(), // Ensure string type with default
          id: `dashboard-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`, // More unique ID
          timestamp: new Date().toISOString(),
          parameters: {
            ...processedParams,
            // Add timeout to parameters if it's provided
            ...(retryTimeout && { timeout: retryTimeout }),
            // Add source info to help with debugging
            _source: 'dashboard',
            _retryCount: retryCount
          }
        };
        
        logger.debug({
          message: `Executing command ${command}`,
          attempt: retryCount + 1,
          timeout: retryTimeout,
          parameters: processedParams
        });
        
        const response = await router.handleCommand(protocol.parseCommand(cmdRequest));
        return res.json({
          ...response,
          dashboard: {
            retryCount
          }
        });
      } catch (error) {
        lastError = error;
        retryCount++;
        
        if (retryCount < maxRetries && (error.name === 'TimeoutError' || error.code === 'TIMEOUT_ERROR')) {
          logger.warn({
            message: `Command ${command} timed out, retrying (${retryCount}/${maxRetries})`,
            error: error.message
          });
          
          // Continue to next retry iteration
          continue;
        }
        
        // Break out of loop for non-timeout errors or if we've reached max retries
        break;
      }
    }
    
    // If we get here, all retries failed
    const errorResponse = protocol.createErrorResponse(
      sessionId,
      lastError
    );
    
    // Add retry information
    return res.status(lastError.status || 500).json({
      ...errorResponse.toObject(),
      dashboard: {
        retryAttempts: retryCount,
        maxRetries,
        originalError: lastError.message
      }
    });
  } catch (error) {
    logger.error(`Command execution error: ${error.message}`);
    res.status(500).json({
      error: error.message
    });
  }
});

/**
 * API endpoint to get sessions
 */
dashboardRouter.get('/api/sessions', (req, res) => {
  try {
    const sessions = sessionManager.getAllSessions();
    res.json(sessions);
  } catch (error) {
    logger.error(`Get sessions error: ${error.message}`);
    res.status(500).json({
      error: error.message
    });
  }
});

export default dashboardRouter;
