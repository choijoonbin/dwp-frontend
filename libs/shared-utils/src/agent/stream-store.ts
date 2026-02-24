// ----------------------------------------------------------------------

import { create } from 'zustand';

import type { StreamStatus, StreamDebugInfo } from './stream-status';

// ----------------------------------------------------------------------

const MAX_EVENT_LOG_LINES = 200;
const MAX_TIMELINE_STEPS = 50;
const MAX_CLEAN_STREAM_LINES = 100;

/** P1: Step-based timeline entry (started/step/completed/failed) */
export type StreamTimelineStep = {
  type: 'started' | 'step' | 'completed' | 'failed';
  label?: string;
  detail?: string;
  percent?: number;
  stage?: string;
  message?: string;
  at?: number;
};

/** thought_pending 시 로딩 표시, AGENT_STREAM/agent 도착 시 실제 텍스트로 전환 */
export type StreamingThought = {
  type: string;
  step?: number;
  content?: string;
  pending: boolean;
};

/**
 * SSE Stream Store (Zustand)
 *
 * Centralized state for SSE stream connection status.
 * Phase3: eventLog (max 200 lines) for agent stream tab.
 * P1: timelineSteps for step-based UI (started/step/completed/failed).
 * thought_pending: ReasoningTimeline 로딩/실제 텍스트 표시용.
 */
type StreamStore = {
  status: StreamStatus;
  errorMessage?: string;
  debug: StreamDebugInfo;
  /** Phase3: recent SSE event log lines (max 200) for display */
  eventLog: string[];
  /** Clean stream: content/thought_stream만 추출한 텍스트 (TypingMarkdown 렌더용) */
  cleanStreamLines: string[];
  /** P1: step-based timeline for UI (started → steps → completed/failed) */
  timelineSteps: StreamTimelineStep[];
  /** thought_pending → 스켈레톤, agent/AGENT_STREAM → 실제 문장 */
  streamingThought: StreamingThought | null;
  /** 스트림 이벤트에서 수신한 target_buzei — 분석 완료 전 실시간 Red Glow용 */
  liveTargetBuzei: string | null;
  /** 스트림 이벤트에서 수신한 위반 행 buzei 목록 (실시간 강조) */
  liveViolationBuzeiList: string[];
  /** 스트림 step/agent 이벤트의 percent — 동적 요약 바 리스크 점수 카운팅 업용 (0–100) */
  liveRiskScore: number;
  /** 자동 검토 시작 시 타임라인 상단 안내 문구 노출 여부 */
  autoStartedBanner: boolean;

  setStatus: (status: StreamStatus) => void;
  setError: (message: string) => void;
  setDebug: (updates: Partial<StreamDebugInfo>) => void;
  setAutoStartedBanner: (visible: boolean) => void;
  addEventType: (eventType: string) => void;
  addEventLogLine: (line: string) => void;
  addCleanStreamLine: (text: string) => void;
  addTimelineStep: (step: StreamTimelineStep) => void;
  setStreamingThought: (thought: StreamingThought | null) => void;
  setLiveTargetBuzei: (buzei: string | null) => void;
  addLiveViolationBuzei: (buzei: string) => void;
  setLiveRiskScore: (score: number) => void;
  reset: () => void;
};

const initialDebug: StreamDebugInfo = {
  endpoint: '',
  retryCount: 0,
  recentEventTypes: [],
};

const initialState = {
  status: 'IDLE' as StreamStatus,
  debug: initialDebug,
  eventLog: [] as string[],
  cleanStreamLines: [] as string[],
  timelineSteps: [] as StreamTimelineStep[],
  streamingThought: null as StreamingThought | null,
  liveTargetBuzei: null as string | null,
  liveViolationBuzeiList: [] as string[],
  liveRiskScore: 0,
  autoStartedBanner: false,
};

export const useStreamStore = create<StreamStore>((set) => ({
  ...initialState,
  
  setStatus: (status) => set({ status }),
  
  setError: (errorMessage) => 
    set((state) => ({
      errorMessage,
      debug: {
        ...state.debug,
        errorMessage,
      },
    })),
  
  setDebug: (updates) =>
    set((state) => ({
      debug: {
        ...state.debug,
        ...updates,
      },
    })),

  setAutoStartedBanner: (autoStartedBanner) => set({ autoStartedBanner }),

  addEventType: (eventType) =>
    set((state) => {
      const recent = [...state.debug.recentEventTypes, eventType].slice(-10);
      return {
        debug: {
          ...state.debug,
          lastEventType: eventType,
          recentEventTypes: recent,
        },
      };
    }),

  addEventLogLine: (line) =>
    set((state) => ({
      eventLog: [...state.eventLog, line].slice(-MAX_EVENT_LOG_LINES),
    })),

  addCleanStreamLine: (text) =>
    set((state) => {
      const trimmed = typeof text === 'string' ? text.trim() : '';
      if (!trimmed) return state;
      return {
        cleanStreamLines: [...state.cleanStreamLines, trimmed].slice(-MAX_CLEAN_STREAM_LINES),
      };
    }),

  addTimelineStep: (step) =>
    set((state) => ({
      timelineSteps: [...state.timelineSteps, { ...step, at: step.at ?? Date.now() }].slice(-MAX_TIMELINE_STEPS),
    })),

  setStreamingThought: (streamingThought) => set({ streamingThought }),

  setLiveTargetBuzei: (buzei) => set({ liveTargetBuzei: buzei }),

  addLiveViolationBuzei: (buzei) =>
    set((state) => {
      const normalized = String(buzei).trim().padStart(3, '0');
      if (!normalized || state.liveViolationBuzeiList.includes(normalized)) return state;
      return {
        liveViolationBuzeiList: [...state.liveViolationBuzeiList, normalized].slice(-50),
      };
    }),

  setLiveRiskScore: (score) =>
    set({ liveRiskScore: Math.min(100, Math.max(0, Math.round(score))) }),

  reset: () => set({ ...initialState }),
}));
