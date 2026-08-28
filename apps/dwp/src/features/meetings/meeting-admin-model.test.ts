import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type {
  VideoMeetingAdminCapabilities,
  VideoMeetingAdminPolicy,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

import {
  MeetingAdminIntelligence,
  type MeetingAdminIntelligenceLabels,
} from './meeting-admin-intelligence';
import {
  MEETING_ADMIN_OPERATION_CAPABILITIES,
  deriveMeetingAdminIntelligenceReadiness,
  formatMeetingAdminQualityScore,
  hasMeetingAdminPolicyErrors,
  isMeetingAdminCapabilityAvailable,
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
  reasons: {
    POLICY_NEVER: 'Tenant policy prohibits recording.',
    CAPABILITY_NOT_CONFIGURED: 'The capability is not configured.',
    REALTIME_PROVIDER_UNAVAILABLE: 'The realtime provider is unavailable.',
    DEPENDENCY_STATUS_CONTRACT_MISSING: 'A readiness contract must be connected.',
    WORKFLOW_ENFORCEMENT_NOT_VERIFIED: 'Workflow enforcement is not verified.',
    LEGAL_HOLD_NOT_CONNECTED: 'Legal hold is not connected.',
    DELETION_EVIDENCE_NOT_CONNECTED: 'Deletion evidence is not connected.',
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
  },
  retention: {
    meeting: item('Meeting record'),
    artifact: item('Artifacts'),
    chat: item('Meeting chat'),
  },
};

describe('meeting admin policy validation', () => {
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
  it('derives fail-closed content and dependency states from the available contract', () => {
    const readiness = deriveMeetingAdminIntelligenceReadiness(
      policy,
      capabilities,
      '2026-08-28T00:00:00Z'
    );

    expect(readiness.capabilities.recording).toEqual({
      state: 'BLOCKED',
      reason: 'POLICY_NEVER',
    });
    expect(readiness.capabilities.transcript.state).toBe('CONNECTION_REQUIRED');
    expect(readiness.capabilities.aiNotes.state).toBe('CONNECTION_REQUIRED');
    expect(readiness.dependencies.provider).toEqual({ state: 'READY' });
    expect(readiness.dependencies.kms.state).toBe('CONNECTION_REQUIRED');
    expect(readiness.governance.adminContentAccess.state).toBe('NOT_VERIFIED');
    expect(readiness.retention).toEqual({ meetingDays: 90, artifactDays: 30, chatDays: 60 });
  });

  it('renders every governed dependency and principle without unsafe enable controls', () => {
    const readiness = deriveMeetingAdminIntelligenceReadiness(
      policy,
      capabilities,
      '2026-08-28T00:00:00Z'
    );
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
    expect(markup).toContain('Administrators have no default access to meeting content.');
    expect(markup).not.toContain('<button');
    expect(markup).not.toContain('<input');
  });
});
