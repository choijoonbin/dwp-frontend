import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Captions,
  CheckCircle2,
  FileText,
  MessageSquareText,
  MonitorUp,
  Radio,
  ShieldCheck,
  Video,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ErrorState,
  FormField,
  LoadingState,
  PageCanvas,
} from '@dwp-frontend/design-system';
import { usePermissions, useToast } from '@dwp-frontend/shared-utils';
import {
  getVideoMeetingAdminOverview,
  getVideoMeetingAdminPolicy,
  updateVideoMeetingAdminPolicy,
  type VideoMeetingAdminPolicy,
} from '@dwp-frontend/shared-utils/api/video-meeting-api';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { MeetingMetric, MeetingPageHeading, MeetingSectionHeading } from './meeting-components';
import {
  MEETING_ADMIN_OPERATION_CAPABILITIES,
  formatMeetingAdminQualityScore,
  hasMeetingAdminPolicyErrors,
  isMeetingAdminCapabilityAvailable,
  validateMeetingAdminPolicy,
  type MeetingAdminOperationCapabilityKey,
} from './meeting-admin-model';
import { meetingListSurface, meetingSurface } from './meeting-visual-system';

const CAPABILITY_ICONS: Record<MeetingAdminOperationCapabilityKey, LucideIcon> = {
  video: Video,
  screenShare: MonitorUp,
  chat: MessageSquareText,
  captions: Captions,
  recording: Radio,
  transcript: FileText,
  aiNotes: Bot,
};

export function MeetingAdminOperations() {
  const { t } = useTranslation('meetings');
  const query = useQuery({
    queryKey: ['meetings', 'admin', 'overview'],
    queryFn: getVideoMeetingAdminOverview,
    staleTime: 20_000,
    refetchInterval: 30_000,
    retry: 1,
  });

  return (
    <PageCanvas mode="focus">
      <MeetingPageHeading
        eyebrow={t('admin.eyebrow')}
        title={t('admin.operations.title')}
        description={t('admin.operations.description')}
        actions={
          <ActionButton intent="quiet" onClick={() => query.refetch()}>
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
          <Box
            component="section"
            aria-label={t('admin.operations.title')}
            sx={(theme) => ({
              ...meetingSurface(theme, { tone: 'primary' }),
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(6, minmax(0, 1fr))',
              },
              gap: 1,
              p: 1,
            })}
          >
            <MeetingMetric
              label={t('admin.operations.live')}
              value={query.data.liveMeetings}
              tone="#17805F"
            />
            <MeetingMetric
              label={t('admin.operations.scheduled')}
              value={query.data.scheduledToday}
              tone="#2563EB"
            />
            <MeetingMetric
              label={t('admin.operations.waiting')}
              value={query.data.waitingParticipants}
              tone="#B45309"
            />
            <MeetingMetric
              label={t('admin.operations.lastSevenDays')}
              value={query.data.meetingsLastSevenDays}
              tone="#7C3AED"
            />
            <MeetingMetric
              label={t('admin.operations.failedJoins')}
              value={query.data.failedJoinAttempts}
              tone="#0F766E"
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

          <Box component="section" aria-labelledby="meeting-capabilities-title">
            <MeetingSectionHeading
              id="meeting-capabilities-title"
              title={t('admin.operations.capabilities')}
            />
            <Box sx={(theme) => meetingListSurface(theme)}>
              {MEETING_ADMIN_OPERATION_CAPABILITIES.map((key) => {
                const Icon = CAPABILITY_ICONS[key];
                const available = isMeetingAdminCapabilityAvailable(query.data.capabilities, key);
                return (
                  <Box key={key}>
                    <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2, py: 1.5 }}>
                      <Icon size={18} aria-hidden="true" />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {t(`admin.capabilities.${key}`)}
                      </Typography>
                      {available ? (
                        <CheckCircle2
                          size={18}
                          color="#17805F"
                          aria-label={t('admin.operations.capabilityReady')}
                        />
                      ) : (
                        <XCircle
                          size={18}
                          color="#8A94A3"
                          aria-label={t('admin.operations.capabilityUnavailable')}
                        />
                      )}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </Box>

          <Alert severity="info" icon={<ShieldCheck size={19} />}>
            {t('admin.operations.privacy')}
          </Alert>
        </Stack>
      )}
    </PageCanvas>
  );
}

export function MeetingAdminPolicies() {
  const { t } = useTranslation('meetings');
  const toast = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('ADMIN.MEETINGS', 'MANAGE');
  const query = useQuery({
    queryKey: ['meetings', 'admin', 'policy'],
    queryFn: getVideoMeetingAdminPolicy,
    staleTime: 30_000,
    retry: 1,
  });
  const [form, setForm] = useState<VideoMeetingAdminPolicy | null>(null);
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
  const mutation = useMutation({
    mutationFn: (policy: VideoMeetingAdminPolicy) => updateVideoMeetingAdminPolicy(policy),
    onSuccess: async (policy) => {
      setForm(policy);
      queryClient.setQueryData(['meetings', 'admin', 'policy'], policy);
      await queryClient.invalidateQueries({ queryKey: ['meetings', 'admin', 'overview'] });
      toast.success(t('admin.policy.saved'));
    },
    onError: () => toast.error(t('admin.policy.saveError')),
  });

  return (
    <PageCanvas mode="focus">
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
              !canManage || !form || Boolean(validation && hasMeetingAdminPolicyErrors(validation))
            }
            onClick={() => form && mutation.mutate(form)}
          >
            {t('actions.save')}
          </ActionButton>
        }
      />

      {query.isError ? (
        <ErrorState
          title={t('errors.loadTitle')}
          description={t('errors.loadDescription')}
          retryLabel={t('actions.retry')}
          onRetry={() => query.refetch()}
        />
      ) : query.isLoading || !form ? (
        <LoadingState label={t('admin.policy.loading')} variant="skeleton" skeletonRows={6} />
      ) : (
        <Stack gap={3}>
          <PolicySection title={t('admin.policy.accessTitle')}>
            <PolicySwitch
              label={t('admin.policy.meetingsEnabled')}
              hint={t('admin.policy.meetingsEnabledHint')}
              checked={form.meetingsEnabled}
              disabled={!canManage}
              onChange={(checked) => setForm({ ...form, meetingsEnabled: checked })}
            />
            <PolicySwitch
              label={t('admin.policy.waitingRoom')}
              hint={t('admin.policy.waitingRoomHint')}
              checked={form.waitingRoomRequired}
              disabled={!canManage}
              onChange={(checked) => setForm({ ...form, waitingRoomRequired: checked })}
            />
            <PolicySwitch
              label={t('admin.policy.authenticatedInternal')}
              hint={t('admin.policy.authenticatedInternalHint')}
              checked={form.requireAuthenticatedInternalUsers}
              disabled={!canManage}
              onChange={(checked) =>
                setForm({ ...form, requireAuthenticatedInternalUsers: checked })
              }
            />
          </PolicySection>

          <PolicySection title={t('admin.policy.contentTitle')}>
            <PolicySwitch
              label={t('admin.policy.chat')}
              hint={t('admin.policy.chatHint')}
              checked={form.participantChatAllowed}
              disabled={!canManage}
              onChange={(checked) => setForm({ ...form, participantChatAllowed: checked })}
            />
            <PolicySwitch
              label={t('admin.policy.reactions')}
              hint={t('admin.policy.reactionsHint')}
              checked={form.reactionsAllowed}
              disabled={!canManage}
              onChange={(checked) => setForm({ ...form, reactionsAllowed: checked })}
            />
            <PolicySwitch
              label={t('admin.policy.screenShare')}
              hint={t('admin.policy.screenShareHint')}
              checked={form.screenShareAllowed}
              disabled={!canManage}
              onChange={(checked) => setForm({ ...form, screenShareAllowed: checked })}
            />
            <PolicySwitch
              label={t('admin.policy.recording')}
              hint={
                form.recordingPolicy === 'ADMIN_REQUIRED'
                  ? t('admin.policy.recordingAdminRequiredHint')
                  : form.recordingConfigured
                    ? t('admin.policy.recordingHostOptInHint')
                    : t('admin.policy.recordingUnavailable')
              }
              checked={form.recordingPolicy !== 'NEVER'}
              disabled={!canManage || !form.recordingConfigured}
              onChange={(checked) =>
                setForm({ ...form, recordingPolicy: checked ? 'HOST_OPT_IN' : 'NEVER' })
              }
            />
            <PolicySwitch
              label={t('admin.policy.aiNotes')}
              hint={t('admin.policy.aiNotesUnavailable')}
              checked={false}
              disabled
              onChange={() => undefined}
            />
          </PolicySection>

          {form.recordingPolicy !== 'NEVER' && (
            <Alert severity="warning" icon={<ShieldCheck size={19} />}>
              {t(
                form.recordingPolicy === 'ADMIN_REQUIRED'
                  ? 'admin.policy.recordingAdminRequiredWarning'
                  : 'admin.policy.recordingHostOptInWarning'
              )}
            </Alert>
          )}

          <PolicySection title={t('admin.policy.retentionTitle')}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
                gap: 2,
                p: 2,
              }}
            >
              <FormField
                type="number"
                label={t('admin.policy.retention')}
                value={form.retentionDays}
                disabled={!canManage}
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
                disabled={!canManage}
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
                disabled={!canManage}
                errorMessage={artifactRetentionError}
                slotProps={{ htmlInput: { min: 1, max: 3650 } }}
                onChange={(event) =>
                  setForm({
                    ...form,
                    artifactRetentionDays: Math.max(1, Math.min(3650, Number(event.target.value))),
                  })
                }
              />
              <FormField
                type="number"
                label={t('admin.policy.maximumParticipants')}
                value={form.maximumParticipants}
                disabled={!canManage}
                slotProps={{ htmlInput: { min: 2, max: 1000 } }}
                onChange={(event) =>
                  setForm({
                    ...form,
                    maximumParticipants: Math.max(2, Math.min(1000, Number(event.target.value))),
                  })
                }
              />
            </Box>
          </PolicySection>

          <Alert severity="info" icon={<ShieldCheck size={19} />}>
            {t('admin.policy.unmuteRequestOnly')}
          </Alert>
        </Stack>
      )}
    </PageCanvas>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box
      component="section"
      aria-label={title}
      sx={(theme) => ({
        ...meetingSurface(theme),
        overflow: 'hidden',
      })}
    >
      <Typography
        component="h2"
        variant="subtitle1"
        fontWeight={750}
        sx={{ px: { xs: 2, sm: 2.5 }, py: 1.75, bgcolor: 'action.hover' }}
      >
        {title}
      </Typography>
      <Divider />
      {children}
    </Box>
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
