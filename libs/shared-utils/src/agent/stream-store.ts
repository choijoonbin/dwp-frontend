// ----------------------------------------------------------------------

import { create } from 'zustand';

import type { StreamStatus, StreamDebugInfo } from './stream-status';

// ----------------------------------------------------------------------

const MAX_EVENT_LOG_LINES = 200;
const MAX_TIMELINE_STEPS = 50;

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

/**
 * SSE Stream Store (Zustand)
 *
 * Centralized state for SSE stream connection status.
 * Phase3: eventLog (max 200 lines) for agent stream tab.
 * P1: timelineSteps for step-based UI (started/step/completed/failed).
 */
type StreamStore = {
  status: StreamStatus;
  errorMessage?: string;
  debug: StreamDebugInfo;
  /** Phase3: recent SSE event log lines (max 200) for display */
  eventLog: string[];
  /** P1: step-based timeline for UI (started → steps → completed/failed) */
  timelineSteps: StreamTimelineStep[];

  setStatus: (status: StreamStatus) => void;
  setError: (message: string) => void;
  setDebug: (updates: Partial<StreamDebugInfo>) => void;
  addEventType: (eventType: string) => void;
  /** Append a raw log line (e.g. "event: step" or "data: {...}"); keeps last MAX_EVENT_LOG_LINES */
  addEventLogLine: (line: string) => void;
  /** P1: Append a timeline step (started/step/completed/failed) */
  addTimelineStep: (step: StreamTimelineStep) => void;
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
  timelineSteps: [] as StreamTimelineStep[],
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

  addTimelineStep: (step) =>
    set((state) => ({
      timelineSteps: [...state.timelineSteps, { ...step, at: step.at ?? Date.now() }].slice(-MAX_TIMELINE_STEPS),
    })),

  reset: () => set({ ...initialState }),
}));
