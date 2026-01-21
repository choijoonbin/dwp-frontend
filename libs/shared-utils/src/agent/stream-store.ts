// ----------------------------------------------------------------------

import { create } from 'zustand';

import type { StreamStatus, StreamDebugInfo } from './stream-status';

// ----------------------------------------------------------------------

/**
 * SSE Stream Store (Zustand)
 * 
 * Centralized state for SSE stream connection status.
 * Read-only access from Host/Remote apps.
 * Updates only through use-agent-stream hook.
 */
type StreamStore = {
  status: StreamStatus;
  errorMessage?: string;
  debug: StreamDebugInfo;
  
  // Actions (internal use only - called by use-agent-stream)
  setStatus: (status: StreamStatus) => void;
  setError: (message: string) => void;
  setDebug: (updates: Partial<StreamDebugInfo>) => void;
  addEventType: (eventType: string) => void;
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
      const recent = [...state.debug.recentEventTypes, eventType].slice(-10); // Keep last 10
      return {
        debug: {
          ...state.debug,
          lastEventType: eventType,
          recentEventTypes: recent,
        },
      };
    }),
  
  reset: () => set({ ...initialState }),
}));
