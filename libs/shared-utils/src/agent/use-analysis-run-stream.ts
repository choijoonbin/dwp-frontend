/**
 * Synapse Phase3 — Analysis Run Stream
 * 1. POST /api/synapse/cases/{caseId}/analysis-runs → 200/202 + { runId, streamUrl/streamPath }
 * 2. 연결 규칙 (옵션 B 운영 기본):
 *    - BE가 상대 경로(프록시)를 내려주면 → NX_API_URL 접두 → 항상 BE 프록시로 연결 (운영)
 *    - fallback 없을 때: /api/synapse/analysis-runs/{runId}/stream (BE 프록시 경로)
 *    - 절대 URL(http/https)은 BE가 dev/로컬 feature flag로만 내려줄 때(옵션 A). FE는 구분 없이 그대로 사용.
 * 3. SSE: started | step | agent | completed | failed; data: [DONE] treated as completed.
 * Aura 요청: 202 응답 runId로만 GET stream 연결, [DONE]/failed 수신 시까지 유지, 언마운트 시에만 abort. 잘못된 runId 재연결 금지.
 * @see docs/reference/AURA_STREAM_AND_TEST_FE_RESPONSE.md
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
/** Aura 요청: data: [DONE] 또는 failed 수신 시까지 연결 유지. 이 타임아웃은 마지막 수단(last-resort)용. Gateway/프록시는 스트리밍 경로 타임아웃을 넉넉히 두거나 제외 권장. */

/** cleanup 시 즉시 abort하면 Strict Mode 등 remount 시 스트림이 끊김. 지연 후 abort하고, remount 시 예약 취소.
 *  BE 로그상 첫 줄 수신 직후(1ms 내) 끊김 → unmount 시 예약한 지연 abort가 remount 전에 실행된 경우로 해석되므로 500ms로 여유 둠. */
const CLEANUP_ABORT_DELAY_MS = 500;

let pendingCleanupAbortId: ReturnType<typeof setTimeout> | null = null;

/** 화면에 노출하지 않을 기술/하드코딩 로그 문구 — eventLog 및 cleanStream 공통 필터 */
const TECHNICAL_LOG_BLACKLIST = [
  '데이터 분석 중',
  'Data analysis in progress',
  'Analyzing data',
  'Processing',
];

const shouldFilterLogLine = (line: string): boolean =>
  TECHNICAL_LOG_BLACKLIST.some((phrase) => line.includes(phrase));

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
  const addCleanStreamLine = useStreamStore((state) => state.addCleanStreamLine);
  const addTimelineStep = useStreamStore((state) => state.addTimelineStep);
  const setStreamingThought = useStreamStore((state) => state.setStreamingThought);
  const setLiveTargetBuzei = useStreamStore((state) => state.setLiveTargetBuzei);
  const addLiveViolationBuzei = useStreamStore((state) => state.addLiveViolationBuzei);
  const setLiveRiskScore = useStreamStore((state) => state.setLiveRiskScore);
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
      const isAutoStarted = options?.isAutoStarted === true;
      console.log('[Workbench SSE] startStream 호출', {
        caseId,
        isAutoConnect,
        isAutoStarted,
        fromAnalysisStarted: isAutoStarted,
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

        console.log('[Workbench SSE] 스트림 읽기 루프 진입', { caseId, runId, url: url.slice(0, 80) });
        timeoutRef.current = setTimeout(() => {
          console.warn('[Workbench SSE] 실패 원인: 스트림 타임아웃(65초). [DONE]/completed/failed 미수신.', { caseId, runId });
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
        let firstChunkLogged = false;
        /** event:failed 다음에 data가 비어 왔을 때, 다음 data/JSON 라인을 실패 payload로 사용 */
        let failedPayloadPending = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.warn('[Workbench SSE] 실패 원인: 스트림이 [DONE]/completed/failed 없이 종료됨(연결 끊김 또는 서버 종료).', {
              caseId,
              runId,
              lastEventType: currentEventType,
              bufferTail: buffer.slice(-200),
            });
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          if (!firstChunkLogged && buffer.length > 0) {
            firstChunkLogged = true;
            console.log('[Workbench SSE] 첫 청크 수신', { caseId, runId, length: buffer.length, preview: buffer.slice(0, 300) });
          }
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let lineIndex = 0;
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.length > 0 && !shouldFilterLogLine(trimmed)) {
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
            // event:failed + 빈 data 직후 백엔드가 "data:" 없이 JSON만 보낸 경우
            if (failedPayloadPending && trimmed.startsWith('{')) {
              try {
                const parsed = JSON.parse(trimmed) as Record<string, unknown>;
                const msg =
                  (typeof parsed.message === 'string' ? parsed.message : null) ||
                  (typeof parsed.error === 'string' ? parsed.error : null) ||
                  '분석이 실패했습니다.';
                const failedStage = typeof parsed.stage === 'string' ? parsed.stage : undefined;
                failedPayloadPending = false;
                addTimelineStep({ type: 'failed', message: msg, stage: failedStage });
                setLocalStatus('failed');
                setStatus('ERROR');
                setError(msg);
                setErrorMessage(msg);
                setDebug({ errorMessage: msg, failedStage });
                console.warn('[Workbench SSE] 실패 원인: event:failed 다음 JSON 라인에서 payload 수신.', {
                  caseId,
                  runId,
                  message: msg,
                  rawPayload: trimmed.slice(0, 300),
                });
                clearStreamTimeout();
                options?.onError?.(new Error(msg));
                return;
              } catch {
                console.warn('[Workbench SSE] failedPayloadPending 상태에서 JSON 파싱 실패', { line: trimmed.slice(0, 200) });
              }
            }
            if (trimmed.startsWith('data:')) {
              let dataStr = trimmed.slice(5).trim();

              // event:failed 다음 빈 data 이후에 오는 data 라인을 실패 payload로 사용
              if (failedPayloadPending && dataStr.length > 0) {
                failedPayloadPending = false;
                try {
                  const parsed = JSON.parse(dataStr) as Record<string, unknown>;
                  const msg =
                    (typeof parsed.message === 'string' ? parsed.message : null) ||
                    (typeof parsed.error === 'string' ? parsed.error : null) ||
                    '분석이 실패했습니다.';
                  const failedStage = typeof parsed.stage === 'string' ? parsed.stage : undefined;
                  addTimelineStep({ type: 'failed', message: msg, stage: failedStage });
                  setLocalStatus('failed');
                  setStatus('ERROR');
                  setError(msg);
                  setErrorMessage(msg);
                  setDebug({ errorMessage: msg, failedStage });
                  console.warn('[Workbench SSE] 실패 원인: SSE event:failed 직후 다음 data 라인에서 payload 수신.', {
                    caseId,
                    runId,
                    message: msg,
                    rawPayload: dataStr.slice(0, 300),
                  });
                  clearStreamTimeout();
                  options?.onError?.(new Error(msg));
                  return;
                } catch {
                  console.warn('[Workbench SSE] failedPayloadPending 상태에서 다음 data 파싱 실패', { dataStr: dataStr.slice(0, 200) });
                }
              }

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
                const parsed = dataStr ? (JSON.parse(dataStr) as AnalysisStepEvent & { thought_stream?: string }) : {};
                const targetBuzeiVal = (parsed.target_buzei ?? parsed.targetBuzei) as string | number | undefined;
                const buzeiNorm = normalizeBuzei(targetBuzeiVal);
                if (buzeiNorm) {
                  setLiveTargetBuzei(buzeiNorm);
                  addLiveViolationBuzei(buzeiNorm);
                }
                const thoughtStream = parsed.thought_stream ?? (parsed as { thoughtStream?: string }).thoughtStream;
                if (typeof thoughtStream === 'string' && thoughtStream.trim() && !shouldFilterLogLine(thoughtStream)) addCleanStreamLine(thoughtStream);
                setStepProgress({
                  label: parsed.label,
                  detail: parsed.detail,
                  percent: parsed.percent,
                });
                if (typeof parsed.percent === 'number' && !Number.isNaN(parsed.percent)) {
                  setLiveRiskScore(parsed.percent);
                }
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
                if (message.trim() && !shouldFilterLogLine(message)) addCleanStreamLine(message);
                setStepProgress({
                  label: parsed.agent ?? parsed.message,
                  detail: message || parsed.message,
                  percent: parsed.percent,
                });
                if (typeof parsed.percent === 'number' && !Number.isNaN(parsed.percent)) {
                  setLiveRiskScore(parsed.percent);
                }
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
                if (!dataStr || typeof dataStr !== 'string' || dataStr.trim() === '') {
                  console.warn('[Workbench SSE] event:failed 수신 시 data가 비어 있음. 다음 data 라인에서 payload 대기.', {
                    caseId,
                    runId,
                  });
                  failedPayloadPending = true;
                  continue;
                } else {
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
                  console.warn('[Workbench SSE] 실패 원인: SSE event:failed 수신.', {
                    caseId,
                    runId,
                    message: msg,
                    failedStage,
                    retryable,
                    rawPayload: dataStr.slice(0, 500),
                  });
                }
              } catch {
                if (typeof dataStr === 'string' && dataStr.length > 0) {
                  msg = dataStr;
                } else {
                  msg = '분석이 실패했습니다. (서버에서 상세 사유 미전달)';
                }
                console.warn('[Workbench SSE] event:failed 수신(JSON 파싱 실패). data가 비어있거나 유효한 JSON이 아님. 백엔드에서 data: {"error":"..."} 형태 전송 권장.', {
                  caseId,
                  runId,
                  dataStr: dataStr?.slice(0, 300) ?? '',
                });
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
        }

        clearStreamTimeout();
        setLocalStatus('failed');
        setStatus('ERROR');
        const msg = '분석이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.';
        console.warn('[Workbench SSE] 실패 원인: 루프 종료 후 [DONE]/completed/failed 미수신 → 이 메시지 표시.', { caseId, runId, lastEventType: currentEventType });
        setError(msg);
        setErrorMessage(msg);
        options?.onError?.(new Error(msg));
      } catch (err) {
        clearStreamTimeout();
        if (err instanceof Error && err.name === 'AbortError') {
          setLocalStatus('aborted');
          setStatus('ABORTED');
          console.log('[Workbench SSE] SSE 중단됨 (Abort)', { caseId });
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[Workbench SSE] 실패 원인: 예외 발생.', {
          message,
          caseId,
          errorName: err instanceof Error ? err.name : undefined,
        });
        setLocalStatus('failed');
        setStatus('ERROR');
        setError(message);
        setErrorMessage(message);
        options?.onError?.(err instanceof Error ? err : new Error(message));
      }
    },
    [setStatus, setError, setDebug, setAutoStartedBanner, addEventType, addEventLogLine, addCleanStreamLine, addTimelineStep, setStreamingThought, setLiveTargetBuzei, addLiveViolationBuzei, normalizeBuzei, resetStore, clearStreamTimeout]
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
