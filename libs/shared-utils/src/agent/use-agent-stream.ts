// ----------------------------------------------------------------------

import { useMutation } from '@tanstack/react-query';
import { useRef, useState, useCallback } from 'react';

import { NX_API_URL } from '../env';
import { getTenantId } from '../tenant-util';
import { getAgentContext } from './context-util';
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
 */
export const useAgentStream = () => {
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const lastEventIdRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const connectStream = useCallback(
    async ({
      prompt,
      options,
      lastEventId,
      abortController,
    }: {
      prompt: string;
      options?: StreamOptions;
      lastEventId?: string | null;
      abortController?: AbortController;
    }): Promise<string> => {
      const token = getAccessToken();
      const tenantId = getTenantId();
      const context = getAgentContext();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream', // SSE 요청 시 Accept 헤더 포함
        'X-Tenant-ID': tenantId,
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(lastEventId && { 'Last-Event-ID': lastEventId }),
      };

      const response = await fetch(`${NX_API_URL}/api/agent/chat-stream`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          context,
        }),
        signal: abortController?.signal,
      });

      if (!response.ok) {
        throw new Error(`Streaming request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';
      let buffer = '';

      if (!reader) {
        throw new Error('No reader available');
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            
            // Handle SSE event format: "event: {type}" or "data: {json}"
            if (trimmedLine.startsWith('id: ')) {
              // Store Last-Event-ID for reconnection
              lastEventIdRef.current = trimmedLine.slice(4).trim();
              continue;
            }
            
            if (trimmedLine.startsWith('event: ')) {
              // Event type is stored for next data line
              continue;
            }
            
            if (!trimmedLine.startsWith('data: ')) continue;

            const dataStr = trimmedLine.slice(6);
            if (dataStr === '[DONE]') break;

            try {
              const data = JSON.parse(dataStr);

              if (data.type === 'thought' || data.type === 'thinking') {
                setIsThinking(true);
              } else if (data.content) {
                setIsThinking(false);
                accumulatedText += data.content;
                setStreamingText(accumulatedText);
              }
            } catch (e) {
              console.error('Error parsing SSE data chunk:', e, dataStr);
            }
          }
        }

        // Reset reconnect attempt on successful completion
        reconnectAttemptRef.current = 0;
        options?.onSuccess?.(accumulatedText);
        return accumulatedText;
      } catch (error: any) {
        // Only retry on network errors, not on abort
        if (error.name === 'AbortError') {
          throw error;
        }
        throw error;
      } finally {
        setIsThinking(false);
      }
    },
    []
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
      setStreamingText('');
      setIsThinking(true);
      setIsReconnecting(false);
      reconnectAttemptRef.current = 0;
      lastEventIdRef.current = null;

      abortControllerRef.current = abortController || new AbortController();

      const attemptReconnect = async (attempt: number): Promise<string> => {
        try {
          return await connectStream({
            prompt,
            options,
            lastEventId: lastEventIdRef.current,
            abortController: abortControllerRef.current || undefined,
          });
        } catch (error: any) {
          // Don't retry on abort or if max attempts reached
          if (error.name === 'AbortError' || attempt >= 5) {
            options?.onError?.(error);
            throw error;
          }

          // Exponential backoff before retry
          setIsReconnecting(true);
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
    },
  };
};
