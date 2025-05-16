/**
 * Session management for MCP protocol
 * Handles the creation, retrieval, and management of session state
 */
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger.js';
import { NotFoundError } from '../utils/errors.js';
import config from '../utils/config.js';

// Get session configuration
const sessionConfig = config.get('session', {
  ttl: 3600 * 24, // 24 hours
  cleanupInterval: 3600 // 1 hour
});

/**
 * Session Manager class
 * Responsible for managing MCP sessions and their state
 * @class SessionManager
 */
class SessionManager {
  constructor() {
    // Map to store all active sessions
    this.sessions = new Map();
    
    // Set up session cleanup interval
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredSessions();
    }, sessionConfig.cleanupInterval * 1000);
    
    logger.info('Session manager initialized');
  }

  /**
   * Create a new session
   * @param {Object} [initialState={}] - Initial session state
   * @returns {Object} New session object
   */
  createSession(initialState = {}) {
    const sessionId = uuidv4();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + (sessionConfig.ttl * 1000));
    
    const session = {
      id: sessionId,
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      state: initialState
    };
    
    this.sessions.set(sessionId, session);
    
    logger.debug({
      message: 'Session created',
      sessionId
    });
    
    return session;
  }

  /**
   * Get a session by ID
   * @param {string} sessionId - Session identifier
   * @returns {Object} Session object
   * @throws {NotFoundError} If session not found
   */
  getSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      logger.debug({
        message: 'Session not found',
        sessionId
      });
      throw new NotFoundError(`Session not found: ${sessionId}`);
    }
    
    const session = this.sessions.get(sessionId);
    
    // Check if session has expired
    if (new Date() > new Date(session.expiresAt)) {
      this.sessions.delete(sessionId);
      logger.debug({
        message: 'Session expired',
        sessionId
      });
      throw new NotFoundError(`Session expired: ${sessionId}`);
    }
    
    return session;
  }

  /**
   * Update a session's state
   * @param {string} sessionId - Session identifier
   * @param {Object|Function} stateUpdates - New state object or update function
   * @returns {Object} Updated session object
   * @throws {NotFoundError} If session not found
   */
  updateSession(sessionId, stateUpdates) {
    const session = this.getSession(sessionId);
    const updatedAt = new Date();
    const expiresAt = new Date(updatedAt.getTime() + (sessionConfig.ttl * 1000));
    
    // Apply state updates
    let newState;
    if (typeof stateUpdates === 'function') {
      // If stateUpdates is a function, call it with current state
      newState = stateUpdates(session.state);
    } else {
      // Otherwise merge current state with stateUpdates
      newState = { ...session.state, ...stateUpdates };
    }
    
    // Update session
    const updatedSession = {
      ...session,
      updatedAt: updatedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      state: newState
    };
    
    this.sessions.set(sessionId, updatedSession);
    
    logger.debug({
      message: 'Session updated',
      sessionId
    });
    
    return updatedSession;
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session identifier
   * @returns {boolean} True if session was deleted
   */
  deleteSession(sessionId) {
    const wasDeleted = this.sessions.delete(sessionId);
    
    if (wasDeleted) {
      logger.debug({
        message: 'Session deleted',
        sessionId
      });
    }
    
    return wasDeleted;
  }

  /**
   * Cleanup expired sessions
   * @private
   */
  cleanupExpiredSessions() {
    const now = new Date();
    let expiredCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > new Date(session.expiresAt)) {
        this.sessions.delete(sessionId);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.debug({
        message: `Cleaned up ${expiredCount} expired sessions`,
        expiredCount
      });
    }
  }

  /**
   * Get total number of active sessions
   * @returns {number} Number of active sessions
   */
  getSessionCount() {
    return this.sessions.size;
  }

  /**
   * Clean up resources on shutdown
   */
  shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    
    logger.info('Session manager shut down');
  }
}

// Export a singleton instance
const sessionManager = new SessionManager();

// Handle process termination
process.on('SIGTERM', () => {
  sessionManager.shutdown();
});

process.on('SIGINT', () => {
  sessionManager.shutdown();
});

export default sessionManager;
