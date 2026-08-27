import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Bot,
  Captions,
  CheckCircle2,
  MessageSquareText,
  MonitorUp,
  Radio,
  ShieldCheck,
  Video,
  XCircle,
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
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

import { MeetingMetric, MeetingPageHeading, MeetingSectionHeading } from './meeting-components';

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
    <PageCanvas>
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
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(6, minmax(0, 1fr))',
              },
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              overflow: 'hidden',
              '& > *:not(:last-child)': { borderRight: 1, borderColor: 'divider' },
            }}
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
              value="—"
              detail={t('admin.operations.qualityUnavailable')}
              tone="#8A5A14"
            />
          </Box>

          <Box component="section" aria-labelledby="meeting-capabilities-title">
            <MeetingSectionHeading
              id="meeting-capabilities-title"
              title={t('admin.operations.capabilities')}
            />
            <Box
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                overflow: 'hidden',
              }}
            >
              {[
                { key: 'video', icon: Video, available: query.data.capabilities.video },
                {
                  key: 'screenShare',
                  icon: MonitorUp,
                  available: query.data.capabilities.screenShare,
                },
                { key: 'chat', icon: MessageSquareText, available: query.data.capabilities.chat },
                { key: 'captions', icon: Captions, available: query.data.capabilities.captions },
                {
                  key: 'recording',
                  icon: Radio,
                  available: query.data.capabilities.recordingConfigured,
                },
                { key: 'aiNotes', icon: Bot, available: query.data.capabilities.aiNotesConfigured },
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <Box key={item.key}>
                    {index > 0 && <Divider />}
                    <Stack direction="row" alignItems="center" gap={1.25} sx={{ px: 2, py: 1.5 }}>
                      <Icon size={18} aria-hidden="true" />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {t(`admin.capabilities.${item.key}`)}
                      </Typography>
                      {item.available ? (
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
  const chatRetentionError = form
    ? !Number.isInteger(form.chatRetentionDays) ||
      form.chatRetentionDays < 0 ||
      form.chatRetentionDays > 365
      ? t('admin.policy.chatRetentionRangeError')
      : form.chatRetentionDays > form.retentionDays
        ? t('admin.policy.chatRetentionMeetingError')
        : undefined
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
            disabled={!canManage || !form || Boolean(chatRetentionError)}
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
              hint={t('admin.policy.recordingUnavailable')}
              checked={false}
              disabled
              onChange={() => undefined}
            />
            <PolicySwitch
              label={t('admin.policy.aiNotes')}
              hint={t('admin.policy.aiNotesUnavailable')}
              checked={false}
              disabled
              onChange={() => undefined}
            />
          </PolicySection>

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
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      <Typography
        component="h2"
        variant="subtitle1"
        fontWeight={800}
        sx={{ px: 2, py: 1.5, bgcolor: 'action.hover' }}
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
  return (
    <Stack
      direction="row"
      justifyContent="space-between"
      alignItems="center"
      gap={2}
      sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
    >
      <Box>
        <Typography variant="body2" fontWeight={700}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      </Box>
      <FormControlLabel
        control={
          <Switch
            checked={checked}
            disabled={disabled}
            slotProps={{ input: { 'aria-label': label } }}
            onChange={(_, value) => onChange(value)}
          />
        }
        label=""
        sx={{ m: 0 }}
      />
    </Stack>
  );
}
