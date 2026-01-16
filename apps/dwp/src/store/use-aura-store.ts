// ----------------------------------------------------------------------

import { create } from 'zustand';

// ----------------------------------------------------------------------

export type AgentMessage = {
  id: string;
  role: 'user' | 'assistant' | 'thought' | 'action';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
};

export type TimelineStepStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type TimelineStep = {
  id: string;
  title: string;
  description?: string;
  status: TimelineStepStatus;
  timestamp: Date;
  metadata?: {
    tool?: string;
    params?: Record<string, any>;
    result?: any;
    error?: string;
  };
};

export type ActionExecution = {
  id: string;
  tool: string;
  params: Record<string, any>;
  timestamp: Date;
  status: 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
};

export type HitlRequest = {
  id: string;
  stepId: string;
  message: string;
  action: string;
  params: Record<string, any>;
  timestamp: Date;
};

export type AuraState = {
  isOverlayOpen: boolean;
  messages: AgentMessage[];
  isStreaming: boolean;
  isThinking: boolean;
  hasNotification: boolean;
  notificationCount: number;
  returnPath: string | null;
  timelineSteps: TimelineStep[];
  actionExecutions: ActionExecution[];
  pendingHitl: HitlRequest | null;
  currentStepIndex: number;
  actions: {
    openOverlay: () => void;
    closeOverlay: () => void;
    toggleOverlay: () => void;
    addMessage: (message: Omit<AgentMessage, 'id' | 'timestamp'>) => void;
    clearMessages: () => void;
    setStreaming: (streaming: boolean) => void;
    setThinking: (thinking: boolean) => void;
    setNotification: (has: boolean, count?: number) => void;
    setReturnPath: (path: string | null) => void;
    addTimelineStep: (step: Omit<TimelineStep, 'id' | 'timestamp'>) => void;
    updateTimelineStep: (id: string, updates: Partial<TimelineStep>) => void;
    addActionExecution: (execution: Omit<ActionExecution, 'id' | 'timestamp'>) => string;
    updateActionExecution: (id: string, updates: Partial<ActionExecution>) => void;
    setPendingHitl: (request: HitlRequest | null) => void;
    approveHitl: (requestId: string) => void;
    rejectHitl: (requestId: string) => void;
    setCurrentStepIndex: (index: number) => void;
  };
};

export const useAuraStore = create<AuraState>((set) => ({
  isOverlayOpen: false,
  messages: [],
  isStreaming: false,
  isThinking: false,
  hasNotification: false,
  notificationCount: 0,
  returnPath: null,
  timelineSteps: [],
  actionExecutions: [],
  pendingHitl: null,
  currentStepIndex: -1,
  actions: {
    openOverlay: () => set({ isOverlayOpen: true }),
    closeOverlay: () => set({ isOverlayOpen: false }),
    toggleOverlay: () => set((state) => ({ isOverlayOpen: !state.isOverlayOpen })),
    addMessage: (message) =>
      set((state) => ({
        messages: [
          ...state.messages,
          {
            ...message,
            id: `msg-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
          },
        ],
      })),
    clearMessages: () => set({ messages: [] }),
    setStreaming: (streaming) => set({ isStreaming: streaming }),
    setThinking: (thinking) => set({ isThinking: thinking }),
    setNotification: (has, count = 0) => set({ hasNotification: has, notificationCount: count }),
    setReturnPath: (path) => set({ returnPath: path }),
    addTimelineStep: (step) =>
      set((state) => ({
        timelineSteps: [
          ...state.timelineSteps,
          {
            ...step,
            id: `step-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
          },
        ],
      })),
    updateTimelineStep: (id, updates) =>
      set((state) => ({
        timelineSteps: state.timelineSteps.map((step) => (step.id === id ? { ...step, ...updates } : step)),
      })),
    addActionExecution: (execution) => {
      const id = `exec-${Date.now()}-${Math.random()}`;
      set((state) => ({
        actionExecutions: [
          ...state.actionExecutions,
          {
            ...execution,
            id,
            timestamp: new Date(),
          },
        ],
      }));
      return id;
    },
    updateActionExecution: (id, updates) =>
      set((state) => ({
        actionExecutions: state.actionExecutions.map((exec) => (exec.id === id ? { ...exec, ...updates } : exec)),
      })),
    setPendingHitl: (request) => set({ pendingHitl: request }),
    approveHitl: (requestId) =>
      set((state) => {
        if (state.pendingHitl?.id === requestId) {
          return { pendingHitl: null };
        }
        return {};
      }),
    rejectHitl: (requestId) =>
      set((state) => {
        if (state.pendingHitl?.id === requestId) {
          return { pendingHitl: null };
        }
        return {};
      }),
    setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
  },
}));

export const useAuraActions = () => useAuraStore((state) => state.actions);
