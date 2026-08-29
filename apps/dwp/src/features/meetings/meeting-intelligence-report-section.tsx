import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { VideoMeetingArtifact } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { getVideoMeetingContentPlan } from '@dwp-frontend/shared-utils/api/video-meeting-content-api';

import {
  MeetingIntelligenceReport,
  type MeetingIntelligenceReportLabels,
} from './meeting-intelligence-report';

const STATES = [
  'UNAVAILABLE',
  'PROCESSING',
  'FAILURE',
  'DRAFT',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'DELETED',
] as const;
const GENERATE_BLOCKERS = [
  'NOT_HOST',
  'PROCESSING',
  'TRANSCRIPT_NOT_AVAILABLE',
  'CONTENT_PLAN_NOT_AVAILABLE',
] as const;
const SECTIONS = [
  'executiveSummary',
  'topics',
  'decisions',
  'actionItems',
  'openQuestions',
  'risks',
  'conversationClimate',
] as const;
const CLIMATE_LABELS = ['ALIGNED', 'MIXED', 'CONTESTED', 'INSUFFICIENT_EVIDENCE'] as const;
const CLIMATE_SIGNALS = [
  'CONSTRUCTIVE_DISAGREEMENT',
  'UNRESOLVED_DISAGREEMENT',
  'LOW_TRANSCRIPT_EVIDENCE',
] as const;
const REVIEW_REASONS = ['EVIDENCE_VERIFIED', 'INSUFFICIENT_EVIDENCE', 'SENSITIVE_CONTENT'] as const;

export function MeetingIntelligenceReportSection({
  meetingId,
  canHost,
  artifacts,
}: {
  meetingId: string;
  canHost: boolean;
  artifacts: VideoMeetingArtifact[];
}) {
  const { t } = useTranslation('meetings');
  const transcriptArtifact = useMemo(
    () =>
      artifacts.find(
        (artifact) =>
          artifact.artifactType === 'TRANSCRIPT' && artifact.artifactState === 'AVAILABLE'
      ) ?? null,
    [artifacts]
  );
  const contentPlanQuery = useQuery({
    queryKey: ['meetings', meetingId, 'content-plan'],
    queryFn: () => getVideoMeetingContentPlan(meetingId),
    enabled: canHost,
    staleTime: 30_000,
    retry: 1,
  });

  return (
    <MeetingIntelligenceReport
      meetingId={meetingId}
      canHost={canHost}
      transcriptArtifact={transcriptArtifact}
      contentPlanVersion={contentPlanQuery.data?.version ?? null}
      labels={intelligenceLabels(t)}
    />
  );
}

function intelligenceLabels(
  t: (key: string, options?: Record<string, unknown>) => string
): MeetingIntelligenceReportLabels {
  const root = 'history.recap.intelligence';
  return {
    title: t(`${root}.title`),
    description: t(`${root}.description`),
    loading: t(`${root}.loading`),
    loadErrorTitle: t(`${root}.loadErrorTitle`),
    loadErrorDescription: t(`${root}.loadErrorDescription`),
    retry: t(`${root}.retry`),
    refresh: t(`${root}.refresh`),
    refreshing: t(`${root}.refreshing`),
    states: translatedRecord(STATES, (state) => t(`${root}.states.${state}`)),
    stateDescriptions: translatedRecord(STATES, (state) => t(`${root}.stateDescriptions.${state}`)),
    generate: t(`${root}.generate`),
    regenerate: t(`${root}.regenerate`),
    generating: t(`${root}.generating`),
    generateBlockers: translatedRecord(GENERATE_BLOCKERS, (blocker) =>
      t(`${root}.generateBlockers.${blocker}`)
    ),
    actionError: t(`${root}.actionError`),
    processing: t(`${root}.processing`),
    failureCode: (value) => t(`${root}.failureCode`, { value }),
    disclaimerTitle: t(`${root}.disclaimerTitle`),
    disclaimerDescription: t(`${root}.disclaimerDescription`),
    evidenceTitle: t(`${root}.evidenceTitle`),
    evidenceDescription: t(`${root}.evidenceDescription`),
    retentionUntil: (value) => t(`${root}.retentionUntil`, { value }),
    legalHold: t(`${root}.legalHold`),
    schemaVersion: (value) => t(`${root}.schemaVersion`, { value }),
    sections: translatedRecord(SECTIONS, (section) => t(`${root}.sections.${section}`)),
    sectionEmpty: t(`${root}.sectionEmpty`),
    citationLabel: (value) => t(`${root}.citationLabel`, { value }),
    citationDetail: (segmentId, value) => t(`${root}.citationDetail`, { segmentId, value }),
    climateDescription: t(`${root}.climateDescription`),
    climateLabels: translatedRecord(CLIMATE_LABELS, (label) => t(`${root}.climateLabels.${label}`)),
    climateSignals: translatedRecord(CLIMATE_SIGNALS, (signal) =>
      t(`${root}.climateSignals.${signal}`)
    ),
    reviewTitle: t(`${root}.reviewTitle`),
    reviewDescription: t(`${root}.reviewDescription`),
    reviewSeparationNote: t(`${root}.reviewSeparationNote`),
    reviewReasonLabel: t(`${root}.reviewReasonLabel`),
    reviewReasonPlaceholder: t(`${root}.reviewReasonPlaceholder`),
    reviewReasons: REVIEW_REASONS.map((code) => ({
      code,
      label: t(`${root}.reviewReasons.${code}`),
    })),
    approve: t(`${root}.approve`),
    approving: t(`${root}.approving`),
    reject: t(`${root}.reject`),
    rejecting: t(`${root}.rejecting`),
    publishTitle: t(`${root}.publishTitle`),
    publishDescription: t(`${root}.publishDescription`),
    publish: t(`${root}.publish`),
    publishing: t(`${root}.publishing`),
  };
}

function translatedRecord<Key extends string>(
  keys: readonly Key[],
  translate: (key: Key) => string
): Record<Key, string> {
  return Object.fromEntries(keys.map((key) => [key, translate(key)])) as Record<Key, string>;
}
