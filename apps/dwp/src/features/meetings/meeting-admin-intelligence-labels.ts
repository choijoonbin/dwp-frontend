import type {
  MeetingAdminIntelligenceCapabilityKey,
  MeetingAdminIntelligenceDependencyKey,
  MeetingAdminIntelligenceGovernanceKey,
  MeetingAdminReadinessState,
} from './meeting-admin-model';

export type IntelligenceLabel = { label: string; description: string };
type IntelligencePipelineKey =
  'consent' | 'recording' | 'encryption' | 'transcript' | 'model' | 'publication' | 'deletion';

export type MeetingAdminIntelligenceLabels = {
  eyebrow: string;
  title: string;
  description: string;
  accessBoundary: string;
  runtimeEvidenceTitle: string;
  runtimeEvidence: {
    version: string;
    recordingPolicy: string;
    provider: string;
    model: string;
    region: string;
  };
  recordingPolicies: Record<'NEVER' | 'HOST_OPT_IN' | 'ADMIN_REQUIRED', string>;
  unavailable: string;
  readinessTitle: string;
  readinessProgress: (ready: number, total: number) => string;
  pipelineTitle: string;
  pipelineDescription: string;
  capabilitiesTitle: string;
  capabilitiesDescription: string;
  dependenciesTitle: string;
  dependenciesDescription: string;
  workflowTitle: string;
  workflowDescription: string;
  lifecycleTitle: string;
  lifecycleDescription: string;
  retentionTitle: string;
  retentionDescription: string;
  observedAt: (value: string) => string;
  days: (value: number | null) => string;
  states: Record<MeetingAdminReadinessState, string>;
  reason: (value: string) => string;
  pipeline: Record<IntelligencePipelineKey, IntelligenceLabel>;
  capabilities: Record<MeetingAdminIntelligenceCapabilityKey, IntelligenceLabel>;
  dependencies: Record<MeetingAdminIntelligenceDependencyKey, IntelligenceLabel>;
  governance: Record<MeetingAdminIntelligenceGovernanceKey, IntelligenceLabel>;
  retention: {
    meeting: IntelligenceLabel;
    artifact: IntelligenceLabel;
    chat: IntelligenceLabel;
    intelligence: IntelligenceLabel;
    worker: IntelligenceLabel;
  };
};
