/**
 * Contract tests to ensure MCP protocol conformance
 */
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { v4 as uuidv4 } from 'uuid';
import Ajv from 'ajv';

import protocol from '../../src/core/protocol.js';
import router from '../../src/core/router.js';
import sessionManager from '../../src/core/session.js';

// MCP Schema definitions (as defined in the specification)
const mcpSchemas = {
  // Simplified MCP command schema from the specification
  command: {
    type: 'object',
    required: ['command', 'sessionId'],
    properties: {
      command: { type: 'string', minLength: 1 },
      sessionId: { type: 'string', minLength: 1 },
      id: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' },
      parameters: { type: 'object' }
    }
  },
  
  // Simplified MCP response schema from the specification
  response: {
    type: 'object',
    required: ['sessionId'],
    properties: {
      sessionId: { type: 'string', minLength: 1 },
      id: { type: 'string' },
      timestamp: { type: 'string', format: 'date-time' },
      result: { type: 'object' },
      error: {
        type: 'object',
        properties: {
          type: { type: 'string' },
          message: { type: 'string' },
          code: { type: 'string' },
          details: { type: 'object' }
        },
        required: ['type', 'message']
      }
    },
    oneOf: [
      { required: ['result'] },
      { required: ['error'] }
    ]
  }
};

describe('MCP Protocol Contract Tests', () => {
  let ajv;
  let validateCommand;
  let validateResponse;
  
  // Test command handler implementation
  const testCommandHandler = sinon.stub();
  
  beforeEach(() => {
    // Initialize JSON Schema validator
    ajv = new Ajv({ allErrors: true });
    validateCommand = ajv.compile(mcpSchemas.command);
    validateResponse = ajv.compile(mcpSchemas.response);
    
    // Reset stubs
    testCommandHandler.reset();
    
    // Register test command
    router.registerCommand('test', testCommandHandler, {
      description: 'Test command for contract testing',
      schema: {
        type: 'object',
        properties: {
          value: { type: 'string' }
        }
      }
    });
    
    // Setup default behavior for test command
    testCommandHandler.callsFake(async (command) => {
      return {
        echo: command.parameters
      };
    });
  });
  
  afterEach(() => {
    router.unregisterCommand('test');
    sinon.restore();
  });
  
  describe('Command Structure Conformance', () => {
    it('should produce a command object that conforms to MCP specification', () => {
      // Create a command using our implementation
      const rawCommand = {
        command: 'test',
        sessionId: uuidv4(),
        parameters: {
          value: 'test-value'
        }
      };
      
      const command = protocol.parseCommand(rawCommand);
      const commandObj = command.toObject();
      
      // Validate against MCP schema
      const valid = validateCommand(commandObj);
      
      // If validation fails, output errors
      if (!valid) {
        console.log('Command validation errors:', validateCommand.errors);
      }
      
      expect(valid).to.be.true;
      
      // Additional contract requirements
      expect(commandObj.id).to.be.a('string');
      expect(commandObj.timestamp).to.be.a('string');
      expect(new Date(commandObj.timestamp)).not.to.be.NaN; // Valid date
    });
  });
  
  describe('Response Structure Conformance', () => {
    it('should produce a success response that conforms to MCP specification', async () => {
      // Create a session
      const session = sessionManager.createSession();
      
      // Create a command
      const rawCommand = {
        command: 'test',
        sessionId: session.id,
        parameters: {
          value: 'test-value'
        }
      };
      
      const command = protocol.parseCommand(rawCommand);
      
      // Process through router to get response
      const response = await router.handleCommand(command);
      
      // Convert to plain object if needed
      const responseObj = typeof response.toObject === 'function' 
        ? response.toObject() 
        : response;
      
      // Validate against MCP schema
      const valid = validateResponse(responseObj);
      
      // If validation fails, output errors
      if (!valid) {
        console.log('Response validation errors:', validateResponse.errors);
      }
      
      expect(valid).to.be.true;
      
      // Additional contract requirements
      expect(responseObj.sessionId).to.equal(session.id);
      expect(responseObj).to.have.property('result');
      expect(responseObj).to.not.have.property('error');
    });
    
    it('should produce an error response that conforms to MCP specification', async () => {
      // Setup command to throw an error
      testCommandHandler.rejects(new Error('Test error'));
      
      // Create a session
      const session = sessionManager.createSession();
      
      // Create a command
      const rawCommand = {
        command: 'test',
        sessionId: session.id,
        parameters: {}
      };
      
      const command = protocol.parseCommand(rawCommand);
      
      // Process through router to get error response
      const response = await router.handleCommand(command);
      
      // Convert to plain object if needed
      const responseObj = typeof response.toObject === 'function' 
        ? response.toObject() 
        : response;
      
      // Validate against MCP schema
      const valid = validateResponse(responseObj);
      
      // If validation fails, output errors
      if (!valid) {
        console.log('Error response validation errors:', validateResponse.errors);
      }
      
      expect(valid).to.be.true;
      
      // Additional contract requirements
      expect(responseObj.sessionId).to.equal(session.id);
      expect(responseObj).to.have.property('error');
      expect(responseObj.error).to.have.property('type');
      expect(responseObj.error).to.have.property('message');
      expect(responseObj).to.not.have.property('result');
    });
  });
  
  describe('Session Management Conformance', () => {
    it('should maintain separate state for different sessions', async () => {
      // Create two sessions
      const session1 = sessionManager.createSession({ counter: 0 });
      const session2 = sessionManager.createSession({ counter: 0 });
      
      // Setup command handler to increment counter in session state
      testCommandHandler.callsFake(async (command, session) => {
        const counter = (session.state.counter || 0) + 1;
        return {
          counter,
          sessionState: { counter }
        };
      });
      
      // Process a command for session1
      const command1 = protocol.parseCommand({
        command: 'test',
        sessionId: session1.id,
        parameters: {}
      });
      
      await router.handleCommand(command1);
      
      // Process a command for session2
      const command2 = protocol.parseCommand({
        command: 'test',
        sessionId: session2.id,
        parameters: {}
      });
      
      await router.handleCommand(command2);
      
      // Process another command for session1
      const command3 = protocol.parseCommand({
        command: 'test',
        sessionId: session1.id,
        parameters: {}
      });
      
      await router.handleCommand(command3);
      
      // Verify session states are properly isolated
      const updatedSession1 = sessionManager.getSession(session1.id);
      const updatedSession2 = sessionManager.getSession(session2.id);
      
      expect(updatedSession1.state.counter).to.equal(2);
      expect(updatedSession2.state.counter).to.equal(1);
    });
  });
});
