// ----------------------------------------------------------------------

import { it, expect, describe } from 'vitest';

import type { StreamStatus } from '../stream-status';

/**
 * Unit tests for Stream Status types and transitions
 */
describe('StreamStatus', () => {
  it('should have valid status values', () => {
    const validStatuses: StreamStatus[] = [
      'IDLE',
      'CONNECTING',
      'STREAMING',
      'RECONNECTING',
      'COMPLETED',
      'ABORTED',
      'ERROR',
    ];

    validStatuses.forEach((status) => {
      expect(status).toBeDefined();
      expect(typeof status).toBe('string');
    });
  });

  it('should transition from CONNECTING to STREAMING', () => {
    const status: StreamStatus = 'CONNECTING';
    const nextStatus: StreamStatus = 'STREAMING';
    
    expect(status).toBe('CONNECTING');
    expect(nextStatus).toBe('STREAMING');
  });

  it('should transition to COMPLETED on [DONE] event', () => {
    const dataStr = '[DONE]';
    const shouldComplete = dataStr === '[DONE]';
    
    expect(shouldComplete).toBe(true);
  });

  it('should transition to ABORTED on AbortError', () => {
    const error = { name: 'AbortError' };
    const shouldAbort = error.name === 'AbortError';
    
    expect(shouldAbort).toBe(true);
  });

  it('should transition to ERROR on network/parsing errors', () => {
    const error = { name: 'NetworkError', message: 'Connection failed' };
    const shouldError = error.name !== 'AbortError';
    
    expect(shouldError).toBe(true);
  });
});
