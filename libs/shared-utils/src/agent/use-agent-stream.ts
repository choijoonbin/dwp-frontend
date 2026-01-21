// ----------------------------------------------------------------------

import { useMutation } from '@tanstack/react-query';
import { useRef, useState, useEffect, useCallback } from 'react';

import { NX_API_URL } from '../env';
import { getTenantId } from '../tenant-util';
import { useStreamStore } from './stream-store';
import { getAgentContext } from './context-util';
import { getAgentSessionId } from './agent-session';
import { getAccessToken } from '../auth/token-storage';


// ----------------------------------------------------------------------

export type AgentMessage = {
  role: 'user' | 'assistant' | 'thought';
  content: string;
};

export type StreamOptions = {
  onSuccess?: (fullText: string) => void;
  onError?: (error: any) => void;
};

/**
 * Exponential backoff delay calculator
 */
const getBackoffDelay = (attempt: number, baseDelay = 1000): number =>
  Math.min(baseDelay * Math.pow(2, attempt), 30000); // Max 30 seconds

/**
 * Custom hook for Aura-Platform SSE (Server-Sent Events) streaming.
 * Handles text streaming and thinking state with robust chunk parsing.
 * Includes automatic reconnection with exponential backoff and Last-Event-ID support.
 * 
 * Enhanced with:
 * - AbortController cleanup
 * - Stream status tracking (CONNECTING, STREAMING, RECONNECTING, etc.)
 * - Debug information collection
 * - Prevention of stale event handling
 */
export const useAgentStream = () => {
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const lastEventIdRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentStreamIdRef = useRef<string | null>(null); // Prevent stale events
  
  // Stream store for status tracking
  const setStatus = useStreamStore((state) => state.setStatus);
  const setError = useStreamStore((state) => state.setError);
  const setDebug = useStreamStore((state) => state.setDebug);
  const addEventType = useStreamStore((state) => state.addEventType);
  const resetStore = useStreamStore((state) => state.reset);

  // Cleanup on unmount
  useEffect(() => () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      resetStore();
    }, [resetStore]);

  const connectStream = useCallback(
    async ({
      prompt,
      options,
      lastEventId,
      abortController,
      streamId,
    }: {
      prompt: string;
      options?: StreamOptions;
      lastEventId?: string | null;
      abortController?: AbortController;
      streamId: string; // Unique ID for this stream session
    }): Promise<string> => {
      // Check if this stream was aborted
      if (currentStreamIdRef.current !== streamId) {
        throw new Error('Stream aborted');
      }

      const token = getAccessToken();
      const tenantId = getTenantId();
      const agentId = getAgentSessionId();
      const context = getAgentContext();
      const endpoint = '/api/agent/chat-stream';

      // Update debug info
      setDebug({
        endpoint,
        retryCount: reconnectAttemptRef.current,
        lastEventId: lastEventId || undefined,
        startedAt: new Date(),
      });

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'X-Tenant-ID': tenantId,
        'X-Agent-ID': agentId,
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(lastEventId && { 'Last-Event-ID': lastEventId }),
      };

      // Update status to CONNECTING
      setStatus('CONNECTING');

      const response = await fetch(`${NX_API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          context,
        }),
        signal: abortController?.signal,
      });

      if (!response.ok) {
        const errorMsg = `Streaming request failed: ${response.status}`;
        setStatus('ERROR');
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      // Check again if stream was aborted during fetch
      if (currentStreamIdRef.current !== streamId) {
        throw new Error('Stream aborted');
      }

      // Update status to STREAMING
      setStatus('STREAMING');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let buffer = '';
      let currentEventType: string | null = null;

      if (!reader) {
        throw new Error('No reader available');
      }

      try {
        while (true) {
          // Check if stream was aborted before reading
          if (currentStreamIdRef.current !== streamId) {
            throw new Error('Stream aborted');
          }

          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Handle SSE event format: "event: {type}" or "data: {json}"
            if (trimmedLine.startsWith('id: ')) {
              const eventId = trimmedLine.slice(4).trim();
              lastEventIdRef.current = eventId;
              setDebug({ lastEventId: eventId });
              continue;
            }
            
            if (trimmedLine.startsWith('event: ')) {
              currentEventType = trimmedLine.slice(7).trim();
              if (currentEventType) {
                addEventType(currentEventType);
              }
              continue;
            }
            
            if (!trimmedLine.startsWith('data: ')) continue;

            const dataStr = trimmedLine.slice(6);
            
            // Check if stream was aborted before processing
            if (currentStreamIdRef.current !== streamId) {
              throw new Error('Stream aborted');
            }

            if (dataStr === '[DONE]') {
              // Stream completed successfully
              setStatus('COMPLETED');
              setDebug({ completedAt: new Date() });
              break;
            }

            try {
              const data = JSON.parse(dataStr);
              
              // Track event type if available
              if (data.type) {
                addEventType(data.type);
              } else if (currentEventType) {
                addEventType(currentEventType);
              }

              if (data.type === 'thought' || data.type === 'thinking') {
                setIsThinking(true);
              } else if (data.content) {
                setIsThinking(false);
                accumulatedText += data.content;
                setStreamingText(accumulatedText);
              }
            } catch (e) {
              console.error('Error parsing SSE data chunk:', e, dataStr);
              // Don't throw - continue processing other chunks
            }
          }
        }

        // Reset reconnect attempt on successful completion
        reconnectAttemptRef.current = 0;
        options?.onSuccess?.(accumulatedText);
        return accumulatedText;
      } catch (error: any) {
        // Check if this was an abort
        if (error.name === 'AbortError' || error.message === 'Stream aborted') {
          setStatus('ABORTED');
          throw error;
        }
        
        // Network/parsing error
        setStatus('ERROR');
        setError(error.message || 'Stream error');
        throw error;
      } finally {
        setIsThinking(false);
      }
    },
    [setStatus, setError, setDebug, addEventType]
  );

  const mutation = useMutation({
    mutationFn: async ({
      prompt,
      options,
      abortController,
    }: {
      prompt: string;
      options?: StreamOptions;
      abortController?: AbortController;
    }) => {
      // Generate unique stream ID for this session
      const streamId = `stream-${Date.now()}-${Math.random()}`;
      currentStreamIdRef.current = streamId;

      // Abort previous stream if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = abortController || new AbortController();

      // Reset state
      setStreamingText('');
      setIsThinking(true);
      setIsReconnecting(false);
      reconnectAttemptRef.current = 0;
      lastEventIdRef.current = null;
      resetStore();

      const attemptReconnect = async (attempt: number): Promise<string> => {
        // Check if stream was aborted
        if (currentStreamIdRef.current !== streamId) {
          throw new Error('Stream aborted');
        }

        try {
          return await connectStream({
            prompt,
            options,
            lastEventId: lastEventIdRef.current,
            abortController: abortControllerRef.current || undefined,
            streamId,
          });
        } catch (error: any) {
          // Don't retry on abort or if max attempts reached
          if (error.name === 'AbortError' || error.message === 'Stream aborted' || attempt >= 5) {
            if (error.name === 'AbortError' || error.message === 'Stream aborted') {
              setStatus('ABORTED');
            } else {
              setStatus('ERROR');
              setError(`Failed after ${attempt + 1} attempts`);
            }
            options?.onError?.(error);
            throw error;
          }

          // Exponential backoff before retry
          setIsReconnecting(true);
          setStatus('RECONNECTING');
          setDebug({ retryCount: attempt + 1 });
          
          const delay = getBackoffDelay(attempt);
          reconnectAttemptRef.current = attempt + 1;

          await new Promise((resolve) => setTimeout(resolve, delay));

          return attemptReconnect(attempt + 1);
        }
      };

      return attemptReconnect(0);
    },
  });

  return {
    stream: mutation.mutate,
    isLoading: mutation.isPending,
    isThinking,
    isReconnecting,
    streamingText,
    error: mutation.error,
    cancel: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      // Invalidate current stream ID
      currentStreamIdRef.current = null;
      setStatus('ABORTED');
    },
  };
};
