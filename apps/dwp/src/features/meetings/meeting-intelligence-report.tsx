import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  FileQuestion,
  Flag,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, ErrorState, LoadingState, SelectField } from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import type { VideoMeetingArtifact } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import {
  createVideoMeetingIntelligenceRun,
  getLatestVisibleVideoMeetingIntelligenceReport,
  getVideoMeetingIntelligenceRun,
  publishVideoMeetingIntelligenceReport,
  reviewVideoMeetingIntelligenceReport,
  type VideoMeetingIntelligenceAnalysis,
  type VideoMeetingIntelligenceCitation,
  type VideoMeetingIntelligenceCitedText,
  type VideoMeetingIntelligenceClimateLabel,
  type VideoMeetingIntelligenceClimateSignal,
  type VideoMeetingIntelligenceReport,
  type VideoMeetingIntelligenceReviewDecision,
  type VideoMeetingIntelligenceRun,
} from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip, { type ChipProps } from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import {
  deriveMeetingIntelligenceActions,
  deriveMeetingIntelligenceSurfaceState,
  formatMeetingIntelligenceCitation,
  meetingIntelligenceTimestampDuration,
  selectFreshlyAuthorizedMeetingIntelligenceReport,
  selectMeetingIntelligenceReportForViewer,
  type MeetingIntelligenceGenerateBlocker,
  type MeetingIntelligenceInsightCollectionKey,
  type MeetingIntelligenceReportSectionKey,
  type MeetingIntelligenceSurfaceState,
} from './meeting-intelligence-report-model';
import {
  createMeetingIntelligenceAuthorizationFence,
  isMeetingIntelligenceAuthorizationError,
  MeetingIntelligenceAuthorizationSupersededError,
  selectMeetingIntelligenceAuthorizedWriteback,
  type AuthorizedActiveRun,
  type AuthorizedPublishCommand,
  type AuthorizedReviewCommand,
  type AuthorizedRunCommand,
  type MeetingIntelligenceAuthorizationValidation,
} from './meeting-intelligence-authorization-fence';
import {
  clearIntelligenceIntent,
  createStoredIntelligenceIntent,
  persistIntelligenceIntent,
  readStoredIntelligenceIntent,
  type StoredIntelligenceIntent,
} from './meeting-intelligence-intent';

export type MeetingIntelligenceReviewReason = {
  code: string;
  label: string;
};

export type MeetingIntelligenceReportLabels = {
  title: string;
  description: string;
  loading: string;
  loadErrorTitle: string;
  loadErrorDescription: string;
  retry: string;
  refresh: string;
  refreshing: string;
  states: Record<MeetingIntelligenceSurfaceState, string>;
  stateDescriptions: Record<MeetingIntelligenceSurfaceState, string>;
  generate: string;
  regenerate: string;
  generating: string;
  generateBlockers: Record<MeetingIntelligenceGenerateBlocker, string>;
  actionError: string;
  processing: string;
  failureCode: (value: string) => string;
  disclaimerTitle: string;
  disclaimerDescription: string;
  evidenceTitle: string;
  evidenceDescription: string;
  retentionUntil: (value: string) => string;
  legalHold: string;
  schemaVersion: (value: string) => string;
  sections: Record<MeetingIntelligenceReportSectionKey, string>;
  sectionEmpty: string;
  citationLabel: (value: string) => string;
  citationDetail: (segmentId: string, value: string) => string;
  climateDescription: string;
  climateLabels: Record<VideoMeetingIntelligenceClimateLabel, string>;
  climateSignals: Record<VideoMeetingIntelligenceClimateSignal, string>;
  reviewTitle: string;
  reviewDescription: string;
  reviewSeparationNote: string;
  reviewReasonLabel: string;
  reviewReasonPlaceholder: string;
  reviewReasons: readonly MeetingIntelligenceReviewReason[];
  approve: string;
  approving: string;
  reject: string;
  rejecting: string;
  publishTitle: string;
  publishDescription: string;
  publish: string;
  publishing: string;
};

export type MeetingIntelligenceReportProps = {
  meetingId: string;
  canHost: boolean;
  transcriptArtifact?: VideoMeetingArtifact | null;
  contentPlanVersion?: number | null;
  labels: MeetingIntelligenceReportLabels;
};

const COLLECTION_ICONS: Record<MeetingIntelligenceInsightCollectionKey, LucideIcon> = {
  topics: MessageSquareText,
  decisions: ListChecks,
  actionItems: Target,
  openQuestions: FileQuestion,
  risks: TriangleAlert,
};

const STATUS_COLORS: Record<MeetingIntelligenceSurfaceState, ChipProps['color']> = {
  UNAVAILABLE: 'default',
  PROCESSING: 'info',
  FAILURE: 'error',
  DRAFT: 'warning',
  APPROVED: 'info',
  PUBLISHED: 'success',
  REJECTED: 'error',
  DELETED: 'default',
};

export function MeetingIntelligenceReport({
  meetingId,
  canHost,
  transcriptArtifact,
  contentPlanVersion,
  labels,
}: MeetingIntelligenceReportProps) {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = useMemo(
    () => ['meetings', meetingId, 'intelligence', 'reports', 'latest'] as const,
    [meetingId]
  );
  const authorizationFenceRef = useRef<ReturnType<
    typeof createMeetingIntelligenceAuthorizationFence
  > | null>(null);
  if (!authorizationFenceRef.current || authorizationFenceRef.current.scope !== meetingId) {
    authorizationFenceRef.current = createMeetingIntelligenceAuthorizationFence(meetingId);
  }
  const authorizationFence = authorizationFenceRef.current;
  const [authorizationFailureScope, setAuthorizationFailureScope] = useState<string | null>(null);
  const [activeRunState, setActiveRunState] = useState<AuthorizedActiveRun | null>(null);
  const [reviewReason, setReviewReason] = useState(labels.reviewReasons[0]?.code ?? '');
  const generateIntentRef = useRef<StoredIntelligenceIntent | null>(null);

  const denyAuthorization = (validation?: MeetingIntelligenceAuthorizationValidation) => {
    const currentFence = authorizationFenceRef.current;
    if (!currentFence || currentFence.scope !== meetingId) return;
    const generation = validation ? currentFence.deny(validation) : currentFence.revoke();
    if (generation === null) return;
    queryClient.setQueryData<VideoMeetingIntelligenceReport | null>(queryKey, null);
    setAuthorizationFailureScope(meetingId);
  };

  const latestQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const validation = authorizationFenceRef.current?.beginValidation();
      if (!validation) throw new MeetingIntelligenceAuthorizationSupersededError();
      try {
        const report = await getLatestVisibleVideoMeetingIntelligenceReport(meetingId);
        const currentFence = authorizationFenceRef.current;
        if (!currentFence || !currentFence.authorize(validation)) {
          throw new MeetingIntelligenceAuthorizationSupersededError();
        }
        setAuthorizationFailureScope((scope) => (scope === meetingId ? null : scope));
        return report;
      } catch (error) {
        if (!(error instanceof MeetingIntelligenceAuthorizationSupersededError)) {
          denyAuthorization(validation);
        }
        throw error;
      }
    },
    staleTime: 30_000,
    retry: (failureCount, error) =>
      !(error instanceof MeetingIntelligenceAuthorizationSupersededError) &&
      !isMeetingIntelligenceAuthorizationError(error) &&
      failureCount < 1,
  });
  const latestAuthorizationFailed =
    authorizationFailureScope === meetingId || latestQuery.isError || latestQuery.isRefetchError;
  const latestReport = selectFreshlyAuthorizedMeetingIntelligenceReport(
    latestQuery.data,
    latestAuthorizationFailed
  );

  const authorizedActiveRun =
    activeRunState && authorizationFence.canCommit(activeRunState.authorization)
      ? activeRunState
      : null;

  const runQuery = useQuery({
    queryKey: ['meetings', meetingId, 'intelligence', 'runs', authorizedActiveRun?.run.runId],
    queryFn: async () => {
      try {
        return await getVideoMeetingIntelligenceRun(
          meetingId,
          authorizedActiveRun?.run.runId ?? ''
        );
      } catch (error) {
        if (isMeetingIntelligenceAuthorizationError(error)) denyAuthorization();
        throw error;
      }
    },
    enabled: authorizedActiveRun?.run.state === 'RUNNING',
    refetchInterval: (query) => (query.state.data?.state === 'RUNNING' ? 2_000 : false),
    retry: (failureCount, error) =>
      !isMeetingIntelligenceAuthorizationError(error) && failureCount < 1,
  });

  useEffect(() => {
    const run = runQuery.data;
    const authorization = authorizedActiveRun?.authorization;
    if (!run || !authorization) return;
    authorizationFenceRef.current?.commit(authorization, () => {
      setActiveRunState({ run, authorization });
      if (run.state !== 'RUNNING' && generateIntentRef.current) {
        clearIntelligenceIntent(meetingId, generateIntentRef.current.idempotencyKey);
        generateIntentRef.current = null;
      }
      if (run.state === 'SUCCEEDED') void queryClient.refetchQueries({ queryKey });
    });
  }, [authorizedActiveRun?.authorization, meetingId, queryClient, queryKey, runQuery.data]);

  useEffect(() => {
    if (labels.reviewReasons.some((reason) => reason.code === reviewReason)) return;
    setReviewReason(labels.reviewReasons[0]?.code ?? '');
  }, [labels.reviewReasons, reviewReason]);

  const generateMutation = useMutation({
    mutationFn: (_command: AuthorizedRunCommand) => {
      const outputLanguage = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
      const fingerprint = [
        meetingId,
        transcriptArtifact?.artifactId ?? '',
        contentPlanVersion ?? -1,
        outputLanguage,
      ].join(':');
      const baselineReportId = latestReport?.reportId ?? null;
      const persisted = readStoredIntelligenceIntent(meetingId);
      const reusable = [generateIntentRef.current, persisted].find(
        (intent) =>
          intent?.fingerprint === fingerprint && intent.baselineReportId === baselineReportId
      );
      if (!reusable) {
        generateIntentRef.current = createStoredIntelligenceIntent(fingerprint, baselineReportId);
        persistIntelligenceIntent(meetingId, generateIntentRef.current);
      } else {
        generateIntentRef.current = reusable;
      }
      return createVideoMeetingIntelligenceRun(meetingId, {
        sourceArtifactId: transcriptArtifact?.artifactId ?? '',
        outputLanguage,
        expectedContentPlanVersion: contentPlanVersion ?? -1,
        idempotencyKey: generateIntentRef.current.idempotencyKey,
      });
    },
    onSuccess: async (run, command) => {
      if (!authorizationFenceRef.current?.canCommit(command.authorization)) return;
      if (run.state !== 'RUNNING' && generateIntentRef.current) {
        clearIntelligenceIntent(meetingId, generateIntentRef.current.idempotencyKey);
        generateIntentRef.current = null;
      }
      setActiveRunState({ run, authorization: command.authorization });
      if (run.state === 'SUCCEEDED') await queryClient.refetchQueries({ queryKey });
    },
    onError: (error) => isMeetingIntelligenceAuthorizationError(error) && denyAuthorization(),
  });

  const reviewMutation = useMutation({
    mutationFn: (command: AuthorizedReviewCommand) =>
      reviewVideoMeetingIntelligenceReport(meetingId, command.report.reportId, {
        expectedVersion: command.report.version,
        decision: command.decision,
        reasonCode: command.reasonCode,
      }),
    onSuccess: (report, command) => {
      authorizationFenceRef.current?.commit(command.authorization, () => {
        queryClient.setQueryData<VideoMeetingIntelligenceReport | null>(queryKey, (cached) =>
          selectMeetingIntelligenceAuthorizedWriteback(cached, report, command.report)
        );
      });
    },
    onError: (error) => isMeetingIntelligenceAuthorizationError(error) && denyAuthorization(),
  });

  const publishMutation = useMutation({
    mutationFn: (command: AuthorizedPublishCommand) =>
      publishVideoMeetingIntelligenceReport(
        meetingId,
        command.report.reportId,
        command.report.version
      ),
    onSuccess: (report, command) => {
      authorizationFenceRef.current?.commit(command.authorization, () => {
        queryClient.setQueryData<VideoMeetingIntelligenceReport | null>(queryKey, (cached) =>
          selectMeetingIntelligenceAuthorizedWriteback(cached, report, command.report)
        );
      });
    },
    onError: (error) => isMeetingIntelligenceAuthorizationError(error) && denyAuthorization(),
  });

  const currentRun = authorizedActiveRun ? (runQuery.data ?? authorizedActiveRun.run) : null;
  const visibleReport = selectMeetingIntelligenceReportForViewer(latestReport, canHost);
  const mutationPending =
    generateMutation.isPending || reviewMutation.isPending || publishMutation.isPending;
  const actions = deriveMeetingIntelligenceActions({
    canHost,
    transcriptArtifact,
    contentPlanVersion,
    report: visibleReport,
    run: currentRun,
    mutationPending,
  });
  const state = generateMutation.isPending
    ? 'PROCESSING'
    : runQuery.isError
      ? 'FAILURE'
      : deriveMeetingIntelligenceSurfaceState(visibleReport, currentRun);
  const actionError =
    generateMutation.isError ||
    reviewMutation.isError ||
    publishMutation.isError ||
    runQuery.isError;

  if (latestQuery.isLoading) {
    return <LoadingState label={labels.loading} variant="skeleton" skeletonRows={7} />;
  }
  if (latestAuthorizationFailed) {
    return (
      <ErrorState
        title={labels.loadErrorTitle}
        description={labels.loadErrorDescription}
        retryLabel={labels.retry}
        onRetry={() => latestQuery.refetch()}
      />
    );
  }

  return (
    <MeetingIntelligenceReportView
      state={state}
      report={visibleReport}
      run={currentRun}
      canHost={canHost}
      actions={actions}
      labels={labels}
      locale={resolveSupportedLocale(i18n.resolvedLanguage, i18n.language)}
      reviewReason={reviewReason}
      isRefreshing={latestQuery.isFetching}
      isGenerating={generateMutation.isPending}
      reviewDecision={reviewMutation.variables?.decision ?? null}
      isPublishing={publishMutation.isPending}
      actionError={actionError || latestQuery.isRefetchError}
      onReviewReasonChange={setReviewReason}
      onRefresh={() => latestQuery.refetch()}
      onGenerate={() =>
        actions.canGenerate &&
        generateMutation.mutate({ authorization: authorizationFenceRef.current!.capture() })
      }
      onReview={(decision) =>
        reviewReason &&
        (decision === 'APPROVE' ? actions.canApprove : actions.canReject) &&
        latestReport &&
        reviewMutation.mutate({
          authorization: authorizationFenceRef.current!.capture(),
          decision,
          reasonCode: reviewReason,
          report: latestReport,
        })
      }
      onPublish={() =>
        actions.canPublish &&
        latestReport &&
        publishMutation.mutate({
          authorization: authorizationFenceRef.current!.capture(),
          report: latestReport,
        })
      }
    />
  );
}

export function MeetingIntelligenceReportView({
  state,
  report,
  run,
  canHost,
  actions,
  labels,
  locale,
  reviewReason,
  isRefreshing,
  isGenerating,
  reviewDecision,
  isPublishing,
  actionError,
  onReviewReasonChange,
  onRefresh,
  onGenerate,
  onReview,
  onPublish,
}: {
  state: MeetingIntelligenceSurfaceState;
  report: VideoMeetingIntelligenceReport | null;
  run: VideoMeetingIntelligenceRun | null;
  canHost: boolean;
  actions: ReturnType<typeof deriveMeetingIntelligenceActions>;
  labels: MeetingIntelligenceReportLabels;
  locale: ReturnType<typeof resolveSupportedLocale>;
  reviewReason: string;
  isRefreshing: boolean;
  isGenerating: boolean;
  reviewDecision: VideoMeetingIntelligenceReviewDecision | null;
  isPublishing: boolean;
  actionError: boolean;
  onReviewReasonChange: (value: string) => void;
  onRefresh: () => void;
  onGenerate: () => void;
  onReview: (decision: VideoMeetingIntelligenceReviewDecision) => void;
  onPublish: () => void;
}) {
  const titleId = useId();
  return (
    <Box component="section" aria-labelledby={titleId} sx={{ minWidth: 0 }}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'stretch', md: 'flex-start' }}
        justifyContent="space-between"
        gap={2}
      >
        <Box sx={{ minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
            <Typography id={titleId} component="h2" variant="h5" fontWeight={850}>
              {labels.title}
            </Typography>
            <Chip
              size="small"
              variant="outlined"
              color={STATUS_COLORS[state]}
              label={labels.states[state]}
              aria-label={labels.states[state]}
              sx={{ fontWeight: 800 }}
            />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
            {labels.description}
          </Typography>
          <Typography role="status" variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {labels.stateDescriptions[state]}
          </Typography>
        </Box>

        <Stack direction="row" gap={1} flexWrap="wrap">
          <ActionButton
            intent="quiet"
            size="small"
            loading={isRefreshing}
            loadingLabel={labels.refreshing}
            startIcon={<RefreshCw size={15} aria-hidden="true" />}
            onClick={onRefresh}
          >
            {labels.refresh}
          </ActionButton>
          {canHost && (
            <ActionButton
              intent="secondary"
              size="small"
              loading={isGenerating}
              loadingLabel={labels.generating}
              disabled={!actions.canGenerate}
              startIcon={<Sparkles size={15} aria-hidden="true" />}
              onClick={onGenerate}
            >
              {report ? labels.regenerate : labels.generate}
            </ActionButton>
          )}
        </Stack>
      </Stack>

      {canHost && actions.generateBlocker && actions.generateBlocker !== 'NOT_HOST' && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {labels.generateBlockers[actions.generateBlocker]}
        </Typography>
      )}

      <Stack gap={2} sx={{ mt: 2.5 }}>
        <Alert
          severity="warning"
          icon={<ShieldCheck size={19} aria-hidden="true" />}
          sx={{ '& .MuiAlert-message': { overflow: 'visible' } }}
        >
          <Typography fontWeight={800}>{labels.disclaimerTitle}</Typography>
          <Typography variant="body2">{labels.disclaimerDescription}</Typography>
        </Alert>

        {state === 'PROCESSING' && (
          <Alert severity="info" role="status" icon={<Bot size={19} aria-hidden="true" />}>
            <Typography fontWeight={800}>{labels.states.PROCESSING}</Typography>
            <Typography variant="body2">{labels.processing}</Typography>
            <LinearProgress aria-label={labels.processing} sx={{ mt: 1.25 }} />
          </Alert>
        )}

        {state === 'FAILURE' && (
          <Alert severity="error" role="alert" icon={<CircleAlert size={19} aria-hidden="true" />}>
            <Typography fontWeight={800}>{labels.states.FAILURE}</Typography>
            <Typography variant="body2">
              {run?.failureCode
                ? labels.failureCode(run.failureCode)
                : labels.stateDescriptions.FAILURE}
            </Typography>
          </Alert>
        )}

        {actionError && (
          <Alert severity="error" role="alert">
            {labels.actionError}
          </Alert>
        )}

        {(state === 'UNAVAILABLE' || state === 'DELETED') && !report && (
          <EmptyReportState state={state} labels={labels} />
        )}

        {report?.analysis && (
          <>
            <ReportEvidenceHeader report={report} labels={labels} locale={locale} />
            <IntelligenceAnalysis analysis={report.analysis} labels={labels} />
          </>
        )}

        {report?.state === 'DRAFT' && report.canCurrentViewerReview && (
          <ReviewPanel
            labels={labels}
            reviewReason={reviewReason}
            canApprove={actions.canApprove && Boolean(reviewReason)}
            canReject={actions.canReject && Boolean(reviewReason)}
            reviewDecision={reviewDecision}
            onReviewReasonChange={onReviewReasonChange}
            onReview={onReview}
          />
        )}

        {canHost && report?.state === 'APPROVED' && (
          <Alert severity="info" icon={<Send size={19} aria-hidden="true" />}>
            <Typography fontWeight={800}>{labels.publishTitle}</Typography>
            <Typography variant="body2" sx={{ mb: 1.25 }}>
              {labels.publishDescription}
            </Typography>
            <ActionButton
              intent="primary"
              size="small"
              loading={isPublishing}
              loadingLabel={labels.publishing}
              disabled={!actions.canPublish}
              onClick={onPublish}
            >
              {labels.publish}
            </ActionButton>
          </Alert>
        )}
      </Stack>
    </Box>
  );
}

function EmptyReportState({
  state,
  labels,
}: {
  state: 'UNAVAILABLE' | 'DELETED';
  labels: MeetingIntelligenceReportLabels;
}) {
  const Icon = state === 'DELETED' ? CircleAlert : Bot;
  return (
    <Box
      sx={{
        p: { xs: 2.5, sm: 3.5 },
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          display: 'grid',
          width: 42,
          height: 42,
          placeItems: 'center',
          mx: 'auto',
          borderRadius: 1,
          color: 'text.secondary',
          bgcolor: 'action.hover',
        }}
      >
        <Icon size={21} aria-hidden="true" />
      </Box>
      <Typography component="h3" variant="subtitle1" fontWeight={800} sx={{ mt: 1.25 }}>
        {labels.states[state]}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {labels.stateDescriptions[state]}
      </Typography>
    </Box>
  );
}

function ReportEvidenceHeader({
  report,
  labels,
  locale,
}: {
  report: VideoMeetingIntelligenceReport;
  labels: MeetingIntelligenceReportLabels;
  locale: ReturnType<typeof resolveSupportedLocale>;
}) {
  return (
    <Box
      component="section"
      aria-label={labels.evidenceTitle}
      sx={{
        px: { xs: 2, sm: 2.5 },
        py: 2,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h3" variant="subtitle1" fontWeight={800}>
            {labels.evidenceTitle}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {labels.evidenceDescription}
          </Typography>
        </Box>
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          <Chip
            size="small"
            variant="outlined"
            label={labels.schemaVersion(report.schemaVersion)}
          />
          <Chip
            size="small"
            variant="outlined"
            label={labels.retentionUntil(
              formatDate(report.retentionUntil, { dateStyle: 'medium' }, locale)
            )}
          />
          {report.legalHold && (
            <Chip size="small" color="warning" icon={<Flag size={14} />} label={labels.legalHold} />
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

function IntelligenceAnalysis({
  analysis,
  labels,
}: {
  analysis: VideoMeetingIntelligenceAnalysis;
  labels: MeetingIntelligenceReportLabels;
}) {
  return (
    <Stack gap={2}>
      <Box
        component="section"
        aria-label={labels.sections.executiveSummary}
        sx={(theme) => ({
          p: { xs: 2.25, sm: 3 },
          border: 1,
          borderColor: 'primary.main',
          borderRadius: 1,
          bgcolor: alpha(theme.palette.primary.main, 0.055),
        })}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Lightbulb size={19} color="currentColor" aria-hidden="true" />
          <Typography component="h3" variant="h6" fontWeight={850}>
            {labels.sections.executiveSummary}
          </Typography>
        </Stack>
        <Typography variant="body1" sx={{ mt: 1.25, whiteSpace: 'pre-wrap' }}>
          {analysis.executiveSummary.text}
        </Typography>
        <CitationList citations={analysis.executiveSummary.citations} labels={labels} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
        }}
      >
        {(['topics', 'decisions', 'actionItems', 'openQuestions', 'risks'] as const).map((key) => (
          <CitedTextCollection
            key={key}
            icon={COLLECTION_ICONS[key]}
            title={labels.sections[key]}
            items={analysis[key]}
            labels={labels}
            wide={key === 'risks'}
          />
        ))}
      </Box>

      <ConversationClimate analysis={analysis} labels={labels} />
    </Stack>
  );
}

function CitedTextCollection({
  icon: Icon,
  title,
  items,
  labels,
  wide = false,
}: {
  icon: LucideIcon;
  title: string;
  items: VideoMeetingIntelligenceCitedText[];
  labels: MeetingIntelligenceReportLabels;
  wide?: boolean;
}) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={{
        minWidth: 0,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
        gridColumn: wide ? { lg: '1 / -1' } : undefined,
      }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ px: 2, py: 1.5 }}>
        <Icon size={18} aria-hidden="true" />
        <Typography component="h3" variant="subtitle1" fontWeight={800}>
          {title}
        </Typography>
      </Stack>
      <Divider />
      {items.length ? (
        <Stack
          component="ol"
          sx={{
            m: 0,
            p: 0,
            '& > li:not(:last-child)': { borderBottom: 1, borderColor: 'divider' },
          }}
        >
          {items.map((item, index) => (
            <Box
              component="li"
              key={`${item.text}-${index}`}
              sx={{ px: 2, py: 1.5, listStyle: 'none' }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {item.text}
              </Typography>
              <CitationList citations={item.citations} labels={labels} />
            </Box>
          ))}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.75 }}>
          {labels.sectionEmpty}
        </Typography>
      )}
    </Box>
  );
}

function CitationList({
  citations,
  labels,
}: {
  citations: VideoMeetingIntelligenceCitation[];
  labels: MeetingIntelligenceReportLabels;
}) {
  if (!citations.length) return null;
  return (
    <Stack role="list" direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
      {citations.map((citation, index) => {
        const range = formatMeetingIntelligenceCitation(citation);
        return (
          <Chip
            key={`${citation.segmentId}-${citation.startMillis}-${index}`}
            role="listitem"
            size="small"
            variant="outlined"
            label={
              <time dateTime={meetingIntelligenceTimestampDuration(citation.startMillis)}>
                {labels.citationLabel(range)}
              </time>
            }
            aria-label={labels.citationDetail(citation.segmentId, range)}
          />
        );
      })}
    </Stack>
  );
}

function ConversationClimate({
  analysis,
  labels,
}: {
  analysis: VideoMeetingIntelligenceAnalysis;
  labels: MeetingIntelligenceReportLabels;
}) {
  const climate = analysis.conversationClimate;
  return (
    <Box
      component="section"
      aria-label={labels.sections.conversationClimate}
      sx={{
        p: { xs: 2, sm: 2.5 },
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={1}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Sparkles size={18} aria-hidden="true" />
          <Typography component="h3" variant="subtitle1" fontWeight={800}>
            {labels.sections.conversationClimate}
          </Typography>
        </Stack>
        <Chip size="small" color="info" label={labels.climateLabels[climate.label]} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        {labels.climateDescription}
      </Typography>
      {climate.signals.length > 0 && (
        <Stack role="list" direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1.25 }}>
          {climate.signals.map((signal) => (
            <Chip
              key={signal}
              role="listitem"
              size="small"
              variant="outlined"
              label={labels.climateSignals[signal]}
            />
          ))}
        </Stack>
      )}
      <CitationList citations={climate.citations} labels={labels} />
    </Box>
  );
}

function ReviewPanel({
  labels,
  reviewReason,
  canApprove,
  canReject,
  reviewDecision,
  onReviewReasonChange,
  onReview,
}: {
  labels: MeetingIntelligenceReportLabels;
  reviewReason: string;
  canApprove: boolean;
  canReject: boolean;
  reviewDecision: VideoMeetingIntelligenceReviewDecision | null;
  onReviewReasonChange: (value: string) => void;
  onReview: (decision: VideoMeetingIntelligenceReviewDecision) => void;
}) {
  return (
    <Box
      component="section"
      aria-label={labels.reviewTitle}
      sx={{
        p: { xs: 2, sm: 2.5 },
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Stack direction="row" alignItems="center" gap={1}>
        <CheckCircle2 size={19} aria-hidden="true" />
        <Typography component="h3" variant="subtitle1" fontWeight={800}>
          {labels.reviewTitle}
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {labels.reviewDescription}
      </Typography>
      <Alert severity="info" sx={{ mt: 1.5 }}>
        {labels.reviewSeparationNote}
      </Alert>
      <Box sx={{ maxWidth: 520, mt: 2 }}>
        <SelectField<string>
          label={labels.reviewReasonLabel}
          value={reviewReason}
          placeholder={labels.reviewReasonPlaceholder}
          disabled={reviewDecision !== null}
          options={labels.reviewReasons.map((reason) => ({
            value: reason.code,
            label: reason.label,
          }))}
          onValueChange={(value) => onReviewReasonChange(String(value))}
        />
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ mt: 1.5 }}>
        <ActionButton
          intent="primary"
          loading={reviewDecision === 'APPROVE'}
          loadingLabel={labels.approving}
          disabled={!canApprove || reviewDecision !== null}
          onClick={() => onReview('APPROVE')}
        >
          {labels.approve}
        </ActionButton>
        <ActionButton
          intent="danger"
          loading={reviewDecision === 'REJECT'}
          loadingLabel={labels.rejecting}
          disabled={!canReject || reviewDecision !== null}
          onClick={() => onReview('REJECT')}
        >
          {labels.reject}
        </ActionButton>
      </Stack>
    </Box>
  );
}
