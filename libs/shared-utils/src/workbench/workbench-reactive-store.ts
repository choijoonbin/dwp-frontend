/**
 * 워크벤치 실시간 반응형 UI 상태
 * - analysis_started → analyzingCaseIds (분석 중 칩)
 * - THOUGHT_STREAM → currentThoughtStreamCaseId/runId 대조 후 ThoughtChainUI에 스트리밍
 * - ANALYSIS_STARTED payload의 stream_url → pendingAutoStream (선택 케이스와 일치 시 SSE 자동 구독)
 */

import { create } from 'zustand';

export type PendingAutoStream = {
  caseId: string;
  streamUrl: string;
  runId?: string;
};

type WorkbenchReactiveState = {
  analyzingCaseIds: Set<string>;
  /** THOUGHT_STREAM 수신 시 대조용: 현재 상세/워크스페이스의 case_id */
  currentThoughtStreamCaseId: string | null;
  /** THOUGHT_STREAM 수신 시 대조용: 현재 run_id (선택) */
  currentThoughtStreamRunId: string | null;
  /** run_id별 스트리밍 중인 thought id (chunk 시 updateThoughtChain용) */
  streamingThoughtIdByRun: Record<string, string>;
  /** 테스트 데이터 생성 후 워크벤치 진입 시 자동 선택할 케이스 ID (CASE_ACTION/ANALYSIS_STARTED 수신 시 설정, 선택 후 클리어) */
  suggestedSelectCaseId: string | null;
  /** ANALYSIS_STARTED 수신 시 stream_url 저장. selectedCaseId와 일치하면 SSE 자동 구독 후 클리어 */
  pendingAutoStream: PendingAutoStream | null;
};

type WorkbenchReactiveActions = {
  addAnalyzing: (caseId: string) => void;
  removeAnalyzing: (caseId: string) => void;
  isAnalyzing: (caseId: string) => boolean;
  setThoughtStreamContext: (caseId: string | null, runId: string | null) => void;
  getStreamingThoughtId: (runId: string) => string | undefined;
  setStreamingThoughtId: (runId: string, thoughtId: string) => void;
  setSuggestedSelectCaseId: (caseId: string | null) => void;
  setPendingAutoStream: (v: PendingAutoStream | null) => void;
};

export const useWorkbenchReactiveStore = create<WorkbenchReactiveState & WorkbenchReactiveActions>((set, get) => ({
  analyzingCaseIds: new Set<string>(),
  currentThoughtStreamCaseId: null,
  currentThoughtStreamRunId: null,
  streamingThoughtIdByRun: {},
  suggestedSelectCaseId: null,
  pendingAutoStream: null,

  addAnalyzing: (caseId: string) => {
    const id = String(caseId);
    set((state) => {
      const next = new Set(state.analyzingCaseIds);
      next.add(id);
      return { analyzingCaseIds: next };
    });
  },

  removeAnalyzing: (caseId: string) => {
    const id = String(caseId);
    set((state) => {
      const next = new Set(state.analyzingCaseIds);
      next.delete(id);
      return { analyzingCaseIds: next };
    });
  },

  isAnalyzing: (caseId: string) => get().analyzingCaseIds.has(String(caseId)),

  setThoughtStreamContext: (caseId: string | null, runId: string | null) => {
    set({
      currentThoughtStreamCaseId: caseId ?? null,
      currentThoughtStreamRunId: runId ?? null,
      ...(caseId == null && runId == null ? { streamingThoughtIdByRun: {} } : {}),
    });
  },

  getStreamingThoughtId: (runId: string) => get().streamingThoughtIdByRun[runId],

  setStreamingThoughtId: (runId: string, thoughtId: string) => {
    set((state) => ({
      streamingThoughtIdByRun: { ...state.streamingThoughtIdByRun, [runId]: thoughtId },
    }));
  },

  setSuggestedSelectCaseId: (caseId: string | null) => {
    set({ suggestedSelectCaseId: caseId != null ? String(caseId) : null });
  },

  setPendingAutoStream: (v: PendingAutoStream | null) => {
    set({ pendingAutoStream: v });
  },
}));
