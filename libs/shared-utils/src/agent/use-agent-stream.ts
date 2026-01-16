// ----------------------------------------------------------------------

import { useState } from 'react';
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
 * Handles text streaming and thinking state with robust chunk parsing.
 */
export const useAgentStream = () => {
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);

  const mutation = useMutation({
    mutationFn: async ({ 
      prompt, 
      options,
      abortController 
    }: { 
      prompt: string; 
      options?: StreamOptions;
      abortController?: AbortController;
    }) => {
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
        signal: abortController?.signal,
      });

      if (!response.ok) {
        throw new Error('Streaming request failed');
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
          // Keep the last partial line in the buffer
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

            const dataStr = trimmedLine.slice(6);
            if (dataStr === '[DONE]') break;

            try {
              const data = JSON.parse(dataStr);
              
              if (data.type === 'thought') {
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
