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

export type AuraState = {
  isOverlayOpen: boolean;
  messages: AgentMessage[];
  isStreaming: boolean;
  isThinking: boolean;
  hasNotification: boolean;
  notificationCount: number;
  returnPath: string | null;
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
  },
}));

export const useAuraActions = () => useAuraStore((state) => state.actions);
