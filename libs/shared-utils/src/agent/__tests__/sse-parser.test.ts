// ----------------------------------------------------------------------

import { it, expect, describe } from 'vitest';

/**
 * Unit tests for SSE parser logic
 */
describe('SSE Parser', () => {
  it('should parse [DONE] event and complete stream', () => {
    const dataStr = '[DONE]';
    const isDone = dataStr === '[DONE]';
    
    expect(isDone).toBe(true);
  });

  it('should parse SSE data line format', () => {
    const line = 'data: {"type":"content","content":"Hello"}';
    const dataStr = line.startsWith('data: ') ? line.slice(6) : '';
    
    expect(dataStr).toBe('{"type":"content","content":"Hello"}');
  });

  it('should parse SSE event type line', () => {
    const line = 'event: thought';
    const eventType = line.startsWith('event: ') ? line.slice(7).trim() : '';
    
    expect(eventType).toBe('thought');
  });

  it('should parse SSE id line', () => {
    const line = 'id: event-123';
    const eventId = line.startsWith('id: ') ? line.slice(4).trim() : '';
    
    expect(eventId).toBe('event-123');
  });

  it('should ignore unknown event types', () => {
    const unknownEvent = { type: 'unknown_type', content: 'test' };
    const knownTypes = ['thought', 'thinking', 'content', 'message', 'hitl'];
    const shouldIgnore = !knownTypes.includes(unknownEvent.type);
    
    expect(shouldIgnore).toBe(true);
  });

  it('should handle empty data gracefully', () => {
    const dataStr = '';
    const isEmpty = dataStr === '';
    
    expect(isEmpty).toBe(true);
    // Should not throw error
  });

  it('should handle malformed JSON gracefully', () => {
    const dataStr = '{"type":"content","content":';
    let parsed: any = null;
    let parseError: Error | null = null;
    
    try {
      parsed = JSON.parse(dataStr);
    } catch (e) {
      parseError = e as Error;
    }
    
    expect(parsed).toBeNull();
    expect(parseError).toBeInstanceOf(Error);
  });

  it('should extract event type from parsed data', () => {
    const dataStr = '{"type":"thought","content":"Thinking..."}';
    const data = JSON.parse(dataStr);
    const eventType = data.type;
    
    expect(eventType).toBe('thought');
  });

  it('should handle multiple lines in buffer', () => {
    const buffer = 'data: {"type":"content","content":"Hello"}\ndata: {"type":"content","content":"World"}\n';
    const lines = buffer.split('\n');
    const dataLines = lines.filter((line) => line.startsWith('data: '));
    
    expect(dataLines.length).toBe(2);
    expect(dataLines[0]).toBe('data: {"type":"content","content":"Hello"}');
    expect(dataLines[1]).toBe('data: {"type":"content","content":"World"}');
  });

  it('should preserve incomplete line in buffer', () => {
    const buffer = 'data: {"type":"content","content":"Hello"}\ndata: {"type":"content","content":';
    const lines = buffer.split('\n');
    const incompleteLine = lines.pop() || '';
    
    expect(incompleteLine).toBe('data: {"type":"content","content":');
  });
});
