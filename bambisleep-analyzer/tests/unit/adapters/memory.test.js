/**
 * Unit tests for Memory Adapter
 */
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import MemoryAdapter from '../../src/adapters/memory.js';
import { NotFoundError } from '../../src/utils/errors.js';

describe('MemoryAdapter', () => {
  let memoryAdapter;
  
  beforeEach(() => {
    memoryAdapter = new MemoryAdapter();
    // Silence logs during testing
    memoryAdapter.logger = {
      info: sinon.spy(),
      debug: sinon.spy(),
      error: sinon.spy()
    };
  });
  
  afterEach(() => {
    sinon.restore();
  });
  
  describe('connect()', () => {
    it('should successfully connect even when connection-test key is not found', async () => {
      // The _execute method will throw NotFoundError for connection-test
      // but connect should handle it gracefully
      await memoryAdapter.connect();
      
      expect(memoryAdapter.connected).to.be.true;
      // Verify the appropriate log was made
      expect(memoryAdapter.logger.info.calledWith('Connected to Memory MCP server (connection-test key not found)')).to.be.true;
    });
    
    it('should throw ConnectionError for other types of errors', async () => {
      // Override _execute to simulate another type of error
      sinon.stub(memoryAdapter, '_execute').rejects(new Error('Unexpected error'));
      
      try {
        await memoryAdapter.connect();
        // Should not reach here
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.name).to.equal('ConnectionError');
        expect(error.message).to.include('Failed to connect to memory');
      }
    });
  });
    describe('_execute()', () => {
    it('should handle connection-test key properly without throwing an error', async () => {
      const result = await memoryAdapter._execute('get', { key: 'connection-test' });
      
      expect(result).to.deep.include({
        key: 'connection-test',
        found: false,
        message: 'Connection test successful, key not found as expected'
      });
      expect(result.value).to.be.null;
    });
    
    it('should return expected result for other keys', async () => {
      const result = await memoryAdapter._execute('get', { key: 'other-key' });
      
      expect(result).to.deep.equal({
        key: 'other-key',
        value: {},
        found: true
      });
    });
  });
});
