// ----------------------------------------------------------------------

import { create } from 'zustand';

import type { StreamStatus, StreamDebugInfo } from './stream-status';

// ----------------------------------------------------------------------

const MAX_EVENT_LOG_LINES = 200;

/**
 * SSE Stream Store (Zustand)
 *
 * Centralized state for SSE stream connection status.
 * Phase3: eventLog (max 200 lines) for agent stream tab.
 */
type StreamStore = {
  status: StreamStatus;
  errorMessage?: string;
  debug: StreamDebugInfo;
  /** Phase3: recent SSE event log lines (max 200) for display */
  eventLog: string[];

  setStatus: (status: StreamStatus) => void;
  setError: (message: string) => void;
  setDebug: (updates: Partial<StreamDebugInfo>) => void;
  addEventType: (eventType: string) => void;
  /** Append a raw log line (e.g. "event: step" or "data: {...}"); keeps last MAX_EVENT_LOG_LINES */
  addEventLogLine: (line: string) => void;
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

  reset: () => set({ ...initialState }),
}));
