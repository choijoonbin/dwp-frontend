import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, CircleHelp, ShieldCheck } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ConfirmDialog,
  ErrorState,
  FormField,
  InlineFeedback,
  LoadingState,
  PageCanvas,
  SelectField,
} from '@dwp-frontend/design-system';
import { HttpError, useAuth, usePermissions, useToast } from '@dwp-frontend/shared-utils';
import {
  getVideoMeetingAdminOverview,
  getVideoMeetingAdminPolicy,
  updateVideoMeetingAdminPolicy,
  type VideoMeetingAdminPolicy,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { getVideoMeetingAdminIntelligenceReadiness } from '@dwp-frontend/shared-utils/api/video-meeting-admin-intelligence-api';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import {
  formatMeetingDateTime,
  MeetingMetric,
  MeetingPageHeading,
  MeetingSectionHeading,
} from './meeting-components';
import {
  createUnavailableMeetingAdminIntelligenceReadiness,
  formatMeetingAdminQualityScore,
  hasMeetingAdminPolicyErrors,
  MEETING_RECORDING_POLICIES,
  projectMeetingAdminIntelligenceReadiness,
  validateMeetingAdminPolicy,
  type MeetingAdminReadinessSignal,
} from './meeting-admin-model';
import { meetingListSurface, meetingSurface } from './meeting-visual-system';
import {
  MeetingAdminPolicyBoundaries,
  MeetingAdminPolicyImpact,
  MeetingAdminPolicySection,
} from './meeting-admin-policy-layout';

const POLICY_CHANGE_LABELS = {
  meetingsEnabled: 'admin.policy.meetingsEnabled',
  waitingRoomRequired: 'admin.policy.waitingRoom',
  requireAuthenticatedInternalUsers: 'admin.policy.authenticatedInternal',
  participantChatAllowed: 'admin.policy.chat',
  reactionsAllowed: 'admin.policy.reactions',
  screenShareAllowed: 'admin.policy.screenShare',
  recordingPolicy: 'admin.policy.recording',
  retentionDays: 'admin.policy.retention',
  chatRetentionDays: 'admin.policy.chatRetention',
  artifactRetentionDays: 'admin.policy.artifactRetention',
  maximumParticipants: 'admin.policy.maximumParticipants',
} as const satisfies Partial<Record<keyof VideoMeetingAdminPolicy, string>>;

type PolicyChangeKey = keyof typeof POLICY_CHANGE_LABELS;
type PolicyChangePatch = Partial<Pick<VideoMeetingAdminPolicy, PolicyChangeKey>>;
type PolicyConflict = {
  baseVersion: number;
  changedFields: readonly PolicyChangeKey[];
  patch: PolicyChangePatch;
  latestVersion: number | null;
};

function meetingAdminIdentityScope(
  isAuthenticated: boolean,
  user: { identityPlane?: unknown; tenantId?: unknown; userId?: unknown } | null | undefined
) {
  return JSON.stringify([
    isAuthenticated,
    user?.identityPlane ?? null,
    user?.tenantId ?? null,
    user?.userId ?? null,
  ]);
}

function meetingAdminQueryMeta() {
  return { accessSensitive: true } as const;
}

function changedPolicyFields(
  draft: VideoMeetingAdminPolicy | null,
  persisted: VideoMeetingAdminPolicy | undefined
): PolicyChangeKey[] {
  if (!draft || !persisted) return [];
  return (Object.keys(POLICY_CHANGE_LABELS) as PolicyChangeKey[]).filter(
    (key) => draft[key] !== persisted[key]
  );
}

function policyPatch(
  draft: VideoMeetingAdminPolicy,
  changedFields: readonly PolicyChangeKey[]
): PolicyChangePatch {
  return Object.fromEntries(changedFields.map((key) => [key, draft[key]])) as PolicyChangePatch;
}

export function MeetingAdminOperations() {
  const { t, i18n } = useTranslation('meetings');
  const { user, isAuthenticated } = useAuth();
  const identityScope = meetingAdminIdentityScope(isAuthenticated, user);
  const [selectedExceptionKey, setSelectedExceptionKey] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['meetings', 'admin', 'overview', identityScope],
    queryFn: getVideoMeetingAdminOverview,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: 1,
    gcTime: 0,
    meta: meetingAdminQueryMeta(),
  });
  const readinessQuery = useQuery({
    queryKey: ['meetings', 'admin', 'intelligence', 'readiness', identityScope],
    queryFn: getVideoMeetingAdminIntelligenceReadiness,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: 1,
    gcTime: 0,
    meta: meetingAdminQueryMeta(),
  });
  const readiness = readinessQuery.data
    ? projectMeetingAdminIntelligenceReadiness(readinessQuery.data)
    : createUnavailableMeetingAdminIntelligenceReadiness();
  const serviceSignals: ReadonlyArray<{
    key: 'media' | 'recording' | 'transcript' | 'aiNotes';
    signal: MeetingAdminReadinessSignal;
  }> = [
    {
      key: 'media',
      signal:
        query.data?.capabilities.video && query.data.capabilities.screenShare
          ? { state: 'READY' }
          : { state: 'BLOCKED', reason: 'MEDIA_CAPABILITY_UNAVAILABLE' },
    },
    { key: 'recording', signal: readiness.capabilities.recording },
    { key: 'transcript', signal: readiness.capabilities.transcript },
    { key: 'aiNotes', signal: readiness.capabilities.aiNotes },
  ];
  const exceptions = serviceSignals.filter(({ signal }) => signal.state !== 'READY');
  const operationalExceptions = [
    ...(query.data?.failedJoinAttempts
      ? [
          {
            key: 'failed-joins',
            label: t('admin.operations.failedJoinException'),
            reason: t('admin.operations.failedJoinExceptionDetail', {
              count: query.data.failedJoinAttempts,
            }),
          },
        ]
      : []),
    ...exceptions.map(({ key, signal }) => ({
      key,
      label: t(`admin.operations.services.${key}`),
      reason: t(`admin.intelligence.reasons.${signal.reason}`, {
        defaultValue: signal.reason ?? signal.state,
      }),
    })),
  ];
  const selectedException =
    operationalExceptions.find(({ key }) => key === selectedExceptionKey) ??
    operationalExceptions[0] ??
    null;
  const observedAt = readiness.observedAt
    ? formatMeetingDateTime(readiness.observedAt, i18n.language)
    : null;

  return (
    <PageCanvas mode="workspace" topInset="compact">
      <MeetingPageHeading
        eyebrow={t('admin.eyebrow')}
        title={t('admin.operations.title')}
        description={t('admin.operations.description')}
        actions={
          <ActionButton
            intent="quiet"
            onClick={() => Promise.all([query.refetch(), readinessQuery.refetch()])}
          >
            {t('actions.refresh')}
          </ActionButton>
        }
      />
      {query.isLoading ? (
        <LoadingState label={t('admin.operations.loading')} variant="skeleton" skeletonRows={5} />
      ) : query.isError || !query.data ? (
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('errors.loadDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      ) : (
        <Stack gap={3}>
          <Alert severity="info" icon={<ShieldCheck size={19} />}>
            {t('admin.operations.privacy')}
          </Alert>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.45fr) minmax(320px, 0.55fr)' },
              gridTemplateAreas: {
                xs: '"impact" "service" "support"',
                lg: '"impact service" "support service"',
              },
              columnGap: 3,
              rowGap: { xs: 2.5, lg: 1 },
              alignItems: 'start',
            }}
          >
            <Stack
              component="section"
              aria-labelledby="meeting-impact-title"
              gap={1.25}
              sx={{ gridArea: 'impact' }}
            >
              <MeetingSectionHeading
                id="meeting-impact-title"
                title={t('admin.operations.impactTitle')}
                description={t('admin.operations.impactDescription')}
              />
              <Box
                data-testid="meeting-admin-impact-primary"
                sx={(theme) => ({
                  ...meetingSurface(theme, { tone: 'primary' }),
                  display: 'grid',
                  gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, 1fr)' },
                  '& > *': { borderColor: 'divider' },
                  '& > :nth-of-type(2)': { borderLeft: 1 },
                  '& > :last-child': {
                    gridColumn: { xs: '1 / -1', sm: 'auto' },
                    borderTop: { xs: 1, sm: 0 },
                    borderLeft: { sm: 1 },
                    borderColor: 'divider',
                  },
                })}
              >
                <MeetingMetric
                  label={t('admin.operations.live')}
                  value={query.data.liveMeetings}
                  tone="#17805F"
                />
                <MeetingMetric
                  label={t('admin.operations.waiting')}
                  value={query.data.waitingParticipants}
                  detail={t('admin.operations.waitingDetail')}
                  tone="#B45309"
                />
                <MeetingMetric
                  label={t('admin.operations.failedJoins')}
                  value={query.data.failedJoinAttempts}
                  detail={t('admin.operations.failedJoinDetail')}
                  tone={query.data.failedJoinAttempts > 0 ? 'error.main' : '#17805F'}
                />
              </Box>
            </Stack>

            <Stack
              component="section"
              aria-labelledby="meeting-service-title"
              data-testid="meeting-admin-service-readiness"
              gap={1.25}
              sx={{ gridArea: 'service' }}
            >
              <MeetingSectionHeading
                id="meeting-service-title"
                title={t('admin.operations.serviceTitle')}
                description={
                  observedAt
                    ? t('admin.operations.observedAt', { value: observedAt })
                    : t('admin.operations.observedUnavailable')
                }
              />
              <Box role="list" sx={(theme) => meetingListSurface(theme)}>
                {serviceSignals.map(({ key, signal }, index) => (
                  <OperationSignalRow
                    key={key}
                    label={t(`admin.operations.services.${key}`)}
                    signal={signal}
                    first={index === 0}
                  />
                ))}
              </Box>
            </Stack>

            <Box
              data-testid="meeting-admin-impact-support"
              aria-label={t('admin.operations.impactTitle')}
              sx={(theme) => ({
                ...meetingListSurface(theme),
                gridArea: 'support',
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(3, 1fr)' },
                '& > *': { borderColor: 'divider' },
                '& > :nth-of-type(2)': { borderLeft: 1 },
                '& > :last-child': {
                  gridColumn: { xs: '1 / -1', sm: 'auto' },
                  borderTop: { xs: 1, sm: 0 },
                  borderLeft: { sm: 1 },
                  borderColor: 'divider',
                },
              })}
            >
              <MeetingMetric
                label={t('admin.operations.scheduled')}
                value={query.data.scheduledToday}
                tone="#2563EB"
              />
              <MeetingMetric
                label={t('admin.operations.lastSevenDays')}
                value={query.data.meetingsLastSevenDays}
                tone="#7C3AED"
              />
              <MeetingMetric
                label={t('admin.operations.quality')}
                value={formatMeetingAdminQualityScore(query.data.averageQualityScore)}
                detail={
                  query.data.averageQualityScore == null
                    ? t('admin.operations.qualityUnavailable')
                    : undefined
                }
                tone="#8A5A14"
              />
            </Box>
          </Box>

          <Box component="section" aria-labelledby="meeting-exceptions-title">
            <MeetingSectionHeading
              id="meeting-exceptions-title"
              title={t('admin.operations.exceptionsTitle')}
              description={t('admin.operations.exceptionsDescription')}
            />
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 7fr) minmax(300px, 5fr)' },
                gap: 2,
                alignItems: 'stretch',
              }}
            >
              <Box
                component="ul"
                sx={(theme) => ({
                  ...meetingListSurface(theme),
                  m: 0,
                  p: 0,
                  listStyle: 'none',
                  '& > li + li': { borderTop: 1, borderColor: 'divider' },
                })}
              >
                {operationalExceptions.length === 0 ? (
                  <Stack
                    component="li"
                    direction="row"
                    alignItems="center"
                    gap={1.25}
                    sx={{ px: 2, py: 2 }}
                  >
                    <CircleCheck size={18} color="#17805F" aria-hidden="true" />
                    <Typography variant="body2">{t('admin.operations.exceptionsEmpty')}</Typography>
                  </Stack>
                ) : (
                  operationalExceptions.map((exception) => (
                    <Box component="li" key={exception.key}>
                      <OperationExceptionRow
                        label={exception.label}
                        reason={exception.reason}
                        selected={selectedException?.key === exception.key}
                        onSelect={() => setSelectedExceptionKey(exception.key)}
                      />
                    </Box>
                  ))
                )}
              </Box>
              <Box
                component="aside"
                aria-labelledby="meeting-exception-inspector-title"
                sx={(theme) => ({
                  ...meetingSurface(theme),
                  p: 2.5,
                  minHeight: 168,
                })}
              >
                <Typography
                  id="meeting-exception-inspector-title"
                  component="h3"
                  variant="subtitle1"
                  fontWeight="fontWeightBold"
                >
                  {t('admin.operations.inspectorTitle')}
                </Typography>
                {selectedException ? (
                  <Stack gap={1} sx={{ mt: 1.5 }}>
                    <Typography variant="body2" fontWeight="fontWeightMedium">
                      {selectedException.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedException.reason}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t('admin.operations.inspectorBoundary')}
                    </Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                    {t('admin.operations.inspectorEmpty')}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Stack>
      )}
    </PageCanvas>
  );
}

function OperationSignalRow({
  label,
  signal,
  first,
}: {
  label: string;
  signal: MeetingAdminReadinessSignal;
  first: boolean;
}) {
  const { t } = useTranslation('meetings');
  const Icon =
    signal.state === 'READY' ? CircleCheck : signal.state === 'BLOCKED' ? CircleAlert : CircleHelp;
  const color =
    signal.state === 'READY'
      ? 'success.main'
      : signal.state === 'BLOCKED'
        ? 'error.main'
        : 'warning.main';
  return (
    <Stack
      role="listitem"
      direction="row"
      alignItems="center"
      gap={1.25}
      sx={{ px: 2, py: 1.5, borderTop: first ? 0 : 1, borderColor: 'divider' }}
    >
      <Icon size={18} aria-hidden="true" />
      <Typography variant="body2" sx={{ flex: 1 }}>
        {label}
      </Typography>
      <Typography variant="caption" fontWeight="fontWeightMedium" color={color}>
        {t(`admin.operations.states.${signal.state}`)}
      </Typography>
    </Stack>
  );
}

function OperationExceptionRow({
  label,
  reason,
  selected,
  onSelect,
}: {
  label: string;
  reason: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      sx={{
        width: '100%',
        p: 0,
        border: 0,
        borderColor: 'divider',
        bgcolor: selected ? 'action.selected' : 'transparent',
        color: 'text.primary',
        textAlign: 'left',
        font: 'inherit',
        cursor: 'pointer',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: 'primary.main',
          outlineOffset: -3,
        },
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        gap={{ xs: 0.5, sm: 2 }}
        sx={{ px: 2, py: 1.5 }}
      >
        <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: { sm: 240 } }}>
          <CircleAlert size={18} color="#B42318" aria-hidden="true" />
          <Typography variant="body2" fontWeight="fontWeightMedium">
            {label}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
          {reason}
        </Typography>
      </Stack>
    </Box>
  );
}

export function MeetingAdminPolicies() {
  const { user, isAuthenticated } = useAuth();
  const identityScope = meetingAdminIdentityScope(isAuthenticated, user);
  const activeIdentityScope = useRef(identityScope);
  activeIdentityScope.current = identityScope;
  return (
    <MeetingAdminPoliciesWorkspace
      key={identityScope}
      identityScope={identityScope}
      isCurrentScope={() => activeIdentityScope.current === identityScope}
    />
  );
}

function MeetingAdminPoliciesWorkspace({
  identityScope,
  isCurrentScope,
}: {
  identityScope: string;
  isCurrentScope: () => boolean;
}) {
  const { t } = useTranslation('meetings');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.MEETINGS', 'MANAGE');
  const query = useQuery({
    queryKey: ['meetings', 'admin', 'policy', identityScope],
    queryFn: getVideoMeetingAdminPolicy,
    staleTime: 30_000,
    retry: 1,
    gcTime: 0,
    meta: meetingAdminQueryMeta(),
  });
  const [form, setForm] = useState<VideoMeetingAdminPolicy | null>(null);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [conflict, setConflict] = useState<PolicyConflict | null>(null);
  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);
  const validation = form ? validateMeetingAdminPolicy(form) : null;
  const chatRetentionError =
    validation?.chatRetention === 'RANGE'
      ? t('admin.policy.chatRetentionRangeError')
      : validation?.chatRetention === 'EXCEEDS_MEETING_RETENTION'
        ? t('admin.policy.chatRetentionMeetingError')
        : undefined;
  const artifactRetentionError = validation?.artifactRetention
    ? t('admin.policy.artifactRetentionMeetingError')
    : undefined;
  const persistedPolicy = query.data;
  const changedFields = changedPolicyFields(form, persistedPolicy);
  const groupChanged = (...keys: PolicyChangeKey[]) =>
    keys.some((key) => changedFields.includes(key));
  const refreshLatestPolicy = async () => {
    const result = await query.refetch();
    if (!isCurrentScope() || !result.isSuccess || !result.data) return;
    setForm(result.data);
    setConflict((current) =>
      current ? { ...current, latestVersion: result.data.version } : current
    );
  };
  const mutation = useMutation({
    mutationFn: ({ policy }: { policy: VideoMeetingAdminPolicy; conflict: PolicyConflict }) =>
      updateVideoMeetingAdminPolicy(policy),
    onSuccess: async (policy) => {
      if (!isCurrentScope()) return;
      setConfirmationOpen(false);
      setConflict(null);
      setForm(policy);
      queryClient.setQueryData(['meetings', 'admin', 'policy', identityScope], policy);
      await queryClient.invalidateQueries({
        queryKey: ['meetings', 'admin', 'overview', identityScope],
      });
      toast.success(t('admin.policy.saved'));
    },
    onError: (error, submission) => {
      if (!isCurrentScope()) return;
      if (error instanceof HttpError && error.status === 409) {
        setConfirmationOpen(false);
        setConflict(submission.conflict);
        void refreshLatestPolicy();
        return;
      }
      toast.error(t('admin.policy.saveError'));
    },
  });
  const editorDisabled = !canManage || Boolean(conflict);

  return (
    <PageCanvas mode="workspace" topInset="compact">
      <MeetingPageHeading
        eyebrow={t('admin.eyebrow')}
        title={t('admin.policy.title')}
        description={t('admin.policy.description')}
        actions={
          <ActionButton
            intent="primary"
            loading={mutation.isPending}
            loadingLabel={t('actions.saving')}
            disabled={
              editorDisabled ||
              !form ||
              changedFields.length === 0 ||
              Boolean(validation && hasMeetingAdminPolicyErrors(validation))
            }
            onClick={() => setConfirmationOpen(true)}
          >
            {t('actions.save')}
          </ActionButton>
        }
      />

      {conflict && (
        <Box data-testid="meeting-admin-policy-conflict" sx={{ mb: 2 }}>
          <InlineFeedback severity="warning" title={t('admin.policy.conflictTitle')}>
            <Stack gap={1.25}>
              <Typography variant="body2">
                {conflict.latestVersion === null
                  ? t('admin.policy.conflictRefreshing', {
                      version: conflict.baseVersion,
                      count: conflict.changedFields.length,
                    })
                  : t('admin.policy.conflictDescription', {
                      version: conflict.baseVersion,
                      latestVersion: conflict.latestVersion,
                      count: conflict.changedFields.length,
                    })}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                <ActionButton
                  intent="primary"
                  size="small"
                  disabled={!persistedPolicy || conflict.latestVersion === null}
                  onClick={() => {
                    if (!persistedPolicy || conflict.latestVersion === null) return;
                    setForm({
                      ...persistedPolicy,
                      ...conflict.patch,
                      version: persistedPolicy.version,
                    });
                    setConflict(null);
                  }}
                >
                  {t('admin.policy.conflictReapply')}
                </ActionButton>
                <ActionButton
                  intent="quiet"
                  size="small"
                  onClick={() => {
                    if (persistedPolicy) setForm(persistedPolicy);
                    setConflict(null);
                  }}
                >
                  {t('admin.policy.conflictDiscard')}
                </ActionButton>
              </Stack>
            </Stack>
          </InlineFeedback>
        </Box>
      )}

      {query.isError ? (
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('errors.loadDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => (conflict ? refreshLatestPolicy() : query.refetch())}
        />
      ) : query.isLoading || !form ? (
        <LoadingState label={t('admin.policy.loading')} variant="skeleton" skeletonRows={6} />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 8fr) minmax(300px, 4fr)' },
            gridTemplateAreas: {
              xs: '"impact" "editor" "boundaries"',
              lg: '"editor impact" "editor boundaries"',
            },
            gap: 3,
            alignItems: 'start',
          }}
        >
          <Stack gap={3} sx={{ gridArea: 'editor' }}>
            <MeetingAdminPolicySection
              title={t('admin.policy.accessTitle')}
              forceOpen={groupChanged(
                'meetingsEnabled',
                'waitingRoomRequired',
                'requireAuthenticatedInternalUsers'
              )}
            >
              <PolicySwitch
                label={t('admin.policy.meetingsEnabled')}
                hint={t('admin.policy.meetingsEnabledHint')}
                checked={form.meetingsEnabled}
                disabled={editorDisabled}
                onChange={(checked) => setForm({ ...form, meetingsEnabled: checked })}
              />
              <PolicySwitch
                label={t('admin.policy.waitingRoom')}
                hint={t('admin.policy.waitingRoomHint')}
                checked={form.waitingRoomRequired}
                disabled={editorDisabled}
                onChange={(checked) => setForm({ ...form, waitingRoomRequired: checked })}
              />
              <PolicySwitch
                label={t('admin.policy.authenticatedInternal')}
                hint={t('admin.policy.authenticatedInternalHint')}
                checked={form.requireAuthenticatedInternalUsers}
                disabled={editorDisabled}
                onChange={(checked) =>
                  setForm({ ...form, requireAuthenticatedInternalUsers: checked })
                }
              />
            </MeetingAdminPolicySection>

            <MeetingAdminPolicySection
              title={t('admin.policy.contentTitle')}
              forceOpen={groupChanged(
                'participantChatAllowed',
                'reactionsAllowed',
                'screenShareAllowed'
              )}
            >
              <PolicySwitch
                label={t('admin.policy.chat')}
                hint={t('admin.policy.chatHint')}
                checked={form.participantChatAllowed}
                disabled={editorDisabled}
                onChange={(checked) => setForm({ ...form, participantChatAllowed: checked })}
              />
              <PolicySwitch
                label={t('admin.policy.reactions')}
                hint={t('admin.policy.reactionsHint')}
                checked={form.reactionsAllowed}
                disabled={editorDisabled}
                onChange={(checked) => setForm({ ...form, reactionsAllowed: checked })}
              />
              <PolicySwitch
                label={t('admin.policy.screenShare')}
                hint={t('admin.policy.screenShareHint')}
                checked={form.screenShareAllowed}
                disabled={editorDisabled}
                onChange={(checked) => setForm({ ...form, screenShareAllowed: checked })}
              />
            </MeetingAdminPolicySection>

            <MeetingAdminPolicySection
              title={t('admin.policy.captureTitle')}
              forceOpen={groupChanged('recordingPolicy')}
            >
              <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
                <SelectField<VideoMeetingAdminPolicy['recordingPolicy']>
                  label={t('admin.policy.recording')}
                  value={form.recordingPolicy}
                  options={MEETING_RECORDING_POLICIES.map((policy) => ({
                    value: policy,
                    label: t(`admin.intelligence.recordingPolicies.${policy}`),
                  }))}
                  supportingText={
                    form.recordingPolicy === 'ADMIN_REQUIRED'
                      ? t('admin.policy.recordingAdminRequiredHint')
                      : form.recordingConfigured
                        ? t('admin.policy.recordingHostOptInHint')
                        : t('admin.policy.recordingUnavailable')
                  }
                  slotProps={{
                    formHelperText: {
                      sx: { '&.Mui-disabled': { color: 'text.secondary', opacity: 1 } },
                    },
                  }}
                  disabled={editorDisabled || !form.recordingConfigured}
                  onValueChange={(recordingPolicy) => {
                    if (recordingPolicy) setForm({ ...form, recordingPolicy });
                  }}
                />
              </Box>
              <PolicySwitch
                label={t('admin.policy.aiNotes')}
                hint={t('admin.policy.aiNotesUnavailable')}
                checked={false}
                disabled
                onChange={() => undefined}
              />
            </MeetingAdminPolicySection>

            {form.recordingPolicy !== 'NEVER' && (
              <Alert severity="warning" icon={<ShieldCheck size={19} />}>
                {t(
                  form.recordingPolicy === 'ADMIN_REQUIRED'
                    ? 'admin.policy.recordingAdminRequiredWarning'
                    : 'admin.policy.recordingHostOptInWarning'
                )}
              </Alert>
            )}

            <MeetingAdminPolicySection
              title={t('admin.policy.retentionTitle')}
              forceOpen={
                groupChanged('retentionDays', 'chatRetentionDays', 'artifactRetentionDays') ||
                Boolean(chatRetentionError || artifactRetentionError)
              }
            >
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                  gap: 2,
                  p: 2,
                }}
              >
                <FormField
                  type="number"
                  label={t('admin.policy.retention')}
                  value={form.retentionDays}
                  disabled={editorDisabled}
                  slotProps={{ htmlInput: { min: 30, max: 3650 } }}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      retentionDays: Math.max(30, Math.min(3650, Number(event.target.value))),
                    })
                  }
                />
                <FormField
                  type="number"
                  label={t('admin.policy.chatRetention')}
                  value={form.chatRetentionDays}
                  disabled={editorDisabled}
                  supportingText={t('admin.policy.chatRetentionHint', {
                    meetingRetentionDays: form.retentionDays,
                  })}
                  errorMessage={chatRetentionError}
                  slotProps={{ htmlInput: { min: 0, max: 365, step: 1 } }}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      chatRetentionDays: Number(event.target.value),
                    })
                  }
                />
                <FormField
                  type="number"
                  label={t('admin.policy.artifactRetention')}
                  value={form.artifactRetentionDays}
                  disabled={editorDisabled}
                  errorMessage={artifactRetentionError}
                  slotProps={{ htmlInput: { min: 1, max: 3650 } }}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      artifactRetentionDays: Math.max(
                        1,
                        Math.min(3650, Number(event.target.value))
                      ),
                    })
                  }
                />
              </Box>
            </MeetingAdminPolicySection>

            <MeetingAdminPolicySection
              title={t('admin.policy.capacityTitle')}
              forceOpen={groupChanged('maximumParticipants')}
            >
              <Box sx={{ p: 2 }}>
                <FormField
                  type="number"
                  label={t('admin.policy.maximumParticipants')}
                  value={form.maximumParticipants}
                  disabled={editorDisabled}
                  slotProps={{ htmlInput: { min: 2, max: 1000 } }}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      maximumParticipants: Math.max(2, Math.min(1000, Number(event.target.value))),
                    })
                  }
                />
              </Box>
            </MeetingAdminPolicySection>
          </Stack>

          <MeetingAdminPolicyImpact
            version={persistedPolicy?.version ?? form.version}
            changedCount={changedFields.length}
          />
          <MeetingAdminPolicyBoundaries canManage={canManage} />
        </Box>
      )}
      <ConfirmDialog
        open={confirmationOpen}
        title={t('admin.policy.confirmTitle')}
        description={t('admin.policy.confirmDescription', {
          version: query.data?.version ?? form?.version ?? 0,
          count: changedFields.length,
        })}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('actions.save')}
        confirmingLabel={t('actions.saving')}
        busy={mutation.isPending}
        details={
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {changedFields.map((key) => (
              <Typography key={key} component="li" variant="body2">
                {t(POLICY_CHANGE_LABELS[key])}
              </Typography>
            ))}
          </Box>
        }
        onClose={() => setConfirmationOpen(false)}
        onConfirm={() => {
          if (!form || !persistedPolicy || changedFields.length === 0) return;
          mutation.mutate({
            policy: form,
            conflict: {
              baseVersion: form.version,
              changedFields,
              patch: policyPatch(form, changedFields),
              latestVersion: null,
            },
          });
        }}
      />
    </PageCanvas>
  );
}

function PolicySwitch({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  const labelId = useId();
  const hintId = useId();
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      gap={2}
      sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography id={labelId} variant="body2" fontWeight={700}>
          {label}
        </Typography>
        <Typography id={hintId} variant="caption" color="text.secondary">
          {hint}
        </Typography>
      </Box>
      <Switch
        checked={checked}
        disabled={disabled}
        slotProps={{ input: { 'aria-labelledby': labelId, 'aria-describedby': hintId } }}
        onChange={(_, value) => onChange(value)}
      />
    </Stack>
  );
}
