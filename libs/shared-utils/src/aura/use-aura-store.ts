// ----------------------------------------------------------------------

import { create } from 'zustand';

// ----------------------------------------------------------------------

export type AgentMessage = {
  id: string;
  role: 'user' | 'assistant' | 'thought' | 'action';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
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
    params?: Record<string, unknown>;
    result?: unknown;
    error?: string;
  };
};

export type ActionExecution = {
  id: string;
  tool: string;
  params: Record<string, unknown>;
  timestamp: Date;
  status: 'executing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
};

export type HitlRequest = {
  id: string;
  stepId: string;
  message: string;
  action: string;
  params: Record<string, unknown>;
  timestamp: Date;
  confidence?: number;
  editableContent?: string;
};

export type ThoughtChain = {
  id: string;
  type: 'analysis' | 'planning' | 'execution' | 'verification';
  content: string;
  timestamp: Date;
  sources?: Array<{ type: 'code' | 'conversation' | 'metadata'; name: string; path?: string }>;
};

export type PlanStep = {
  id: string;
  title: string;
  description: string;
  order: number;
  canSkip: boolean;
  status: 'pending' | 'approved' | 'skipped' | 'executing' | 'completed' | 'failed';
  confidence?: number;
};

export type ExecutionLog = {
  id: string;
  timestamp: Date;
  type: 'command' | 'api' | 'info' | 'error' | 'success';
  content: string;
  metadata?: Record<string, unknown>;
};

export type ContextSnapshot = {
  url: string;
  title: string;
  screenshot?: string;
  metadata?: Record<string, unknown>;
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
  thoughtChains: ThoughtChain[];
  planSteps: PlanStep[];
  executionLogs: ExecutionLog[];
  contextSnapshot: ContextSnapshot | null;
  isExpanding: boolean;
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
    addThoughtChain: (thought: Omit<ThoughtChain, 'id' | 'timestamp'>) => void;
    addPlanStep: (step: Omit<PlanStep, 'id'>) => void;
    updatePlanStep: (id: string, updates: Partial<PlanStep>) => void;
    reorderPlanSteps: (stepIds: string[]) => void;
    addExecutionLog: (log: Omit<ExecutionLog, 'id' | 'timestamp'>) => void;
    setContextSnapshot: (snapshot: ContextSnapshot | null) => void;
    setIsExpanding: (expanding: boolean) => void;
    updateHitlEditableContent: (requestId: string, content: string) => void;
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
  thoughtChains: [],
  planSteps: [],
  executionLogs: [],
  contextSnapshot: null,
  isExpanding: false,
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
    addThoughtChain: (thought) =>
      set((state) => ({
        thoughtChains: [
          ...state.thoughtChains,
          {
            ...thought,
            id: `thought-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
          },
        ],
      })),
    addPlanStep: (step) =>
      set((state) => ({
        planSteps: [
          ...state.planSteps,
          {
            ...step,
            id: `plan-${Date.now()}-${Math.random()}`,
          },
        ].sort((a, b) => a.order - b.order),
      })),
    updatePlanStep: (id, updates) =>
      set((state) => ({
        planSteps: state.planSteps.map((step) => (step.id === id ? { ...step, ...updates } : step)),
      })),
    reorderPlanSteps: (stepIds) =>
      set((state) => {
        const stepMap = new Map(state.planSteps.map((step) => [step.id, step]));
        const reordered = stepIds
          .map((id, index) => {
            const step = stepMap.get(id);
            return step ? { ...step, order: index } : null;
          })
          .filter(Boolean) as PlanStep[];
        return { planSteps: reordered };
      }),
    addExecutionLog: (log) =>
      set((state) => ({
        executionLogs: [
          ...state.executionLogs,
          {
            ...log,
            id: `log-${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
          },
        ],
      })),
    setContextSnapshot: (snapshot) => set({ contextSnapshot: snapshot }),
    setIsExpanding: (expanding) => set({ isExpanding: expanding }),
    updateHitlEditableContent: (requestId, content) =>
      set((state) => {
        if (state.pendingHitl?.id === requestId) {
          return { pendingHitl: { ...state.pendingHitl, editableContent: content } };
        }
        return {};
      }),
  },
}));

export const useAuraActions = () => useAuraStore((state) => state.actions);
