import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type {
  VideoMeetingAdminCapabilities,
  VideoMeetingAdminPolicy,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';
import type { VideoMeetingAdminIntelligenceReadiness as RuntimeMeetingAdminIntelligenceReadiness } from '@dwp-frontend/shared-utils/api/video-meeting-admin-intelligence-api';

import {
  MeetingAdminIntelligence,
  type MeetingAdminIntelligenceLabels,
} from './meeting-admin-intelligence';
import {
  MEETING_ADMIN_OPERATION_CAPABILITIES,
  MEETING_RECORDING_POLICIES,
  createUnavailableMeetingAdminIntelligenceReadiness,
  formatMeetingAdminQualityScore,
  hasMeetingAdminPolicyErrors,
  isMeetingAdminCapabilityAvailable,
  projectMeetingAdminIntelligenceReadiness,
  validateMeetingAdminPolicy,
} from './meeting-admin-model';

const policy: VideoMeetingAdminPolicy = {
  meetingsEnabled: true,
  waitingRoomRequired: true,
  guestsAllowed: false,
  participantChatAllowed: true,
  reactionsAllowed: true,
  screenShareAllowed: true,
  unmuteControl: 'REQUEST_ONLY',
  recordingPolicy: 'NEVER',
  allowJoinBeforeHost: false,
  requireAuthenticatedInternalUsers: true,
  maximumParticipants: 100,
  retentionDays: 90,
  artifactRetentionDays: 30,
  chatRetentionDays: 60,
  recordingConfigured: false,
  aiNotesConfigured: false,
  version: 4,
};

const capabilities: VideoMeetingAdminCapabilities = {
  video: true,
  screenShare: true,
  chat: true,
  captions: false,
  recordingConfigured: false,
  transcriptConfigured: false,
  aiNotesConfigured: false,
};

const item = (label: string) => ({ label, description: `${label} description` });

const labels: MeetingAdminIntelligenceLabels = {
  eyebrow: 'Meetings / Administration',
  title: 'Recording, transcript, and AI readiness',
  description: 'Verify governed dependencies and evidence before enabling content processing.',
  accessBoundary: 'Administrators have no default access to meeting content.',
  runtimeEvidenceTitle: 'Authoritative runtime evidence',
  runtimeEvidence: {
    version: 'Readiness contract',
    recordingPolicy: 'Recording policy',
    provider: 'Managed provider',
    model: 'Approved model',
    region: 'Processing region',
  },
  recordingPolicies: {
    NEVER: 'Disabled by tenant policy',
    HOST_OPT_IN: 'Host opt-in with governed consent',
    ADMIN_REQUIRED: 'Administrator-required governed recording',
  },
  unavailable: 'Not reported',
  readinessTitle: 'Release readiness',
  readinessProgress: (ready, total) => `${ready} of ${total} ready`,
  pipelineTitle: 'Governed processing pipeline',
  pipelineDescription: 'Every step remains independently fail-closed.',
  capabilitiesTitle: 'Content readiness',
  capabilitiesDescription: 'Capabilities stay blocked until their requirements are verified.',
  dependenciesTitle: 'Dependency chain',
  dependenciesDescription: 'Every dependency must report its own readiness.',
  workflowTitle: 'Review and publish controls',
  workflowDescription: 'AI output remains a draft until a person reviews and publishes it.',
  lifecycleTitle: 'Retention and evidence',
  lifecycleDescription: 'Retention, legal hold, and deletion evidence are independent controls.',
  retentionTitle: 'Configured retention windows',
  retentionDescription: 'Configuration does not by itself prove deletion execution.',
  observedAt: (value) => `Observed ${value}`,
  days: (value) => `${value} days`,
  states: {
    READY: 'Ready',
    BLOCKED: 'Blocked',
    CONNECTION_REQUIRED: 'Connection required',
    NOT_VERIFIED: 'Not verified',
  },
  reason: (value) => value,
  pipeline: {
    consent: item('Consent and plan'),
    recording: item('Recording provider'),
    encryption: item('Encryption and storage'),
    transcript: item('Speech to text'),
    model: item('Approved AI'),
    publication: item('Review and publication'),
    deletion: item('Retention and deletion'),
  },
  capabilities: {
    recording: item('Recording'),
    transcript: item('Transcript'),
    aiNotes: item('AI meeting notes'),
  },
  dependencies: {
    provider: item('Realtime provider'),
    region: item('Processing region'),
    kms: item('Key management'),
    audit: item('Audit delivery'),
    egress: item('Media egress'),
    storage: item('Encrypted storage'),
    stt: item('Speech to text'),
    llm: item('Language model'),
  },
  governance: {
    humanReview: item('Human review'),
    explicitPublish: item('Explicit publish'),
    adminContentAccess: item('JIT administrator access'),
    legalHold: item('Legal hold'),
    deletionEvidence: item('Deletion evidence'),
    workFollowUpPromotion: item('Work follow-up promotion'),
    followUpReassignment: item('Follow-up reassignment'),
  },
  retention: {
    meeting: item('Meeting record'),
    artifact: item('Artifacts'),
    chat: item('Meeting chat'),
    intelligence: item('AI intelligence reports'),
    worker: item('Retention execution worker'),
  },
};

const runtimeReadiness: RuntimeMeetingAdminIntelligenceReadiness = {
  readinessVersion: 'meeting-intelligence-readiness-v1',
  observedAt: '2026-08-28T00:00:00Z',
  recordingPolicy: 'ADMIN_REQUIRED',
  providerCode: 'managed-provider',
  providerModel: 'enterprise-model',
  processingRegion: 'kr-central-1',
  capabilities: {
    recording: { state: 'READY' },
    transcript: { state: 'BLOCKED', reason: 'STT_NOT_READY' },
    aiNotes: { state: 'BLOCKED', reason: 'LLM_NOT_READY' },
  },
  dependencies: {
    provider: { state: 'READY' },
    region: { state: 'READY' },
    kms: { state: 'READY' },
    audit: { state: 'READY' },
    egress: { state: 'READY' },
    storage: { state: 'READY' },
    stt: { state: 'BLOCKED', reason: 'STT_NOT_READY' },
    llm: { state: 'BLOCKED', reason: 'LLM_NOT_READY' },
  },
  governance: {
    humanReview: { state: 'READY' },
    explicitPublish: { state: 'READY' },
    adminContentAccess: { state: 'READY' },
    legalHold: {
      state: 'NOT_VERIFIED',
      reason: 'LEGAL_HOLD_ADMIN_WORKFLOW_NOT_CONFIGURED',
    },
    deletionEvidence: {
      state: 'NOT_VERIFIED',
      reason: 'COMPLETE_DELETION_EVIDENCE_NOT_VERIFIED',
    },
  },
  retention: {
    meetingDays: 90,
    artifactDays: 30,
    chatDays: 60,
    intelligenceWorkerReady: true,
    signals: {
      intelligenceReports: { state: 'READY' },
      meetingRecords: {
        state: 'NOT_VERIFIED',
        reason: 'MEETING_RECORD_RETENTION_WORKER_NOT_CONFIGURED',
      },
      artifacts: {
        state: 'NOT_VERIFIED',
        reason: 'ARTIFACT_RETENTION_WORKER_NOT_CONFIGURED',
      },
      chat: {
        state: 'NOT_VERIFIED',
        reason: 'CHAT_RETENTION_WORKER_NOT_CONFIGURED',
      },
    },
  },
};

describe('meeting admin policy validation', () => {
  it('keeps every supported recording policy available to the administrator UI', () => {
    expect(MEETING_RECORDING_POLICIES).toEqual(['NEVER', 'HOST_OPT_IN', 'ADMIN_REQUIRED']);
  });

  it('blocks chat and artifact retention beyond the meeting retention window', () => {
    const validation = validateMeetingAdminPolicy({
      retentionDays: 30,
      chatRetentionDays: 31,
      artifactRetentionDays: 45,
    });

    expect(validation).toEqual({
      chatRetention: 'EXCEEDS_MEETING_RETENTION',
      artifactRetention: 'EXCEEDS_MEETING_RETENTION',
    });
    expect(hasMeetingAdminPolicyErrors(validation)).toBe(true);
  });

  it('accepts independent retention windows within their server constraints', () => {
    expect(
      validateMeetingAdminPolicy({
        retentionDays: 90,
        chatRetentionDays: 0,
        artifactRetentionDays: 30,
      })
    ).toEqual({ chatRetention: null, artifactRetention: null });
  });

  it('rejects a non-integer or out-of-range chat retention', () => {
    expect(
      validateMeetingAdminPolicy({
        retentionDays: 3650,
        chatRetentionDays: 365.5,
        artifactRetentionDays: 3650,
      }).chatRetention
    ).toBe('RANGE');
  });
});

describe('meeting admin operations projection', () => {
  it('includes governed transcript readiness in the operations capability list', () => {
    expect(MEETING_ADMIN_OPERATION_CAPABILITIES).toContain('transcript');
    expect(
      isMeetingAdminCapabilityAvailable(
        { ...capabilities, transcriptConfigured: true },
        'transcript'
      )
    ).toBe(true);
  });

  it('shows a reported quality score and uses a dash only when telemetry is absent', () => {
    expect(formatMeetingAdminQualityScore(96)).toBe('96 / 100');
    expect(formatMeetingAdminQualityScore(null)).toBe('—');
  });
});

describe('meeting admin intelligence control center', () => {
  it('projects authoritative runtime evidence without inferring readiness from configuration', () => {
    const readiness = projectMeetingAdminIntelligenceReadiness(runtimeReadiness);

    expect(readiness.capabilities.recording).toEqual({ state: 'READY' });
    expect(readiness.capabilities.transcript).toEqual({
      state: 'BLOCKED',
      reason: 'STT_NOT_READY',
    });
    expect(readiness.dependencies.provider).toEqual({ state: 'READY' });
    expect(readiness.governance.adminContentAccess.state).toBe('READY');
    expect(readiness.providerModel).toBe('enterprise-model');
    expect(readiness.recordingPolicy).toBe('ADMIN_REQUIRED');
    expect(readiness.retention).toEqual({
      meetingDays: 90,
      artifactDays: 30,
      chatDays: 60,
      intelligenceWorkerReady: true,
      signals: runtimeReadiness.retention.signals,
    });
  });

  it('fails closed when the readiness endpoint or a required runtime signal is unavailable', () => {
    const unavailable = createUnavailableMeetingAdminIntelligenceReadiness(policy);
    const missingSignal = projectMeetingAdminIntelligenceReadiness({
      ...runtimeReadiness,
      dependencies: { ...runtimeReadiness.dependencies, kms: undefined! },
    });

    expect(unavailable.capabilities.recording).toEqual({
      state: 'NOT_VERIFIED',
      reason: 'READINESS_ENDPOINT_UNAVAILABLE',
    });
    expect(unavailable.retention.intelligenceWorkerReady).toBeNull();
    expect(unavailable.retention.signals.artifacts).toEqual({
      state: 'NOT_VERIFIED',
      reason: 'READINESS_ENDPOINT_UNAVAILABLE',
    });
    expect(missingSignal.dependencies.kms).toEqual({
      state: 'NOT_VERIFIED',
      reason: 'RUNTIME_SIGNAL_MISSING',
    });
  });

  it('renders every governed dependency and principle without unsafe enable controls', () => {
    const readiness = projectMeetingAdminIntelligenceReadiness(runtimeReadiness);
    const markup = renderToStaticMarkup(
      createElement(MeetingAdminIntelligence, { readiness, labels })
    );

    expect(markup).toContain('Recording, transcript, and AI readiness');
    expect(markup).toContain('Realtime provider');
    expect(markup).toContain('Processing region');
    expect(markup).toContain('Key management');
    expect(markup).toContain('Audit delivery');
    expect(markup).toContain('Media egress');
    expect(markup).toContain('Encrypted storage');
    expect(markup).toContain('Speech to text');
    expect(markup).toContain('Language model');
    expect(markup).toContain('Human review');
    expect(markup).toContain('Explicit publish');
    expect(markup).toContain('JIT administrator access');
    expect(markup).toContain('Legal hold');
    expect(markup).toContain('Deletion evidence');
    expect(markup).toContain('Work follow-up promotion');
    expect(markup).toContain('Follow-up reassignment');
    expect(markup).toContain('Administrators have no default access to meeting content.');
    expect(markup).toContain('enterprise-model');
    expect(markup).toContain('Retention execution worker');
    expect(markup).toContain('AI intelligence reports');
    expect(markup).toContain('MEETING_RECORD_RETENTION_WORKER_NOT_CONFIGURED');
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('<input');
  });
});
