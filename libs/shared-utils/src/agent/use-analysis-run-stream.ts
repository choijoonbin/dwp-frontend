/**
 * Synapse Phase3 — Analysis Run Stream
 * 1. POST /api/synapse/cases/{caseId}/analysis-runs → 200/202 + { runId, streamUrl/streamPath }
 * 2. 연결 규칙 (옵션 B 운영 기본):
 *    - BE가 상대 경로(프록시)를 내려주면 → NX_API_URL 접두 → 항상 BE 프록시로 연결 (운영)
 *    - fallback 없을 때: /api/synapse/analysis-runs/{runId}/stream (BE 프록시 경로)
 *    - 절대 URL(http/https)은 BE가 dev/로컬 feature flag로만 내려줄 때(옵션 A). FE는 구분 없이 그대로 사용.
 * 3. SSE: started | step | agent | completed | failed; data: [DONE] treated as completed.
 * @see docs/job/PHASE3_HANDOFF_BY_SYSTEM.md
 */

import { useRef, useState, useEffect, useCallback } from 'react';

import { NX_API_URL } from '../env';
import { getTenantId } from '../tenant-util';
import { useStreamStore } from './stream-store';
import { getAccessToken } from '../auth/token-storage';
import { showRagLearnedToast } from '../toast/toast-store';
import { buildStreamRequestHeaders } from './stream-request-headers';
import { createAnalysisRun, type CreateAnalysisRunBody } from '../api/synapse-analysis-api';

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

export type AnalysisStreamEventType = 'started' | 'step' | 'agent' | 'completed' | 'failed';

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

export type AnalysisAgentEvent = {
  agent?: string;
  message?: string;
  percent?: number;
  [key: string]: unknown;
};

const STREAM_TIMEOUT_MS = 65_000;

/** cleanup 시 즉시 abort하면 Strict Mode 등 remount 시 스트림이 끊김. 지연 후 abort하고, remount 시 예약 취소.
 *  BE 로그상 첫 줄 수신 직후(1ms 내) 끊김 → unmount 시 예약한 지연 abort가 remount 전에 실행된 경우로 해석되므로 500ms로 여유 둠. */
const CLEANUP_ABORT_DELAY_MS = 500;

let pendingCleanupAbortId: ReturnType<typeof setTimeout> | null = null;

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
  const addEventLogLine = useStreamStore((state) => state.addEventLogLine);
  const addTimelineStep = useStreamStore((state) => state.addTimelineStep);
  const resetStore = useStreamStore((state) => state.reset);

  const clearStreamTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (pendingCleanupAbortId) {
      clearTimeout(pendingCleanupAbortId);
      pendingCleanupAbortId = null;
    }
    return () => {
      clearStreamTimeout();
      resetStore();
      const controller = abortControllerRef.current;
      pendingCleanupAbortId = setTimeout(() => {
        pendingCleanupAbortId = null;
        if (controller) controller.abort();
      }, CLEANUP_ABORT_DELAY_MS);
    };
  }, [clearStreamTimeout, resetStore]);

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
        // 옵션 B(운영): BE가 프록시 경로(상대)만 내려주면 → NX_API_URL 접두 → 항상 BE 프록시로 연결.
        // 옵션 A(dev/로컬): BE가 절대 URL을 내려주면 그대로 사용. fallback = BE 프록시 경로.
        const streamUrlOrPath =
          res.data?.streamUrl ??
          res.data?.streamPath ??
          `/api/synapse/analysis-runs/${runId}/stream`;
        const url =
          streamUrlOrPath.startsWith('http://') || streamUrlOrPath.startsWith('https://')
            ? streamUrlOrPath
            : `${NX_API_URL}${streamUrlOrPath}`;

        setDebug({ endpoint: url, startedAt: new Date() });
        setStatus('CONNECTING');

        const headers = buildStreamRequestHeaders({ tenantId, token });

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

          let lineIndex = 0;
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length > 0) {
              addEventLogLine(trimmed);
              lineIndex += 1;
              // 청크 내에서도 화면이 실시간으로 갱신되도록 N줄마다 yield (한 번에 보이지 않게)
              if (lineIndex % 2 === 0) {
                await new Promise((r) => setTimeout(r, 0));
              }
            }

            if (trimmed.startsWith('event:')) {
              currentEventType = trimmed.slice(6).trim();
              if (currentEventType) addEventType(currentEventType);
              continue;
            }
            if (!trimmed.startsWith('data:')) continue;

            let dataStr = trimmed.slice(5).trim();

            // BE가 "data:event: xxx" / "data:data: {...}" 형태로 보낼 때 정규화 (표준은 event:/data: 별도 라인)
            if (dataStr.startsWith('event:')) {
              currentEventType = dataStr.slice(6).trim();
              if (currentEventType) addEventType(currentEventType);
              continue;
            }
            if (dataStr.startsWith('data: ')) {
              dataStr = dataStr.slice(6);
            }
            // SSE 주석 ": ..." 은 이미 addEventLogLine 됨, payload 아님
            if (dataStr.startsWith(':')) continue;

            // Phase3: data: [DONE] from Aura signals successful end when no event:completed
            if (dataStr === '[DONE]') {
              clearStreamTimeout();
              setLocalStatus('completed');
              setStatus('COMPLETED');
              setStepProgress(null);
              setDebug({ completedAt: new Date() });
              options?.onSuccess?.(runId);
              return;
            }

            if (currentEventType === 'started') {
              addEventType('started');
              addTimelineStep({ type: 'started' });
            } else if (currentEventType === 'step') {
              addEventType('step');
              try {
                const parsed = dataStr ? (JSON.parse(dataStr) as AnalysisStepEvent) : {};
                setStepProgress({
                  label: parsed.label,
                  detail: parsed.detail,
                  percent: parsed.percent,
                });
                addTimelineStep({
                  type: 'step',
                  label: parsed.label,
                  detail: parsed.detail,
                  percent: parsed.percent,
                });
              } catch {
                // ignore parse error
              }
            } else if (currentEventType === 'agent') {
              addEventType('agent');
              try {
                const parsed = dataStr ? (JSON.parse(dataStr) as AnalysisAgentEvent) : {};
                setStepProgress({
                  label: parsed.agent ?? parsed.message,
                  detail: parsed.message,
                  percent: parsed.percent,
                });
                addTimelineStep({
                  type: 'step',
                  label: parsed.agent ?? parsed.message,
                  detail: parsed.message,
                  percent: parsed.percent,
                });
              } catch {
                // ignore parse error
              }
            } else if (currentEventType === 'completed') {
              addTimelineStep({ type: 'completed' });
              clearStreamTimeout();
              setLocalStatus('completed');
              setStatus('COMPLETED');
              setStepProgress(null);
              setDebug({ completedAt: new Date() });
              options?.onSuccess?.(runId);
              return;
            } else if (currentEventType === 'rag_learned' || currentEventType === 'rag_status') {
              try {
                const parsed = dataStr ? (JSON.parse(dataStr) as Record<string, unknown>) : {};
                if (parsed.learned === true || parsed.status === 'learned' || currentEventType === 'rag_learned') {
                  showRagLearnedToast();
                }
              } catch {
                showRagLearnedToast();
              }
            } else if (currentEventType === 'failed') {
              clearStreamTimeout();
              let msg = '분석이 실패했습니다.';
              let retryable: boolean | undefined;
              let failedStage: string | undefined;
              try {
                const parsed = JSON.parse(dataStr) as Record<string, unknown>;
                // Aura §13 + PHASE3_FOLLOWUP: error는 string 또는 { message, stage } 객체. stage는 Aura 기준(rag/llm/pipeline/background) 등 — FE는 문자열 그대로 통과.
                const err = parsed.error;
                if (typeof err === 'string') {
                  msg = err;
                } else if (err && typeof err === 'object' && typeof (err as { message?: string }).message === 'string') {
                  msg = (err as { message: string }).message;
                  failedStage = typeof (err as { stage?: unknown }).stage === 'string' ? (err as { stage: string }).stage : undefined;
                } else if (typeof parsed.message === 'string') {
                  msg = parsed.message;
                }
                retryable = parsed.retryable === true;
                setDebug({ errorMessage: msg, retryable, failedStage });
              } catch {
                if (typeof dataStr === 'string' && dataStr.length > 0) {
                  msg = dataStr;
                }
              }
              addTimelineStep({ type: 'failed', message: msg, stage: failedStage });
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
    [setStatus, setError, setDebug, addEventType, addEventLogLine, addTimelineStep, resetStore, clearStreamTimeout]
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
