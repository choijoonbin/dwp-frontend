/**
 * Synapse Case Detail용 Agent Stream (SSE)
 * POST /api/synapse/agent-tools/agents/finance/stream
 * caseId 기반, hitl 이벤트 시 onHitlRequest 콜백
 *
 * Last-Event-ID (P2-1, Aura 계약 정합):
 * - 스트림 끊김 시 재연결 요청에 Last-Event-ID 헤더 전달.
 * - 재연결 시 새 스트림. id는 last_id+1로 연속. replay 미지원.
 * - HITL approve/reject 후 resume과 무관 — 동일 연결 유지.
 * - 저장: id: 파싱 → lastEventIdRef. 전송: attemptReconnect 시 headers.
 */

import { useRef, useState, useEffect, useCallback } from 'react';

import { NX_API_URL } from '../env';
import { getTenantId } from '../tenant-util';
import { useStreamStore } from './stream-store';
import { getAgentSessionId } from './agent-session';
import { getUserId } from '../auth/user-id-storage';
import { getAccessToken } from '../auth/token-storage';
import { buildStreamRequestHeaders } from './stream-request-headers';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type SynapseStreamEvent = {
  type: 'thought' | 'thinking' | 'content' | 'message' | 'hitl' | 'analysis' | 'plan' | 'tool';
  content?: string;
  requestId?: string;
  description?: string;
  message?: string;
  context?: unknown;
  actionType?: string;
};

export type HitlPayload = {
  message?: string;
  context?: unknown;
  actionType?: string;
};

export type SynapseStreamOptions = {
  onHitlRequest?: (requestId: string, payload?: HitlPayload) => void;
  onSuccess?: (fullText: string) => void;
  onError?: (error: Error) => void;
};

const getBackoffDelay = (attempt: number, baseDelay = 1000): number =>
  Math.min(baseDelay * Math.pow(2, attempt), 30000);

// ----------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------

export const useSynapseAgentStream = () => {
  const [events, setEvents] = useState<SynapseStreamEvent[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const lastEventIdRef = useRef<string | null>(null);
  const reconnectAttemptRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentStreamIdRef = useRef<string | null>(null);

  const setStatus = useStreamStore((state) => state.setStatus);
  const setError = useStreamStore((state) => state.setError);
  const setDebug = useStreamStore((state) => state.setDebug);
  const addEventType = useStreamStore((state) => state.addEventType);
  const resetStore = useStreamStore((state) => state.reset);

  useEffect(
    () => () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      resetStore();
    },
    [resetStore]
  );

  const connectStream = useCallback(
    async ({
      caseId,
      options,
      lastEventId,
      abortController,
      streamId,
    }: {
      caseId: string;
      options?: SynapseStreamOptions;
      lastEventId?: string | null;
      abortController?: AbortController;
      streamId: string;
    }): Promise<string> => {
      if (currentStreamIdRef.current !== streamId) {
        throw new Error('Stream aborted');
      }

      const token = getAccessToken();
      const tenantId = getTenantId();
      const agentId = getAgentSessionId();
      const userId = getUserId();
      const endpoint = '/api/synapse/agent-tools/agents/finance/stream';

      setDebug({
        endpoint,
        retryCount: reconnectAttemptRef.current,
        lastEventId: lastEventId || undefined,
        startedAt: new Date(),
      });

      const headers = buildStreamRequestHeaders({
        tenantId,
        token,
        contentType: 'application/json',
        agentId,
        userId: userId ?? undefined,
        lastEventId: lastEventId || undefined,
      });

      setStatus('CONNECTING');

      const requestBody = {
        prompt: '이 케이스를 분석하고 조치를 제안해 주세요',
        context: caseId ? { caseId } : {},
      };

      const response = await fetch(`${NX_API_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: abortController?.signal,
      });

      if (!response.ok) {
        const errorMsg = `Streaming request failed: ${response.status}`;
        setStatus('ERROR');
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      if (currentStreamIdRef.current !== streamId) {
        throw new Error('Stream aborted');
      }

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

            if (trimmedLine.startsWith('id: ')) {
              const eventId = trimmedLine.slice(4).trim();
              lastEventIdRef.current = eventId;
              setDebug({ lastEventId: eventId });
              continue;
            }

            if (trimmedLine.startsWith('event: ')) {
              currentEventType = trimmedLine.slice(7).trim();
              if (currentEventType) addEventType(currentEventType);
              continue;
            }

            if (!trimmedLine.startsWith('data: ')) continue;

            const dataStr = trimmedLine.slice(6);

            if (currentStreamIdRef.current !== streamId) {
              throw new Error('Stream aborted');
            }

            if (dataStr === '[DONE]') {
              setStatus('COMPLETED');
              setDebug({ completedAt: new Date() });
              break;
            }

            try {
              const data = JSON.parse(dataStr) as Record<string, unknown>;
              const type = (data.type as string) || currentEventType || 'content';

              if (type === 'thought' || type === 'thinking') {
                setIsThinking(true);
                setEvents((prev) => [
                  ...prev,
                  { type: type as SynapseStreamEvent['type'], content: data.content as string },
                ]);
              } else if (type === 'hitl') {
                setIsThinking(false);
                const requestId = data.requestId as string | undefined;
                const message = (data.message as string) ?? (data.description as string);
                const context = data.context as HitlPayload['context'];
                const actionType = data.actionType as string | undefined;
                if (requestId) {
                  setEvents((prev) => [
                    ...prev,
                    { type: 'hitl', requestId, description: message, message, context, actionType },
                  ]);
                  options?.onHitlRequest?.(requestId, { message, context, actionType });
                }
              } else if (data.content) {
                setIsThinking(false);
                accumulatedText += String(data.content);
                setStreamingText(accumulatedText);
                setEvents((prev) => [
                  ...prev,
                  { type: (type as SynapseStreamEvent['type']) || 'content', content: String(data.content) },
                ]);
              }
            } catch {
              // Skip parse errors
            }
          }
        }

        reconnectAttemptRef.current = 0;
        options?.onSuccess?.(accumulatedText);
        return accumulatedText;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (err.name === 'AbortError' || err.message === 'Stream aborted') {
          setStatus('ABORTED');
          throw err;
        }
        setStatus('ERROR');
        setError(err.message || 'Stream error');
        throw err;
      } finally {
        setIsThinking(false);
      }
    },
    [setStatus, setError, setDebug, addEventType]
  );

  const startStream = useCallback(
    (caseId: string, options?: SynapseStreamOptions) => {
      const streamId = `synapse-stream-${Date.now()}-${Math.random()}`;
      currentStreamIdRef.current = streamId;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setEvents([]);
      setStreamingText('');
      setIsThinking(true);
      setIsReconnecting(false);
      reconnectAttemptRef.current = 0;
      lastEventIdRef.current = null;
      resetStore();

      const attemptReconnect = (attempt: number): Promise<string> => {
        if (currentStreamIdRef.current !== streamId) {
          return Promise.reject(new Error('Stream aborted'));
        }

        return connectStream({
          caseId,
          options,
          lastEventId: lastEventIdRef.current,
          abortController: abortControllerRef.current ?? undefined,
          streamId,
        }).catch((err: Error) => {
          if (
            err.name === 'AbortError' ||
            err.message === 'Stream aborted' ||
            attempt >= 5
          ) {
            options?.onError?.(err);
            throw err;
          }

          setIsReconnecting(true);
          setStatus('RECONNECTING');
          setDebug({ retryCount: attempt + 1 });
          reconnectAttemptRef.current = attempt + 1;
          const delay = getBackoffDelay(attempt);

          return new Promise<string>((resolve, reject) => {
            setTimeout(() => {
              attemptReconnect(attempt + 1).then(resolve).catch(reject);
            }, delay);
          });
        });
      };

      return attemptReconnect(0);
    },
    [connectStream, resetStore, setStatus, setDebug]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    currentStreamIdRef.current = null;
    setIsReconnecting(false);
    setStatus('ABORTED');
  }, [setStatus]);

  return {
    startStream,
    cancel,
    events,
    streamingText,
    isThinking,
    isReconnecting,
  };
};
