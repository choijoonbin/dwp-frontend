import type {
  VideoMeetingAdminCapabilities,
  VideoMeetingAdminPolicy,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type { VideoMeetingAdminIntelligenceReadiness as RuntimeMeetingAdminIntelligenceReadiness } from '@dwp-frontend/shared-utils/api/video-meeting-admin-intelligence-api';

export type MeetingAdminPolicyValidationCode = 'RANGE' | 'EXCEEDS_MEETING_RETENTION';

export type MeetingAdminPolicyValidation = {
  chatRetention: MeetingAdminPolicyValidationCode | null;
  artifactRetention: MeetingAdminPolicyValidationCode | null;
};

export function validateMeetingAdminPolicy(
  policy: Pick<
    VideoMeetingAdminPolicy,
    'retentionDays' | 'chatRetentionDays' | 'artifactRetentionDays'
  >
): MeetingAdminPolicyValidation {
  const chatRetention =
    !Number.isInteger(policy.chatRetentionDays) ||
    policy.chatRetentionDays < 0 ||
    policy.chatRetentionDays > 365
      ? 'RANGE'
      : policy.chatRetentionDays > policy.retentionDays
        ? 'EXCEEDS_MEETING_RETENTION'
        : null;
  const artifactRetention =
    policy.artifactRetentionDays > policy.retentionDays ? 'EXCEEDS_MEETING_RETENTION' : null;

  return { chatRetention, artifactRetention };
}

export function hasMeetingAdminPolicyErrors(validation: MeetingAdminPolicyValidation): boolean {
  return Object.values(validation).some(Boolean);
}

export type MeetingAdminOperationCapabilityKey =
  'video' | 'screenShare' | 'chat' | 'captions' | 'recording' | 'transcript' | 'aiNotes';

export const MEETING_ADMIN_OPERATION_CAPABILITIES: readonly MeetingAdminOperationCapabilityKey[] = [
  'video',
  'screenShare',
  'chat',
  'captions',
  'recording',
  'transcript',
  'aiNotes',
];

export function isMeetingAdminCapabilityAvailable(
  capabilities: VideoMeetingAdminCapabilities,
  key: MeetingAdminOperationCapabilityKey
): boolean {
  if (key === 'recording') return capabilities.recordingConfigured;
  if (key === 'transcript') return capabilities.transcriptConfigured;
  if (key === 'aiNotes') return capabilities.aiNotesConfigured;
  return capabilities[key];
}

export function formatMeetingAdminQualityScore(value?: number | null): string {
  return value == null || !Number.isFinite(value) ? '—' : `${value} / 100`;
}

export type MeetingAdminReadinessState =
  'READY' | 'BLOCKED' | 'CONNECTION_REQUIRED' | 'NOT_VERIFIED';

export type MeetingAdminReadinessSignal = {
  state: MeetingAdminReadinessState;
  reason?: string;
};

export type MeetingAdminIntelligenceCapabilityKey = 'recording' | 'transcript' | 'aiNotes';
export type MeetingAdminIntelligenceDependencyKey =
  'provider' | 'region' | 'kms' | 'audit' | 'egress' | 'storage' | 'stt' | 'llm';
export type MeetingAdminIntelligenceGovernanceKey =
  'humanReview' | 'explicitPublish' | 'adminContentAccess' | 'legalHold' | 'deletionEvidence';
export type MeetingAdminRetentionSignalKey =
  'intelligenceReports' | 'meetingRecords' | 'artifacts' | 'chat';

export const MEETING_ADMIN_INTELLIGENCE_CAPABILITIES: readonly MeetingAdminIntelligenceCapabilityKey[] =
  ['recording', 'transcript', 'aiNotes'];

export const MEETING_ADMIN_INTELLIGENCE_DEPENDENCIES: readonly MeetingAdminIntelligenceDependencyKey[] =
  ['provider', 'region', 'kms', 'audit', 'egress', 'storage', 'stt', 'llm'];

export const MEETING_ADMIN_INTELLIGENCE_WORKFLOW_CONTROLS: readonly MeetingAdminIntelligenceGovernanceKey[] =
  ['humanReview', 'explicitPublish', 'adminContentAccess'];

export const MEETING_ADMIN_INTELLIGENCE_EVIDENCE_CONTROLS: readonly MeetingAdminIntelligenceGovernanceKey[] =
  ['legalHold', 'deletionEvidence'];

export const MEETING_ADMIN_RETENTION_SIGNALS: readonly MeetingAdminRetentionSignalKey[] = [
  'intelligenceReports',
  'meetingRecords',
  'artifacts',
  'chat',
];

export type MeetingAdminIntelligenceReadiness = {
  readinessVersion?: string | null;
  recordingPolicy?: VideoMeetingAdminPolicy['recordingPolicy'] | null;
  providerCode?: string | null;
  providerModel?: string | null;
  processingRegion?: string | null;
  capabilities: Record<MeetingAdminIntelligenceCapabilityKey, MeetingAdminReadinessSignal>;
  dependencies: Record<MeetingAdminIntelligenceDependencyKey, MeetingAdminReadinessSignal>;
  governance: Record<MeetingAdminIntelligenceGovernanceKey, MeetingAdminReadinessSignal>;
  retention: {
    meetingDays: number | null;
    artifactDays: number | null;
    chatDays: number | null;
    intelligenceWorkerReady: boolean | null;
    signals: Record<MeetingAdminRetentionSignalKey, MeetingAdminReadinessSignal>;
  };
  observedAt?: string | null;
};

const READINESS_STATES = new Set<MeetingAdminReadinessState>([
  'READY',
  'BLOCKED',
  'CONNECTION_REQUIRED',
  'NOT_VERIFIED',
]);

const unavailableSignal = (): MeetingAdminReadinessSignal => ({
  state: 'NOT_VERIFIED',
  reason: 'READINESS_ENDPOINT_UNAVAILABLE',
});

function projectSignal(
  signals: Record<string, { state: string; reason?: string | null }>,
  key: string
): MeetingAdminReadinessSignal {
  const signal = signals[key];
  if (!signal || !READINESS_STATES.has(signal.state as MeetingAdminReadinessState)) {
    return { state: 'NOT_VERIFIED', reason: 'RUNTIME_SIGNAL_MISSING' };
  }
  return {
    state: signal.state as MeetingAdminReadinessState,
    ...(signal.reason ? { reason: signal.reason } : {}),
  };
}

export function projectMeetingAdminIntelligenceReadiness(
  readiness: RuntimeMeetingAdminIntelligenceReadiness
): MeetingAdminIntelligenceReadiness {
  return {
    readinessVersion: readiness.readinessVersion,
    observedAt: readiness.observedAt,
    recordingPolicy: readiness.recordingPolicy,
    providerCode: readiness.providerCode,
    providerModel: readiness.providerModel,
    processingRegion: readiness.processingRegion,
    capabilities: Object.fromEntries(
      MEETING_ADMIN_INTELLIGENCE_CAPABILITIES.map((key) => [
        key,
        projectSignal(readiness.capabilities, key),
      ])
    ) as MeetingAdminIntelligenceReadiness['capabilities'],
    dependencies: Object.fromEntries(
      MEETING_ADMIN_INTELLIGENCE_DEPENDENCIES.map((key) => [
        key,
        projectSignal(readiness.dependencies, key),
      ])
    ) as MeetingAdminIntelligenceReadiness['dependencies'],
    governance: Object.fromEntries(
      [
        ...MEETING_ADMIN_INTELLIGENCE_WORKFLOW_CONTROLS,
        ...MEETING_ADMIN_INTELLIGENCE_EVIDENCE_CONTROLS,
      ].map((key) => [key, projectSignal(readiness.governance, key)])
    ) as MeetingAdminIntelligenceReadiness['governance'],
    retention: {
      meetingDays: readiness.retention.meetingDays,
      artifactDays: readiness.retention.artifactDays,
      chatDays: readiness.retention.chatDays,
      intelligenceWorkerReady: readiness.retention.intelligenceWorkerReady,
      signals: Object.fromEntries(
        MEETING_ADMIN_RETENTION_SIGNALS.map((key) => [
          key,
          projectSignal(readiness.retention.signals ?? {}, key),
        ])
      ) as MeetingAdminIntelligenceReadiness['retention']['signals'],
    },
  };
}

export function createUnavailableMeetingAdminIntelligenceReadiness(
  policy?: VideoMeetingAdminPolicy
): MeetingAdminIntelligenceReadiness {
  return {
    recordingPolicy: policy?.recordingPolicy ?? null,
    capabilities: Object.fromEntries(
      MEETING_ADMIN_INTELLIGENCE_CAPABILITIES.map((key) => [key, unavailableSignal()])
    ) as MeetingAdminIntelligenceReadiness['capabilities'],
    dependencies: Object.fromEntries(
      MEETING_ADMIN_INTELLIGENCE_DEPENDENCIES.map((key) => [key, unavailableSignal()])
    ) as MeetingAdminIntelligenceReadiness['dependencies'],
    governance: Object.fromEntries(
      [
        ...MEETING_ADMIN_INTELLIGENCE_WORKFLOW_CONTROLS,
        ...MEETING_ADMIN_INTELLIGENCE_EVIDENCE_CONTROLS,
      ].map((key) => [key, unavailableSignal()])
    ) as MeetingAdminIntelligenceReadiness['governance'],
    retention: {
      meetingDays: policy?.retentionDays ?? null,
      artifactDays: policy?.artifactRetentionDays ?? null,
      chatDays: policy?.chatRetentionDays ?? null,
      intelligenceWorkerReady: null,
      signals: Object.fromEntries(
        MEETING_ADMIN_RETENTION_SIGNALS.map((key) => [key, unavailableSignal()])
      ) as MeetingAdminIntelligenceReadiness['retention']['signals'],
    },
  };
}
