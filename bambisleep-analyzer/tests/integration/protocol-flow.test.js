/**
 * Integration test for MCP protocol flow
 */
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { v4 as uuidv4 } from 'uuid';

import protocol from '../../src/core/protocol.js';
import router from '../../src/core/router.js';
import sessionManager from '../../src/core/session.js';

describe('MCP Protocol Flow Integration', () => {
  // Test command handler implementation
  const testCommandHandler = sinon.stub();
  
  beforeEach(() => {
    // Reset stubs
    testCommandHandler.reset();
    
    // Register test command
    router.registerCommand('test', testCommandHandler, {
      description: 'Test command for integration testing',
      schema: {
        type: 'object',
        properties: {
          value: { type: 'string' }
        }
      }
    });
    
    // Setup default behavior for test command
    testCommandHandler.callsFake(async (command, session) => {
      return {
        received: command.parameters,
        sessionId: session.id,
        sessionState: {
          lastCommand: command.command,
          timestamp: new Date().toISOString()
        }
      };
    });
  });
  
  afterEach(() => {
    // Unregister test command
    router.unregisterCommand('test');
    sinon.restore();
  });
  
  describe('Command Processing Flow', () => {
    it('should process a command through the entire protocol flow', async () => {
      // Create a test session
      const session = sessionManager.createSession({ test: 'initial' });
      
      // Create command
      const commandData = {
        command: 'test',
        sessionId: session.id,
        parameters: {
          value: 'test-value'
        }
      };
      
      // Parse command
      const command = protocol.parseCommand(commandData);
      
      // Handle command through router
      const response = await router.handleCommand(command);
      
      // Verify command was properly handled
      expect(testCommandHandler.calledOnce).to.be.true;
      expect(response).to.be.an('object');
      expect(response.sessionId).to.equal(session.id);
      expect(response.result).to.be.an('object');
      expect(response.result.received).to.deep.equal({ value: 'test-value' });
      
      // Verify session state was updated
      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession.state.lastCommand).to.equal('test');
    });
    
    it('should create a new session if the provided one is invalid', async () => {
      // Create command with invalid session ID
      const commandData = {
        command: 'test',
        sessionId: 'invalid-session-id',
        parameters: {
          value: 'test-value'
        }
      };
      
      // Parse command
      const command = protocol.parseCommand(commandData);
      
      // Handle command through router
      const response = await router.handleCommand(command);
      
      // Verify command was properly handled with new session ID
      expect(response).to.be.an('object');
      expect(response.sessionId).to.not.equal('invalid-session-id');
      
      // Verify the session exists
      const session = sessionManager.getSession(response.sessionId);
      expect(session).to.exist;
      expect(session.state.lastCommand).to.equal('test');
    });
    
    it('should handle errors in command execution', async () => {
      // Setup command to throw an error
      testCommandHandler.rejects(new Error('Test error'));
      
      // Create a test session
      const session = sessionManager.createSession();
      
      // Create command
      const commandData = {
        command: 'test',
        sessionId: session.id,
        parameters: {
          value: 'test-value'
        }
      };
      
      // Parse command
      const command = protocol.parseCommand(commandData);
      
      // Handle command through router
      const response = await router.handleCommand(command);
      
      // Verify error response was created
      expect(response).to.be.an('object');
      expect(response.sessionId).to.equal(session.id);
      expect(response.error).to.be.an('object');
      expect(response.error.message).to.equal('Test error');
      expect(response.error.type).to.equal('Error');
    });
    
    it('should generate proper error when command is not found', async () => {
      // Create a test session
      const session = sessionManager.createSession();
      
      // Create command with a non-existent command name
      const commandData = {
        command: 'non-existent-command',
        sessionId: session.id,
        parameters: {}
      };
      
      // Parse command
      const command = protocol.parseCommand(commandData);
      
      try {
        // Handle command through router (should throw)
        await router.handleCommand(command);
        expect.fail('Should have thrown an error');
      } catch (error) {
        // Verify error
        expect(error.name).to.equal('NotFoundError');
        expect(error.message).to.include('Command not found');
      }
    });
  });
  
  describe('Protocol Validation', () => {
    it('should reject invalid command formats', () => {
      const invalidFormats = [
        null,
        undefined,
        'not-an-object',
        123,
        {},
        { command: 'test' }, // missing sessionId
        { sessionId: 'test' }, // missing command
        { command: '', sessionId: 'test' }, // empty command
        { command: 'test', sessionId: '' }, // empty sessionId
      ];
      
      invalidFormats.forEach(format => {
        expect(() => protocol.parseCommand(format)).to.throw();
      });
    });
    
    it('should correctly parse valid command format', () => {
      const validCommand = {
        command: 'test',
        sessionId: uuidv4(),
        parameters: { value: 'test' }
      };
      
      const parsed = protocol.parseCommand(validCommand);
      expect(parsed.command).to.equal(validCommand.command);
      expect(parsed.sessionId).to.equal(validCommand.sessionId);
      expect(parsed.parameters).to.deep.equal(validCommand.parameters);
      expect(parsed.id).to.be.a('string');
      expect(parsed.timestamp).to.be.a('string');
    });
  });
});
