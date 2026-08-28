import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ErrorState, LoadingState, PageCanvas } from '@dwp-frontend/design-system';
import {
  getVideoMeetingAdminOverview,
  getVideoMeetingAdminPolicy,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

import {
  MeetingAdminIntelligence,
  type MeetingAdminIntelligenceLabels,
} from './meeting-admin-intelligence';
import {
  deriveMeetingAdminIntelligenceReadiness,
  type MeetingAdminIntelligenceCapabilityKey,
  type MeetingAdminIntelligenceDependencyKey,
  type MeetingAdminIntelligenceGovernanceKey,
  type MeetingAdminReadinessReason,
  type MeetingAdminReadinessState,
} from './meeting-admin-model';

const STATES: readonly MeetingAdminReadinessState[] = [
  'READY',
  'BLOCKED',
  'CONNECTION_REQUIRED',
  'NOT_VERIFIED',
];
const REASONS: readonly MeetingAdminReadinessReason[] = [
  'POLICY_NEVER',
  'CAPABILITY_NOT_CONFIGURED',
  'REALTIME_PROVIDER_UNAVAILABLE',
  'DEPENDENCY_STATUS_CONTRACT_MISSING',
  'WORKFLOW_ENFORCEMENT_NOT_VERIFIED',
  'LEGAL_HOLD_NOT_CONNECTED',
  'DELETION_EVIDENCE_NOT_CONNECTED',
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
  'legalHold',
  'deletionEvidence',
];

export function MeetingAdminIntelligencePage() {
  const { t } = useTranslation('meetings');
  const query = useQuery({
    queryKey: ['meetings', 'admin', 'intelligence'],
    queryFn: async () => {
      const [overview, policy] = await Promise.all([
        getVideoMeetingAdminOverview(),
        getVideoMeetingAdminPolicy(),
      ]);
      return { overview, policy };
    },
    staleTime: 20_000,
    retry: 1,
  });

  if (query.isLoading) {
    return (
      <PageCanvas>
        <LoadingState
          label={t('admin.intelligence.loading')}
          variant="skeleton"
          skeletonRows={8}
        />
      </PageCanvas>
    );
  }
  if (query.isError || !query.data) {
    return (
      <PageCanvas>
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('errors.loadDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      </PageCanvas>
    );
  }

  return (
    <MeetingAdminIntelligence
      readiness={deriveMeetingAdminIntelligenceReadiness(
        query.data.policy,
        query.data.overview.capabilities
      )}
      labels={labels(t)}
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
    days: (value: number) => t('admin.intelligence.days', { value }),
    states: Object.fromEntries(
      STATES.map((state) => [state, t(`admin.intelligence.states.${state}`)])
    ),
    reasons: Object.fromEntries(
      REASONS.map((reason) => [reason, t(`admin.intelligence.reasons.${reason}`)])
    ),
    capabilities: Object.fromEntries(
      CAPABILITIES.map((key) => [key, item('capabilities', key)])
    ),
    dependencies: Object.fromEntries(
      DEPENDENCIES.map((key) => [key, item('dependencies', key)])
    ),
    governance: Object.fromEntries(
      GOVERNANCE.map((key) => [key, item('governance', key)])
    ),
    retention: Object.fromEntries(
      ['meeting', 'artifact', 'chat'].map((key) => [key, item('retention', key)])
    ),
  } as MeetingAdminIntelligenceLabels;
}
