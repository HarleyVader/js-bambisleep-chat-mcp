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
   * Get a snapshot of session state (immutable)
   * @param {string} sessionId - Session identifier
   * @returns {Object} Immutable copy of session state
   * @throws {NotFoundError} If session not found
   */
  getSessionState(sessionId) {
    const session = this.getSession(sessionId);
    return this._cloneState(session.state);
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
      // If stateUpdates is a function, call it with immutable copy of current state
      const currentState = this._cloneState(session.state);
      const updatedState = stateUpdates(currentState);
      newState = this._cloneState(updatedState);
    } else {
      // Otherwise merge current state with stateUpdates (both immutable)
      const currentState = this._cloneState(session.state);
      const updates = this._cloneState(stateUpdates);
      newState = { ...currentState, ...updates };
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
   * Create a deep clone of session state to ensure immutability
   * @param {Object} state - State to clone
   * @returns {Object} Deep cloned state
   * @private
   */
  _cloneState(state) {
    if (!state) return {};
    try {
      return JSON.parse(JSON.stringify(state));
    } catch (error) {
      logger.warn({
        message: 'Failed to clone session state, returning empty object',
        error: error.message
      });
      return {};
    }
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
    
    try {
      for (const [sessionId, session] of this.sessions.entries()) {
        if (now > new Date(session.expiresAt)) {
          this.sessions.delete(sessionId);
          expiredCount++;
        }
      }
      
      if (expiredCount > 0) {
        logger.info({
          message: `Cleaned up ${expiredCount} expired sessions`,
          activeSessionsCount: this.sessions.size
        });
      }
    } catch (error) {
      logger.error({
        message: 'Error during session cleanup',
        error: error.message,
        stack: error.stack
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
   * Get all active sessions (for dashboard/admin use)
   * @returns {Array<Object>} Array of session objects with sanitized state
   */
  getAllSessions() {
    const result = [];
    for (const [sessionId, session] of this.sessions.entries()) {
      // Only include non-expired sessions
      if (new Date() <= new Date(session.expiresAt)) {
        // Clone session and sanitize state for security
        const sanitizedSession = {
          ...session,
          state: this._sanitizeSessionState(session.state)
        };
        result.push(sanitizedSession);
      }
    }
    return result;
  }
  
  /**
   * Sanitize session state for public exposure
   * @param {Object} state - Session state
   * @returns {Object} Sanitized state
   * @private
   */
  _sanitizeSessionState(state) {
    // Create a sanitized copy of the state
    const sanitized = this._cloneState(state);
    
    // Remove any sensitive fields
    const sensitiveKeys = ['credentials', 'token', 'password', 'apiKey', 'secret'];
    
    const recursiveRemove = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const key of Object.keys(obj)) {
        if (sensitiveKeys.includes(key)) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          recursiveRemove(obj[key]);
        }
      }
    };
    
    recursiveRemove(sanitized);
    return sanitized;
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
