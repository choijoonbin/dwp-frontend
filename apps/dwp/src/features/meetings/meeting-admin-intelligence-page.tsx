import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { LoadingState, PageCanvas } from '@dwp-frontend/design-system';
import { useAuth } from '@dwp-frontend/shared-utils';
import { getVideoMeetingAdminPolicy } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { getVideoMeetingAdminIntelligenceReadiness } from '@dwp-frontend/shared-utils/api/video-meeting-admin-intelligence-api';

import {
  MeetingAdminIntelligence,
  type MeetingAdminIntelligenceLabels,
  type MeetingAdminIntelligenceSourceFailure,
} from './meeting-admin-intelligence';
import {
  createUnavailableMeetingAdminIntelligenceReadiness,
  projectMeetingAdminIntelligenceReadiness,
  type MeetingAdminIntelligenceCapabilityKey,
  type MeetingAdminIntelligenceDependencyKey,
  type MeetingAdminIntelligenceGovernanceKey,
  type MeetingAdminReadinessState,
} from './meeting-admin-model';

const STATES: readonly MeetingAdminReadinessState[] = [
  'READY',
  'BLOCKED',
  'CONNECTION_REQUIRED',
  'NOT_VERIFIED',
];
const CAPABILITIES: readonly MeetingAdminIntelligenceCapabilityKey[] = [
  'recording',
  'transcript',
  'aiNotes',
];
const DEPENDENCIES: readonly MeetingAdminIntelligenceDependencyKey[] = [
  'provider',
  'region',
  'kms',
  'audit',
  'egress',
  'storage',
  'stt',
  'llm',
];
const GOVERNANCE: readonly MeetingAdminIntelligenceGovernanceKey[] = [
  'humanReview',
  'explicitPublish',
  'adminContentAccess',
  'workFollowUpPromotion',
  'followUpReassignment',
  'legalHold',
  'deletionEvidence',
];

export function MeetingAdminIntelligencePage() {
  const { t } = useTranslation('meetings');
  const { user, isAuthenticated } = useAuth();
  const identityScope = JSON.stringify([
    isAuthenticated,
    user?.identityPlane ?? null,
    user?.tenantId ?? null,
    user?.userId ?? null,
  ]);
  const readinessQuery = useQuery({
    queryKey: ['meetings', 'admin', 'intelligence', 'readiness', identityScope],
    queryFn: getVideoMeetingAdminIntelligenceReadiness,
    staleTime: 20_000,
    retry: 1,
    gcTime: 0,
    meta: { accessSensitive: true },
  });
  const policyQuery = useQuery({
    queryKey: ['meetings', 'admin', 'policy', identityScope],
    queryFn: getVideoMeetingAdminPolicy,
    staleTime: 30_000,
    retry: 1,
    gcTime: 0,
    meta: { accessSensitive: true },
  });

  if (readinessQuery.isLoading && !readinessQuery.data) {
    return (
      <PageCanvas>
        <LoadingState label={t('admin.intelligence.loading')} variant="skeleton" skeletonRows={8} />
      </PageCanvas>
    );
  }
  const sourceFailures: MeetingAdminIntelligenceSourceFailure[] = [];
  if (readinessQuery.isError) {
    sourceFailures.push({
      key: 'readiness',
      message: t('admin.intelligence.sourceErrors.readiness'),
      retryLabel: t('actions.retry'),
      onRetry: () => void readinessQuery.refetch(),
    });
  }
  if (policyQuery.isError) {
    sourceFailures.push({
      key: 'policy',
      message: t('admin.intelligence.sourceErrors.policy'),
      retryLabel: t('actions.retry'),
      onRetry: () => void policyQuery.refetch(),
    });
  }

  return (
    <MeetingAdminIntelligence
      readiness={
        readinessQuery.data
          ? projectMeetingAdminIntelligenceReadiness(readinessQuery.data)
          : createUnavailableMeetingAdminIntelligenceReadiness(policyQuery.data)
      }
      labels={labels(t)}
      sourceFailures={sourceFailures}
    />
  );
}

function labels(t: (key: string, options?: Record<string, unknown>) => string) {
  const item = (group: string, key: string) => ({
    label: t(`admin.intelligence.${group}.${key}.label`),
    description: t(`admin.intelligence.${group}.${key}.description`),
  });
  return {
    eyebrow: t('admin.eyebrow'),
    title: t('admin.intelligence.title'),
    description: t('admin.intelligence.description'),
    accessBoundary: t('admin.intelligence.accessBoundary'),
    runtimeEvidenceTitle: t('admin.intelligence.runtimeEvidenceTitle'),
    runtimeEvidence: {
      version: t('admin.intelligence.runtimeEvidence.version'),
      recordingPolicy: t('admin.intelligence.runtimeEvidence.recordingPolicy'),
      provider: t('admin.intelligence.runtimeEvidence.provider'),
      model: t('admin.intelligence.runtimeEvidence.model'),
      region: t('admin.intelligence.runtimeEvidence.region'),
    },
    recordingPolicies: {
      NEVER: t('admin.intelligence.recordingPolicies.NEVER'),
      HOST_OPT_IN: t('admin.intelligence.recordingPolicies.HOST_OPT_IN'),
      ADMIN_REQUIRED: t('admin.intelligence.recordingPolicies.ADMIN_REQUIRED'),
    },
    unavailable: t('admin.intelligence.unavailable'),
    readinessTitle: t('admin.intelligence.readinessTitle'),
    readinessProgress: (ready: number, total: number) =>
      t('admin.intelligence.readinessProgress', { ready, total }),
    pipelineTitle: t('admin.intelligence.pipelineTitle'),
    pipelineDescription: t('admin.intelligence.pipelineDescription'),
    capabilitiesTitle: t('admin.intelligence.capabilitiesTitle'),
    capabilitiesDescription: t('admin.intelligence.capabilitiesDescription'),
    dependenciesTitle: t('admin.intelligence.dependenciesTitle'),
    dependenciesDescription: t('admin.intelligence.dependenciesDescription'),
    workflowTitle: t('admin.intelligence.workflowTitle'),
    workflowDescription: t('admin.intelligence.workflowDescription'),
    lifecycleTitle: t('admin.intelligence.lifecycleTitle'),
    lifecycleDescription: t('admin.intelligence.lifecycleDescription'),
    retentionTitle: t('admin.intelligence.retentionTitle'),
    retentionDescription: t('admin.intelligence.retentionDescription'),
    observedAt: (value: string) => t('admin.intelligence.observedAt', { value }),
    days: (value: number | null) =>
      value == null ? t('admin.intelligence.unavailable') : t('admin.intelligence.days', { value }),
    states: Object.fromEntries(
      STATES.map((state) => [state, t(`admin.intelligence.states.${state}`)])
    ),
    reason: (value: string) =>
      t(`admin.intelligence.reasons.${value}`, {
        defaultValue: t('admin.intelligence.reasons.UNKNOWN', { value }),
        value,
      }),
    pipeline: Object.fromEntries(
      ['consent', 'recording', 'encryption', 'transcript', 'model', 'publication', 'deletion'].map(
        (key) => [key, item('pipeline', key)]
      )
    ),
    capabilities: Object.fromEntries(CAPABILITIES.map((key) => [key, item('capabilities', key)])),
    dependencies: Object.fromEntries(DEPENDENCIES.map((key) => [key, item('dependencies', key)])),
    governance: Object.fromEntries(GOVERNANCE.map((key) => [key, item('governance', key)])),
    retention: Object.fromEntries(
      ['meeting', 'artifact', 'chat', 'intelligence', 'worker'].map((key) => [
        key,
        item('retention', key),
      ])
    ),
  } as MeetingAdminIntelligenceLabels;
}
