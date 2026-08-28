import type {
  VideoMeetingAdminCapabilities,
  VideoMeetingAdminPolicy,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

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

export type MeetingAdminReadinessReason =
  | 'POLICY_NEVER'
  | 'CAPABILITY_NOT_CONFIGURED'
  | 'REALTIME_PROVIDER_UNAVAILABLE'
  | 'DEPENDENCY_STATUS_CONTRACT_MISSING'
  | 'WORKFLOW_ENFORCEMENT_NOT_VERIFIED'
  | 'LEGAL_HOLD_NOT_CONNECTED'
  | 'DELETION_EVIDENCE_NOT_CONNECTED';

export type MeetingAdminReadinessSignal = {
  state: MeetingAdminReadinessState;
  reason?: MeetingAdminReadinessReason;
};

export type MeetingAdminIntelligenceCapabilityKey = 'recording' | 'transcript' | 'aiNotes';
export type MeetingAdminIntelligenceDependencyKey =
  'provider' | 'region' | 'kms' | 'audit' | 'egress' | 'storage' | 'stt' | 'llm';
export type MeetingAdminIntelligenceGovernanceKey =
  'humanReview' | 'explicitPublish' | 'adminContentAccess' | 'legalHold' | 'deletionEvidence';

export const MEETING_ADMIN_INTELLIGENCE_CAPABILITIES: readonly MeetingAdminIntelligenceCapabilityKey[] =
  ['recording', 'transcript', 'aiNotes'];

export const MEETING_ADMIN_INTELLIGENCE_DEPENDENCIES: readonly MeetingAdminIntelligenceDependencyKey[] =
  ['provider', 'region', 'kms', 'audit', 'egress', 'storage', 'stt', 'llm'];

export const MEETING_ADMIN_INTELLIGENCE_WORKFLOW_CONTROLS: readonly MeetingAdminIntelligenceGovernanceKey[] =
  ['humanReview', 'explicitPublish', 'adminContentAccess'];

export const MEETING_ADMIN_INTELLIGENCE_EVIDENCE_CONTROLS: readonly MeetingAdminIntelligenceGovernanceKey[] =
  ['legalHold', 'deletionEvidence'];

export type MeetingAdminIntelligenceReadiness = {
  capabilities: Record<MeetingAdminIntelligenceCapabilityKey, MeetingAdminReadinessSignal>;
  dependencies: Record<MeetingAdminIntelligenceDependencyKey, MeetingAdminReadinessSignal>;
  governance: Record<MeetingAdminIntelligenceGovernanceKey, MeetingAdminReadinessSignal>;
  retention: {
    meetingDays: number;
    artifactDays: number;
    chatDays: number;
  };
  observedAt?: string | null;
};

const missingDependencySignal = (): MeetingAdminReadinessSignal => ({
  state: 'CONNECTION_REQUIRED',
  reason: 'DEPENDENCY_STATUS_CONTRACT_MISSING',
});

export function deriveMeetingAdminIntelligenceReadiness(
  policy: VideoMeetingAdminPolicy,
  capabilities: VideoMeetingAdminCapabilities,
  observedAt?: string | null
): MeetingAdminIntelligenceReadiness {
  const recording: MeetingAdminReadinessSignal =
    policy.recordingPolicy === 'NEVER'
      ? { state: 'BLOCKED', reason: 'POLICY_NEVER' }
      : capabilities.recordingConfigured
        ? { state: 'READY' }
        : { state: 'CONNECTION_REQUIRED', reason: 'CAPABILITY_NOT_CONFIGURED' };
  const transcript: MeetingAdminReadinessSignal = capabilities.transcriptConfigured
    ? { state: 'READY' }
    : { state: 'CONNECTION_REQUIRED', reason: 'CAPABILITY_NOT_CONFIGURED' };
  const aiNotes: MeetingAdminReadinessSignal = capabilities.aiNotesConfigured
    ? { state: 'READY' }
    : { state: 'CONNECTION_REQUIRED', reason: 'CAPABILITY_NOT_CONFIGURED' };

  return {
    capabilities: { recording, transcript, aiNotes },
    dependencies: {
      provider: capabilities.video
        ? { state: 'READY' }
        : { state: 'BLOCKED', reason: 'REALTIME_PROVIDER_UNAVAILABLE' },
      region: missingDependencySignal(),
      kms: missingDependencySignal(),
      audit: missingDependencySignal(),
      egress: missingDependencySignal(),
      storage: missingDependencySignal(),
      stt: missingDependencySignal(),
      llm: missingDependencySignal(),
    },
    governance: {
      humanReview: {
        state: 'NOT_VERIFIED',
        reason: 'WORKFLOW_ENFORCEMENT_NOT_VERIFIED',
      },
      explicitPublish: {
        state: 'NOT_VERIFIED',
        reason: 'WORKFLOW_ENFORCEMENT_NOT_VERIFIED',
      },
      adminContentAccess: {
        state: 'NOT_VERIFIED',
        reason: 'WORKFLOW_ENFORCEMENT_NOT_VERIFIED',
      },
      legalHold: {
        state: 'CONNECTION_REQUIRED',
        reason: 'LEGAL_HOLD_NOT_CONNECTED',
      },
      deletionEvidence: {
        state: 'CONNECTION_REQUIRED',
        reason: 'DELETION_EVIDENCE_NOT_CONNECTED',
      },
    },
    retention: {
      meetingDays: policy.retentionDays,
      artifactDays: policy.artifactRetentionDays,
      chatDays: policy.chatRetentionDays,
    },
    observedAt,
  };
}
