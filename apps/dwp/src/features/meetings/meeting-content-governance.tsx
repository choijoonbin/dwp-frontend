import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, FileAudio, Radio, RefreshCw, ShieldCheck, Square, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, ActionIconButton, ConfirmDialog } from '@dwp-frontend/design-system';
import {
  acknowledgeVideoMeetingContentNotice,
  getVideoMeetingContentPlan,
  requestVideoMeetingRecording,
  stopVideoMeetingRecording,
  updateVideoMeetingContentPlan,
  type VideoMeetingContentPlan,
  type VideoMeetingRecordingState,
} from '@dwp-frontend/shared-utils/api/video-meeting-content-api';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';

const ACTIVE_RECORDING_STATES = new Set<VideoMeetingRecordingState>([
  'REQUESTED',
  'STARTING',
  'RECORDING',
  'STOP_REQUESTED',
]);

function contentPlanQuery(meetingId: string, pollInterval: number | false) {
  return {
    queryKey: ['meetings', meetingId, 'content-plan'] as const,
    queryFn: () => getVideoMeetingContentPlan(meetingId),
    staleTime: 2_000,
    refetchInterval: pollInterval,
    retry: 1,
  };
}

function processingRequested(plan: VideoMeetingContentPlan): boolean {
  return plan.recordingRequested || plan.transcriptionRequested || plan.aiSummaryRequested;
}

function requiresAcknowledgement(plan: VideoMeetingContentPlan): boolean {
  return Boolean(
    processingRequested(plan) &&
    plan.notice?.state === 'PUBLISHED' &&
    !plan.notice.acknowledgedByViewer
  );
}

function disclosureUnavailable(plan: VideoMeetingContentPlan): boolean {
  return processingRequested(plan) && plan.notice?.state !== 'PUBLISHED';
}

function recordingState(plan?: VideoMeetingContentPlan): VideoMeetingRecordingState | 'INACTIVE' {
  return plan?.recordingSession?.state ?? 'INACTIVE';
}

type ContentPlanDraft = Pick<
  VideoMeetingContentPlan,
  'recordingRequested' | 'transcriptionRequested' | 'aiSummaryRequested' | 'e2eeEnabled'
>;

function draftFromPlan(plan: VideoMeetingContentPlan): ContentPlanDraft {
  return {
    recordingRequested: plan.recordingRequested,
    transcriptionRequested: plan.transcriptionRequested,
    aiSummaryRequested: plan.aiSummaryRequested,
    e2eeEnabled: plan.e2eeEnabled,
  };
}

function draftMatchesPlan(draft: ContentPlanDraft, plan: VideoMeetingContentPlan): boolean {
  return (
    draft.recordingRequested === plan.recordingRequested &&
    draft.transcriptionRequested === plan.transcriptionRequested &&
    draft.aiSummaryRequested === plan.aiSummaryRequested &&
    draft.e2eeEnabled === plan.e2eeEnabled
  );
}

function ContentFeatureChips({
  plan,
  dark = false,
}: {
  plan: VideoMeetingContentPlan;
  dark?: boolean;
}) {
  const { t } = useTranslation('meetings');
  const features = [
    plan.recordingRequested ? t('room.content.features.recording') : null,
    plan.transcriptionRequested ? t('room.content.features.transcription') : null,
    plan.aiSummaryRequested ? t('room.content.features.aiSummary') : null,
  ].filter((feature): feature is string => Boolean(feature));

  if (!features.length) {
    return (
      <Chip
        size="small"
        variant="outlined"
        label={t('room.content.disabled')}
        sx={dark ? { color: '#f4f7fb', borderColor: 'rgba(255, 255, 255, 0.32)' } : undefined}
      />
    );
  }
  return (
    <Stack direction="row" gap={0.75} flexWrap="wrap">
      {features.map((feature) => (
        <Chip
          key={feature}
          size="small"
          variant="outlined"
          label={feature}
          sx={dark ? { color: '#f4f7fb', borderColor: 'rgba(255, 255, 255, 0.32)' } : undefined}
        />
      ))}
    </Stack>
  );
}

function ContentPlanBlockers({ plan }: { plan: VideoMeetingContentPlan }) {
  const { t } = useTranslation('meetings');
  if (!plan.blockers.length) return null;
  return (
    <Alert severity="warning" icon={<CircleAlert size={18} />}>
      <Typography fontWeight={800}>{t('room.content.blockedTitle')}</Typography>
      <Box component="ul" sx={{ m: '6px 0 0', pl: 2.25 }}>
        {plan.blockers.map((blocker) => (
          <Typography component="li" variant="body2" key={blocker.code}>
            {t(`room.content.blockers.${blocker.code}`, { defaultValue: blocker.description })}
          </Typography>
        ))}
      </Box>
    </Alert>
  );
}

function ContentPlanEditor({
  meetingId,
  plan,
  dark = false,
}: {
  meetingId: string;
  plan: VideoMeetingContentPlan;
  dark?: boolean;
}) {
  const { t } = useTranslation('meetings');
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ContentPlanDraft>(() => draftFromPlan(plan));
  const [sourceVersion, setSourceVersion] = useState(plan.version);
  const [saveError, setSaveError] = useState(false);
  const [savedVersion, setSavedVersion] = useState<number | null>(null);
  const state = recordingState(plan);
  const active = state !== 'INACTIVE' && ACTIVE_RECORDING_STATES.has(state);
  const processingSelected =
    draft.recordingRequested || draft.transcriptionRequested || draft.aiSummaryRequested;
  const dirty = !draftMatchesPlan(draft, plan);
  const textColor = dark ? '#f4f7fb' : 'text.primary';
  const mutedColor = dark ? 'rgba(244, 247, 251, 0.72)' : 'text.secondary';

  useEffect(() => {
    if (plan.version === sourceVersion) return;
    setDraft(draftFromPlan(plan));
    setSourceVersion(plan.version);
    setSaveError(false);
    setSavedVersion(null);
  }, [plan, sourceVersion]);

  const updateDraft = (update: (current: ContentPlanDraft) => ContentPlanDraft) => {
    setDraft(update);
    setSaveError(false);
    setSavedVersion(null);
  };

  const save = useMutation({
    mutationFn: () =>
      updateVideoMeetingContentPlan(meetingId, {
        ...draft,
        expectedVersion: plan.version,
        idempotencyKey: crypto.randomUUID(),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['meetings', meetingId, 'content-plan'], updated);
      setDraft(draftFromPlan(updated));
      setSourceVersion(updated.version);
      setSaveError(false);
      setSavedVersion(updated.version);
    },
    onError: () => {
      setSaveError(true);
      setSavedVersion(null);
      void queryClient.invalidateQueries({ queryKey: ['meetings', meetingId, 'content-plan'] });
    },
  });

  const options = [
    {
      key: 'recordingRequested' as const,
      label: t('room.content.plan.recordingLabel'),
      description: t('room.content.plan.recordingDescription'),
    },
    {
      key: 'transcriptionRequested' as const,
      label: t('room.content.plan.transcriptionLabel'),
      description: t('room.content.plan.transcriptionDescription'),
    },
    {
      key: 'aiSummaryRequested' as const,
      label: t('room.content.plan.aiSummaryLabel'),
      description: t('room.content.plan.aiSummaryDescription'),
    },
    {
      key: 'e2eeEnabled' as const,
      label: t('room.content.plan.e2eeLabel'),
      description: t('room.content.plan.e2eeDescription'),
    },
  ];

  return (
    <Box
      component="fieldset"
      sx={{ m: 0, p: 0, minWidth: 0, border: 0, color: textColor }}
      disabled={active || save.isPending}
    >
      <Typography component="legend" variant="subtitle2" fontWeight={850} sx={{ color: textColor }}>
        {t('room.content.plan.title')}
      </Typography>
      <Typography variant="body2" sx={{ mt: 0.35, mb: 1.25, color: mutedColor }}>
        {t('room.content.plan.description')}
      </Typography>
      <Stack
        divider={
          <Divider flexItem sx={dark ? { borderColor: 'rgba(255,255,255,.12)' } : undefined} />
        }
      >
        {options.map((option) => (
          <FormControlLabel
            key={option.key}
            labelPlacement="start"
            control={
              <Switch
                checked={draft[option.key]}
                slotProps={{ input: { 'aria-label': option.label } }}
                onChange={(_, checked) => {
                  updateDraft((current) => {
                    if (option.key === 'aiSummaryRequested' && checked) {
                      return { ...current, transcriptionRequested: true, aiSummaryRequested: true };
                    }
                    if (option.key === 'transcriptionRequested' && !checked) {
                      return {
                        ...current,
                        transcriptionRequested: false,
                        aiSummaryRequested: false,
                      };
                    }
                    return { ...current, [option.key]: checked };
                  });
                }}
              />
            }
            label={
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={750} sx={{ color: textColor }}>
                  {option.label}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', color: mutedColor }}>
                  {option.description}
                </Typography>
              </Box>
            }
            sx={{
              width: '100%',
              minWidth: 0,
              justifyContent: 'space-between',
              gap: 1.5,
              m: 0,
              py: 0.75,
            }}
          />
        ))}
      </Stack>
      {draft.e2eeEnabled && processingSelected && (
        <Alert severity="warning" sx={{ mt: 1.25 }}>
          {t('room.content.plan.e2eeConflict')}
        </Alert>
      )}
      {active && (
        <Alert severity="info" sx={{ mt: 1.25 }}>
          {t('room.content.plan.activeLocked')}
        </Alert>
      )}
      {saveError && (
        <Alert severity="error" sx={{ mt: 1.25 }}>
          {t('room.content.plan.saveError')}
        </Alert>
      )}
      {savedVersion === plan.version && (
        <Alert severity="success" role="status" sx={{ mt: 1.25 }}>
          {t('room.content.plan.saveSuccess')}
        </Alert>
      )}
      <ActionButton
        intent={dark ? 'primary' : 'secondary'}
        size="small"
        loading={save.isPending}
        loadingLabel={t('room.content.plan.saving')}
        disabled={!dirty || active}
        sx={{ mt: 1.25 }}
        onClick={() => save.mutate()}
      >
        {t('room.content.plan.save')}
      </ActionButton>
    </Box>
  );
}

function NoticeAcknowledgement({
  meetingId,
  plan,
  compact = false,
}: {
  meetingId: string;
  plan: VideoMeetingContentPlan;
  compact?: boolean;
}) {
  const { t } = useTranslation('meetings');
  const [error, setError] = useState(false);
  const queryClient = useQueryClient();
  const acknowledgement = useMutation({
    mutationFn: () => {
      if (!plan.notice) throw new Error('The current meeting content notice is unavailable.');
      return acknowledgeVideoMeetingContentNotice(
        meetingId,
        plan.notice.noticeId,
        crypto.randomUUID()
      );
    },
    onSuccess: async () => {
      setError(false);
      await queryClient.invalidateQueries({ queryKey: ['meetings', meetingId, 'content-plan'] });
    },
    onError: () => setError(true),
  });
  const acknowledged = plan.notice?.acknowledgedByViewer === true;

  if (!plan.notice || plan.notice.state !== 'PUBLISHED') return null;
  return (
    <Stack gap={1.25}>
      <Alert severity={acknowledged ? 'success' : 'warning'} icon={<ShieldCheck size={18} />}>
        <Typography fontWeight={800}>
          {t(
            acknowledged
              ? 'room.content.noticeAcknowledgedTitle'
              : 'room.content.noticeRequiredTitle'
          )}
        </Typography>
        <Typography variant="body2">
          {t('room.content.noticeDescription', { revision: plan.notice.revision })}
        </Typography>
      </Alert>
      {!acknowledged && (
        <ActionButton
          intent="primary"
          size={compact ? 'small' : 'medium'}
          loading={acknowledgement.isPending}
          loadingLabel={t('room.content.acknowledging')}
          onClick={() => acknowledgement.mutate()}
        >
          {t('room.content.acknowledge')}
        </ActionButton>
      )}
      {error && <Alert severity="error">{t('room.content.acknowledgeError')}</Alert>}
    </Stack>
  );
}

export function MeetingContentPreJoin({
  meetingId,
  canHost,
  onGuardChange,
}: {
  meetingId: string;
  canHost: boolean;
  onGuardChange: (guarded: boolean) => void;
}) {
  const { t } = useTranslation('meetings');
  const query = useQuery(contentPlanQuery(meetingId, 5_000));
  const plan = query.data;
  const guarded =
    query.isLoading ||
    query.isError ||
    (plan ? requiresAcknowledgement(plan) || disclosureUnavailable(plan) : true);

  useEffect(() => onGuardChange(guarded), [guarded, onGuardChange]);

  return (
    <Box
      sx={{
        mt: 2,
        pt: 2,
        borderTop: 1,
        borderColor: 'divider',
        '& .MuiAlert-message': {
          minWidth: 0,
          overflow: 'visible',
          overflowWrap: 'anywhere',
        },
      }}
    >
      <Stack direction="row" gap={1} alignItems="center" sx={{ mb: 1.25 }}>
        <FileAudio size={18} aria-hidden="true" />
        <Typography component="h3" variant="subtitle2" fontWeight={850}>
          {t('room.content.title')}
        </Typography>
      </Stack>
      {query.isLoading ? (
        <Alert severity="info">{t('room.content.loading')}</Alert>
      ) : query.isError || !plan ? (
        <Stack gap={1}>
          <Alert severity="error">{t('room.content.loadError')}</Alert>
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<RefreshCw size={15} />}
            onClick={() => query.refetch()}
          >
            {t('actions.retry')}
          </ActionButton>
        </Stack>
      ) : (
        <Stack gap={1.25}>
          <ContentFeatureChips plan={plan} dark />
          <Typography variant="body2" sx={{ color: 'rgba(244, 247, 251, 0.78)' }}>
            {t(`room.content.recordingStates.${recordingState(plan)}`)}
          </Typography>
          {disclosureUnavailable(plan) && (
            <Alert severity="error">{t('room.content.noticeUnavailable')}</Alert>
          )}
          <ContentPlanBlockers plan={plan} />
          <NoticeAcknowledgement meetingId={meetingId} plan={plan} compact />
          {canHost && (
            <>
              <Divider sx={{ borderColor: 'rgba(255,255,255,.12)' }} />
              <ContentPlanEditor meetingId={meetingId} plan={plan} dark />
            </>
          )}
        </Stack>
      )}
    </Box>
  );
}

export function MeetingContentControl({
  meetingId,
  canHost,
  meetingLive,
}: {
  meetingId: string;
  canHost: boolean;
  meetingLive: boolean;
}) {
  const { t } = useTranslation('meetings');
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<'START' | 'STOP' | null>(null);
  const [commandError, setCommandError] = useState(false);
  const query = useQuery(contentPlanQuery(meetingId, meetingLive ? 3_000 : false));
  const plan = query.data;
  const state = recordingState(plan);
  const statusLabel = plan
    ? t(`room.content.recordingStates.${state}`)
    : t(query.isLoading ? 'room.content.statusVerifying' : 'room.content.statusUnavailable');
  const active = state !== 'INACTIVE' && ACTIVE_RECORDING_STATES.has(state);
  const canStart = Boolean(
    canHost &&
    meetingLive &&
    !query.isError &&
    plan?.recordingRequested &&
    plan.state === 'READY' &&
    plan.blockers.length === 0 &&
    plan.notice?.state === 'PUBLISHED' &&
    plan.notice.acknowledgedByViewer &&
    plan.consent.complete &&
    !active
  );
  const canStop = Boolean(
    canHost && meetingLive && active && state !== 'STOP_REQUESTED' && plan?.recordingSession
  );
  const command = useMutation({
    mutationFn: async (action: 'START' | 'STOP') => {
      if (!plan) throw new Error('The meeting content plan is unavailable.');
      if (action === 'START') {
        return requestVideoMeetingRecording(meetingId, plan.version, crypto.randomUUID());
      }
      if (!plan.recordingSession) throw new Error('No recording session is active.');
      return stopVideoMeetingRecording(
        meetingId,
        plan.recordingSession.version,
        crypto.randomUUID()
      );
    },
    onSuccess: async (result) => {
      setCommandError(!result.accepted);
      setConfirmation(null);
      await query.refetch();
    },
    onError: () => {
      setCommandError(true);
      setConfirmation(null);
      void query.refetch();
    },
  });
  const statusColor = useMemo(() => {
    if (state === 'RECORDING') return 'error' as const;
    if (query.isError) return 'warning' as const;
    if (active) return 'warning' as const;
    return 'default' as const;
  }, [active, query.isError, state]);

  return (
    <>
      <ActionButton
        intent="quiet"
        size="small"
        startIcon={<Radio size={15} />}
        sx={{ color: 'common.white' }}
        title={t('room.content.open')}
        aria-label={`${t('room.content.open')}: ${statusLabel}`}
        onClick={() => setOpen(true)}
      >
        {statusLabel}
      </ActionButton>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        sx={{ zIndex: 1400 }}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 420 },
              p: 2.5,
              '& .MuiAlert-message': {
                minWidth: 0,
                overflow: 'visible',
                overflowWrap: 'anywhere',
              },
            },
          },
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
          <Box>
            <Typography component="h2" variant="h6" fontWeight={850}>
              {t('room.content.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {t('room.content.description')}
            </Typography>
          </Box>
          <ActionIconButton label={t('actions.close')} onClick={() => setOpen(false)}>
            <X size={18} />
          </ActionIconButton>
        </Stack>
        <Divider sx={{ my: 2 }} />

        {query.isLoading && !plan ? (
          <Alert severity="info">{t('room.content.loading')}</Alert>
        ) : !plan ? (
          <Stack gap={1.25}>
            <Alert severity="error">{t('room.content.loadError')}</Alert>
            <ActionButton
              intent="quiet"
              startIcon={<RefreshCw size={16} />}
              onClick={() => query.refetch()}
            >
              {t('actions.retry')}
            </ActionButton>
          </Stack>
        ) : (
          <Stack gap={2}>
            {query.isError && (
              <Alert severity="warning">{t('room.content.refreshErrorLastKnown')}</Alert>
            )}
            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <ContentFeatureChips plan={plan} />
              <Chip
                size="small"
                color={statusColor}
                label={t(`room.content.recordingStates.${state}`)}
              />
            </Stack>
            {canHost && !active && <ContentPlanEditor meetingId={meetingId} plan={plan} />}
            {disclosureUnavailable(plan) && (
              <Alert severity="error">{t('room.content.noticeUnavailable')}</Alert>
            )}
            <ContentPlanBlockers plan={plan} />
            <NoticeAcknowledgement meetingId={meetingId} plan={plan} />
            {plan.recordingRequested && (
              <Alert severity={plan.consent.complete ? 'success' : 'info'}>
                {t('room.content.consentProgress', {
                  received: plan.consent.receivedAcknowledgements,
                  required: plan.consent.requiredAcknowledgements,
                })}
              </Alert>
            )}
            {commandError && <Alert severity="error">{t('room.content.commandError')}</Alert>}
            {canHost && (
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                {!active && (
                  <ActionButton
                    intent="primary"
                    disabled={!canStart}
                    startIcon={<Radio size={16} />}
                    onClick={() => setConfirmation('START')}
                  >
                    {t('room.content.startRecording')}
                  </ActionButton>
                )}
                {active && (
                  <ActionButton
                    intent="danger"
                    disabled={!canStop}
                    startIcon={<Square size={15} />}
                    onClick={() => setConfirmation('STOP')}
                  >
                    {t('room.content.stopRecording')}
                  </ActionButton>
                )}
                {!canStart && !active && (
                  <Typography variant="caption" color="text.secondary">
                    {t('room.content.startBlocked')}
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>
        )}
      </Drawer>

      <ConfirmDialog
        open={confirmation !== null}
        title={t(
          confirmation === 'STOP'
            ? 'room.content.stopConfirmTitle'
            : 'room.content.startConfirmTitle'
        )}
        description={t(
          confirmation === 'STOP'
            ? 'room.content.stopConfirmDescription'
            : 'room.content.startConfirmDescription'
        )}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t(
          confirmation === 'STOP' ? 'room.content.stopRecording' : 'room.content.startRecording'
        )}
        confirmingLabel={t('room.content.applying')}
        intent={confirmation === 'STOP' ? 'danger' : 'primary'}
        busy={command.isPending}
        onClose={() => setConfirmation(null)}
        onConfirm={() => {
          if (confirmation) command.mutate(confirmation);
        }}
      />
    </>
  );
}
