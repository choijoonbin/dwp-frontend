export type AdminV2SourceState =
  'ready' | 'loading' | 'empty' | 'forbidden' | 'conflict' | 'unavailable' | 'stale';

export type AdminV2Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export type AdminV2Status = {
  label: string;
  tone: AdminV2Tone;
};

export type AdminV2Metric = {
  id: string;
  label: string;
  value: string;
  helper?: string;
  tone?: AdminV2Tone;
};

export type AdminV2Fact = {
  id: string;
  label: string;
  value: string;
  tone?: AdminV2Tone;
};

export type AdminV2WorkspaceHeader = {
  eyebrow: string;
  title: string;
  description: string;
  evidenceLabel: string;
};

export type AdminV2StateCopy = {
  loadingTitle: string;
  loadingDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  forbiddenTitle: string;
  forbiddenDescription: string;
  conflictTitle: string;
  conflictDescription: string;
  conflictAction: string;
  unavailableTitle: string;
  unavailableDescription: string;
  retryAction: string;
  staleTitle: string;
  staleDescription: string;
  staleAction: string;
};

export type AdminV2WorkspaceActions = {
  onRetry?: () => void;
  onResolveConflict?: () => void;
};
