// ----------------------------------------------------------------------

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';

import { NX_API_URL } from '../env';
import { getTenantId } from '../tenant-util';
import { getAccessToken } from '../auth/token-storage';
import { getAgentContext } from './context-util';

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
 * Custom hook for Aura-Platform SSE (Server-Sent Events) streaming.
 * Handles text streaming and thinking state.
 */
export const useAgentStream = () => {
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({ prompt, options }: { prompt: string; options?: StreamOptions }) => {
      setStreamingText('');
      setIsThinking(true);

      const token = getAccessToken();
      const tenantId = getTenantId();
      const context = getAgentContext();

      const response = await fetch(`${NX_API_URL}/api/agent/chat-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId,
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          prompt,
          context,
        }),
      });

      if (!response.ok) {
        throw new Error('Streaming request failed');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      if (!reader) {
        throw new Error('No reader available');
      }

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          
          // Basic SSE parsing logic
          // Format: event: message\ndata: {"content": "..."}\n\n
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'thought') {
                  // If backend sends thought trace
                  setIsThinking(true);
                } else if (data.content) {
                  setIsThinking(false);
                  accumulatedText += data.content;
                  setStreamingText(accumulatedText);
                }
              } catch (e) {
                // Ignore parse errors for incomplete chunks
              }
            }
          }
        }
        
        options?.onSuccess?.(accumulatedText);
        return accumulatedText;
      } catch (error) {
        options?.onError?.(error);
        throw error;
      } finally {
        setIsThinking(false);
      }
    },
  });

  return {
    stream: mutation.mutate,
    isLoading: mutation.isPending,
    isThinking,
    streamingText,
    error: mutation.error,
  };
};
