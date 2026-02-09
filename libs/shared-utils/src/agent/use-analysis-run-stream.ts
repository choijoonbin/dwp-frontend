/**
 * Synapse Phase2 — Analysis Run Stream
 * 1. POST /api/synapse/cases/{caseId}/analysis-runs → 202 + { runId, streamUrl, status: ACCEPTED }
 * 2. GET {streamUrl} 또는 /api/synapse/analysis-runs/{runId}/stream → SSE (started, step, completed, failed)
 * @see docs/job/BE_FOLLOWUP_QUESTIONS_PHASE2.md
 * @see docs/job/AURA_PHASE2_SERVER_CHANGES.md
 */

import { useRef, useState, useEffect, useCallback } from 'react';

import { NX_API_URL } from '../env';
import { getTenantId } from '../tenant-util';
import { useStreamStore } from './stream-store';
import { generateTraceId } from '../trace-util';
import { getAccessToken } from '../auth/token-storage';
import { createAnalysisRun, type CreateAnalysisRunBody } from '../api/synapse-analysis-api';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type AnalysisStreamEventType = 'started' | 'step' | 'completed' | 'failed';

export type AnalysisStreamOptions = {
  /** runId 전달 — 완료 시 analysis/action-proposals refetch용 */
  onSuccess?: (runId: string) => void;
  onError?: (error: Error) => void;
  /** BE 요청 body: evidenceSnapshot, options(model, policyVersion) — Aura Phase2 */
  payload?: Omit<CreateAnalysisRunBody, 'caseId'>;
};

export type AnalysisStepEvent = {
  label?: string;
  detail?: string;
  percent?: number;
  [key: string]: unknown;
};

const STREAM_TIMEOUT_MS = 65_000;

// ----------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------

export const useAnalysisRunStream = () => {
  const [status, setLocalStatus] = useState<'idle' | 'connecting' | 'streaming' | 'completed' | 'failed' | 'aborted'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stepProgress, setStepProgress] = useState<{ label?: string; detail?: string; percent?: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStatus = useStreamStore((state) => state.setStatus);
  const setError = useStreamStore((state) => state.setError);
  const setDebug = useStreamStore((state) => state.setDebug);
  const addEventType = useStreamStore((state) => state.addEventType);
  const resetStore = useStreamStore((state) => state.reset);

  const clearStreamTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(
    () => () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      clearStreamTimeout();
      resetStore();
    },
    [clearStreamTimeout, resetStore]
  );

  const startStream = useCallback(
    async (caseId: string, options?: AnalysisStreamOptions) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      setLocalStatus('connecting');
      setErrorMessage(null);
      resetStore();
      setStepProgress(null);

      try {
        const tenantId = getTenantId();
        const token = getAccessToken();
        const res = await createAnalysisRun(caseId, options?.payload);
        if (res.status !== 'SUCCESS' && res.status !== 'OK') {
          throw new Error(res.message ?? 'Failed to start analysis');
        }
        const runId = res.data?.runId;
        if (!runId) {
          throw new Error('runId not received from analysis-runs');
        }
        // BE returns streamUrl (e.g. /aura/analysis-runs/{runId}/stream); fallback for proxy path
        const streamUrl =
          res.data?.streamUrl ?? `/api/synapse/analysis-runs/${runId}/stream`;
        const url = streamUrl.startsWith('http') ? streamUrl : `${NX_API_URL}${streamUrl}`;

        setDebug({ endpoint: url, startedAt: new Date() });
        setStatus('CONNECTING');

        const headers: Record<string, string> = {
          Accept: 'text/event-stream',
          'X-Tenant-ID': tenantId,
          'X-Trace-ID': generateTraceId(),
          ...(token && { Authorization: `Bearer ${token}` }),
        };

        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Stream failed: ${response.status}`);
        }

        setLocalStatus('streaming');
        setStatus('STREAMING');

        timeoutRef.current = setTimeout(() => {
          setLocalStatus('failed');
          setStatus('ERROR');
          setError('분석이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.');
          setErrorMessage('분석이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.');
          options?.onError?.(new Error('Stream timeout'));
        }, STREAM_TIMEOUT_MS);

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error('No reader');

        let buffer = '';
        let currentEventType: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('event:')) {
              currentEventType = trimmed.slice(6).trim();
              if (currentEventType) addEventType(currentEventType);
              continue;
            }
            if (!trimmed.startsWith('data:')) continue;

            const dataStr = trimmed.slice(5).trim();

            if (currentEventType === 'started') {
              addEventType('started');
            } else if (currentEventType === 'step') {
              addEventType('step');
              try {
                const parsed = dataStr ? (JSON.parse(dataStr) as AnalysisStepEvent) : {};
                setStepProgress({
                  label: parsed.label,
                  detail: parsed.detail,
                  percent: parsed.percent,
                });
              } catch {
                // ignore parse error
              }
            } else if (currentEventType === 'completed') {
              clearStreamTimeout();
              setLocalStatus('completed');
              setStatus('COMPLETED');
              setStepProgress(null);
              setDebug({ completedAt: new Date() });
              options?.onSuccess?.(runId);
              return;
            } else if (currentEventType === 'failed') {
              clearStreamTimeout();
              let msg = '분석이 실패했습니다.';
              try {
                const parsed = JSON.parse(dataStr) as Record<string, unknown>;
                if (typeof parsed.message === 'string') msg = parsed.message;
              } catch {
                if (typeof dataStr === 'string' && dataStr.length > 0) {
                  msg = dataStr;
                }
              }
              setLocalStatus('failed');
              setStatus('ERROR');
              setError(msg);
              setErrorMessage(msg);
              options?.onError?.(new Error(msg));
              return;
            }
          }
        }

        clearStreamTimeout();
        setLocalStatus('failed');
        setStatus('ERROR');
        const msg = '분석이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.';
        setError(msg);
        setErrorMessage(msg);
        options?.onError?.(new Error(msg));
      } catch (err) {
        clearStreamTimeout();
        if (err instanceof Error && err.name === 'AbortError') {
          setLocalStatus('aborted');
          setStatus('ABORTED');
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        setLocalStatus('failed');
        setStatus('ERROR');
        setError(message);
        setErrorMessage(message);
        options?.onError?.(err instanceof Error ? err : new Error(message));
      }
    },
    [setStatus, setError, setDebug, addEventType, resetStore, clearStreamTimeout]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    clearStreamTimeout();
    setLocalStatus('aborted');
    setStatus('ABORTED');
  }, [setStatus, clearStreamTimeout]);

  return {
    startStream,
    cancel,
    status: status as 'idle' | 'connecting' | 'streaming' | 'completed' | 'failed' | 'aborted',
    errorMessage,
    stepProgress,
  };
};
