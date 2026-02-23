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
import { buildStreamRequestHeaders } from './stream-request-headers';
import { showToast, showRagLearnedToast } from '../toast/toast-store';
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
  /** ANALYSIS_STARTED 푸시로 받은 stream_url — 지정 시 POST 생략, 즉시 fetch로 SSE 구독 (Aura 2초 대기 내 연결) */
  streamUrl?: string;
  /** 자동 구독 시 runId (푸시 payload에서 전달) */
  runId?: string;
  /** 자동 검토 시작 시 타임라인 상단 안내 문구 노출 */
  isAutoStarted?: boolean;
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
  const autoStartedBannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setStatus = useStreamStore((state) => state.setStatus);
  const setError = useStreamStore((state) => state.setError);
  const setDebug = useStreamStore((state) => state.setDebug);
  const addEventType = useStreamStore((state) => state.addEventType);
  const addEventLogLine = useStreamStore((state) => state.addEventLogLine);
  const addTimelineStep = useStreamStore((state) => state.addTimelineStep);
  const setStreamingThought = useStreamStore((state) => state.setStreamingThought);
  const setLiveTargetBuzei = useStreamStore((state) => state.setLiveTargetBuzei);
  const addLiveViolationBuzei = useStreamStore((state) => state.addLiveViolationBuzei);
  const resetStore = useStreamStore((state) => state.reset);
  const setAutoStartedBanner = useStreamStore((state) => state.setAutoStartedBanner);

  const normalizeBuzei = useCallback((v: string | number | undefined): string | null => {
    if (v == null || String(v).trim() === '') return null;
    return String(v).trim().padStart(3, '0');
  }, []);

  const clearStreamTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (autoStartedBannerTimeoutRef.current) {
      clearTimeout(autoStartedBannerTimeoutRef.current);
      autoStartedBannerTimeoutRef.current = null;
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
      const isAutoConnect = !!(options?.streamUrl != null && options.streamUrl.trim() !== '');
      console.log('[Workbench SSE] startStream 호출', {
        caseId,
        isAutoConnect,
        isAutoStarted: options?.isAutoStarted,
        runId: options?.runId,
      });
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      setLocalStatus('connecting');
      setErrorMessage(null);
      resetStore();
      setStepProgress(null);

      let runId: string;
      let url: string;
      const isAutoStarted = options?.isAutoStarted === true;

      if (isAutoStarted) {
        setAutoStartedBanner(true);
        if (autoStartedBannerTimeoutRef.current) clearTimeout(autoStartedBannerTimeoutRef.current);
        autoStartedBannerTimeoutRef.current = setTimeout(() => {
          autoStartedBannerTimeoutRef.current = null;
          setAutoStartedBanner(false);
        }, 5000);
      }

      try {
        const tenantId = getTenantId();
        const token = getAccessToken();

        if (options?.streamUrl != null && options.streamUrl.trim() !== '') {
          runId = options.runId?.trim() ?? '';
          const streamUrlOrPath = options.streamUrl.trim();
          url =
            streamUrlOrPath.startsWith('http://') || streamUrlOrPath.startsWith('https://')
              ? streamUrlOrPath
              : `${NX_API_URL}${streamUrlOrPath}`;
        } else {
          const res = await createAnalysisRun(caseId, options?.payload);
          if (res.status !== 'SUCCESS' && res.status !== 'OK') {
            throw new Error(res.message ?? 'Failed to start analysis');
          }
          const dataRunId = res.data?.runId;
          if (!dataRunId) {
            throw new Error('runId not received from analysis-runs');
          }
          runId = dataRunId;
          const streamUrlOrPath =
            res.data?.streamUrl ??
            res.data?.streamPath ??
            `/api/synapse/analysis-runs/${runId}/stream`;
          url =
            streamUrlOrPath.startsWith('http://') || streamUrlOrPath.startsWith('https://')
              ? streamUrlOrPath
              : `${NX_API_URL}${streamUrlOrPath}`;
        }

        setDebug({ endpoint: url, startedAt: new Date() });
        setStatus('CONNECTING');

        const headers = buildStreamRequestHeaders({ tenantId, token });

        console.log('[Workbench SSE] SSE fetch 시작', { url: url.slice(0, 100) });
        const response = await fetch(url, {
          method: 'GET',
          headers,
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          console.log('[Workbench SSE] SSE 연결 실패 (HTTP)', { status: response.status, url: url.slice(0, 80) });
          let errMessage = `Stream failed: ${response.status}`;
          if (response.status === 400) {
            try {
              const body = (await response.json().catch(() => null)) as { message?: string } | null;
              errMessage = (body?.message && typeof body.message === 'string') ? body.message : errMessage;
              showToast(errMessage, 'error');
              console.error('[SSE] 400 Bad Request:', errMessage);
            } catch {
              showToast(errMessage, 'error');
              console.error('[SSE] 400 Bad Request:', errMessage);
            }
          }
          throw new Error(errMessage);
        }

        setLocalStatus('streaming');
        setStatus('STREAMING');

        console.log('[Workbench SSE] SSE 연결 성공, 스트리밍 시작', { caseId, runId });
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
              setStreamingThought(null);
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
                const targetBuzeiVal = (parsed.target_buzei ?? parsed.targetBuzei) as string | number | undefined;
                const buzeiNorm = normalizeBuzei(targetBuzeiVal);
                if (buzeiNorm) {
                  setLiveTargetBuzei(buzeiNorm);
                  addLiveViolationBuzei(buzeiNorm);
                }
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
            } else if (currentEventType === 'thought_pending') {
              addEventType('thought_pending');
              try {
                const parsed = dataStr ? (JSON.parse(dataStr) as { type?: string; step?: number }) : {};
                setStreamingThought({
                  type: parsed.type ?? 'reasoning',
                  step: parsed.step,
                  pending: true,
                });
              } catch {
                setStreamingThought({ type: 'reasoning', pending: true });
              }
            } else if (currentEventType === 'agent' || currentEventType === 'AGENT_STREAM' || currentEventType === 'thought') {
              addEventType(currentEventType);
              try {
                const parsed = dataStr ? (JSON.parse(dataStr) as AnalysisAgentEvent & { message?: string; content?: string; target_buzei?: string | number; targetBuzei?: string | number }) : {};
                const targetBuzeiVal = parsed.target_buzei ?? parsed.targetBuzei;
                const buzeiNorm = normalizeBuzei(targetBuzeiVal);
                if (buzeiNorm) {
                  setLiveTargetBuzei(buzeiNorm);
                  addLiveViolationBuzei(buzeiNorm);
                }
                const message = parsed.message ?? parsed.content ?? (parsed as { text?: string }).text ?? '';
                setStepProgress({
                  label: parsed.agent ?? parsed.message,
                  detail: message || parsed.message,
                  percent: parsed.percent,
                });
                addTimelineStep({
                  type: 'step',
                  label: parsed.agent ?? parsed.message,
                  detail: message || parsed.message,
                  percent: parsed.percent,
                });
                setStreamingThought(
                  message
                    ? { type: (parsed as { type?: string }).type ?? 'reasoning', step: (parsed as { step?: number }).step, content: message, pending: false }
                    : null
                );
              } catch {
                // ignore parse error
              }
            } else if (currentEventType === 'completed') {
              addTimelineStep({ type: 'completed' });
              clearStreamTimeout();
              setLocalStatus('completed');
              setStatus('COMPLETED');
              setStepProgress(null);
              setStreamingThought(null);
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
          console.log('[Workbench SSE] SSE 중단됨 (Abort)');
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        console.log('[Workbench SSE] SSE 오류', { message, caseId });
        setLocalStatus('failed');
        setStatus('ERROR');
        setError(message);
        setErrorMessage(message);
        options?.onError?.(err instanceof Error ? err : new Error(message));
      }
    },
    [setStatus, setError, setDebug, setAutoStartedBanner, addEventType, addEventLogLine, addTimelineStep, setStreamingThought, setLiveTargetBuzei, addLiveViolationBuzei, normalizeBuzei, resetStore, clearStreamTimeout]
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
