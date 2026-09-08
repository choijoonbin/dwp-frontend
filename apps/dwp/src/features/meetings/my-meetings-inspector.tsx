import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  LoadingState,
  ProgressMeter,
} from '@dwp-frontend/design-system';
import type { VideoMeetingSummary } from '@dwp-frontend/shared-utils/api/video-meeting-api';
import { getVideoMeetingContentPlan } from '@dwp-frontend/shared-utils/api/video-meeting-content-api';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { meetingInsetSurface, meetingShape, meetingSoftShadow } from './meeting-visual-system';
import { meetingPreparationPath } from './meeting-context-routing';
import { meetingInvitationProgress, type MyMeetingEvidence } from './my-meetings-model';
import { MyMeetingCopyLink } from './my-meetings-presentation';
import { MyMeetingResponseActions } from './my-meetings-evidence';
import { MeetingScheduleManagement } from './meeting-schedule-management';

export function MyMeetingsInspector({
  meeting,
  evidence,
  scope,
  onClose,
  onChanged,
}: {
  meeting: VideoMeetingSummary;
  evidence?: MyMeetingEvidence;
  scope: string;
  onClose: () => void;
  onChanged: () => Promise<unknown>;
}) {
  const { t } = useTranslation('meetings');
  const navigate = useNavigate();
  const progress = meetingInvitationProgress(evidence?.preparation);
  const preparation = evidence?.preparation;
  const content = useQuery({
    queryKey: ['meetings', 'mine-inspector-content', scope, meeting.meetingId],
    queryFn: () => getVideoMeetingContentPlan(meeting.meetingId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
    meta: { accessSensitive: true },
  });
  const plan =
    !content.isError && content.data?.meetingId === meeting.meetingId ? content.data : null;
  return (
    <Stack
      component="aside"
      aria-label={t('mine.inspector.label')}
      data-testid="my-meetings-inspector"
      gap={2.5}
      sx={(theme) => ({
        p: 2.5,
        minWidth: 0,
        bgcolor: 'background.paper',
        borderRadius: meetingShape.stage,
        border: 1,
        borderColor: 'divider',
        boxShadow: meetingSoftShadow(theme),
      })}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
        sx={{ pb: 1.5, borderBottom: 1, borderColor: 'divider' }}
      >
        <Typography variant="subtitle1" component="h2" fontWeight="fontWeightBold">
          {t('mine.inspector.label')}
        </Typography>
        <ActionIconButton label={t('actions.close')} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </ActionIconButton>
      </Stack>
      <Box>
        <Typography variant="caption" color="text.secondary">
          {t('mine.design.seriesOverview')}
        </Typography>
        <Typography variant="subtitle2" sx={{ mt: 1 }}>
          {meeting.title}
        </Typography>
        {evidence?.schedule ? (
          <Box sx={(theme) => ({ ...meetingInsetSurface(theme), p: 1.5, mt: 1 })}>
            <Typography variant="body2">
              {t(
                evidence.schedule.frequency === 'WEEKLY'
                  ? 'scheduleWorkspace.weekly'
                  : evidence.schedule.frequency === 'MONTHLY'
                    ? 'scheduleWorkspace.monthly'
                    : 'scheduleWorkspace.once'
              )}
            </Typography>
            {evidence.schedule.seriesId && (
              <Typography variant="caption" color="text.secondary">
                {t('scheduleManagement.seriesPosition', {
                  current: evidence.schedule.occurrenceIndex,
                  total: evidence.schedule.occurrenceCount,
                })}
              </Typography>
            )}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {t('mine.design.evidencePending')}
          </Typography>
        )}
      </Box>
      <Box>
        <Stack direction="row" gap={1} alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2">
            <UsersRound size={15} aria-hidden="true" /> {t('mine.inspector.attendees')}
          </Typography>
          {progress && (
            <Typography variant="caption" color="success.main">
              {progress.percent}%
            </Typography>
          )}
        </Stack>
        {progress && (
          <ProgressMeter
            label={t('mine.design.acceptance', progress)}
            value={progress.percent}
            tone="success"
            sx={{ my: 1.5 }}
          />
        )}
        <Stack
          component="ul"
          tabIndex={0}
          aria-label={t('mine.inspector.attendees')}
          gap={0.75}
          sx={{ p: 0, m: 0, mt: 1, listStyle: 'none', maxHeight: 260, overflowY: 'auto' }}
        >
          {(preparation?.invitationResponses ?? []).map((person) => (
            <Stack
              component="li"
              key={person.participantId}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              gap={1}
              sx={{
                p: 1,
                bgcolor: person.mine ? 'action.selected' : 'transparent',
                borderRadius: meetingShape.inset,
              }}
            >
              <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
                <Box
                  aria-hidden="true"
                  sx={{
                    bgcolor: 'action.selected',
                    color: 'primary.main',
                    p: 0.75,
                    borderRadius: '50%',
                  }}
                >
                  {person.displayName.slice(0, 1)}
                </Box>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  {person.displayName}
                </Typography>
              </Stack>
              {person.response === 'ACCEPTED' ? (
                <CheckCircle2 size={17} aria-label={t('preparation.responses.ACCEPTED')} />
              ) : (
                <Chip size="small" label={t('preparation.responses.' + person.response)} />
              )}
            </Stack>
          ))}
        </Stack>
        {!preparation?.invitationResponses.length && (
          <Typography variant="caption" color="text.secondary">
            {t('mine.design.evidencePending')}
          </Typography>
        )}
        {preparation?.canRespond && preparation.myResponse && (
          <Box sx={{ mt: 1.5 }}>
            <MyMeetingResponseActions
              key={`${meeting.meetingId}-${preparation.invitationRevision}-${preparation.myResponse.version}`}
              meetingId={meeting.meetingId}
              preparation={preparation}
              onChanged={onChanged}
            />
          </Box>
        )}
      </Box>
      <Box>
        <Typography variant="subtitle2">{t('mine.design.accessPolicy')}</Typography>
        <Stack gap={1.25} sx={(theme) => ({ ...meetingInsetSurface(theme), p: 1.5, mt: 1 })}>
          <Typography variant="body2">
            <ShieldCheck size={15} aria-hidden="true" /> {t('access.' + meeting.accessScope)}
          </Typography>
          <Typography variant="body2">
            {t(meeting.waitingRoomEnabled ? 'mine.design.waitingOn' : 'mine.design.waitingOff')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {t('scheduleWorkspace.policyRecheck')}
          </Typography>
        </Stack>
      </Box>
      <Box sx={(theme) => ({ ...meetingInsetSurface(theme, 'primary'), p: 1.5 })}>
        <Typography variant="subtitle2">
          <Sparkles size={16} aria-hidden="true" /> {t('mine.design.contentPlan')}
        </Typography>
        {content.isLoading ? (
          <LoadingState label={t('room.content.loading')} size="compact" />
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            {plan
              ? t('mine.design.contentState', {
                  state: t('mine.design.planStates.' + plan.state),
                  recording: t(
                    plan.recordingRequested ? 'mine.design.requested' : 'mine.design.notRequested'
                  ),
                  transcript: t(
                    plan.transcriptionRequested
                      ? 'mine.design.requested'
                      : 'mine.design.notRequested'
                  ),
                  summary: t(
                    plan.aiSummaryRequested ? 'mine.design.requested' : 'mine.design.notRequested'
                  ),
                })
              : t('mine.design.evidencePending')}
          </Typography>
        )}
      </Box>
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Typography variant="subtitle2">
            {t('preparation.materials')}
            {preparation ? ` (${preparation.materials.length})` : ''}
          </Typography>
          {preparation?.canManageMaterials && (
            <ActionButton
              intent="quiet"
              size="small"
              onClick={() => navigate(meetingPreparationPath(meeting.meetingId))}
            >
              {t('mine.design.manageMaterials')}
            </ActionButton>
          )}
        </Stack>
        <Stack component="ul" gap={0.75} sx={{ listStyle: 'none', p: 0, m: 0, mt: 1 }}>
          {preparation?.materials.map((material) => (
            <Box
              component="li"
              key={material.materialId}
              sx={(theme) => ({ ...meetingInsetSurface(theme), p: 1 })}
            >
              <ActionButton
                intent="quiet"
                startIcon={<FileText size={16} aria-hidden="true" />}
                onClick={() => navigate(meetingPreparationPath(meeting.meetingId))}
                sx={{
                  textAlign: 'left',
                  justifyContent: 'flex-start',
                  p: 0,
                  whiteSpace: 'normal',
                  minWidth: 0,
                }}
              >
                {material.displayName}
              </ActionButton>
              <Typography variant="caption" display="block" color="text.secondary">
                {t('preparation.materialClassifications.' + material.classification)}
              </Typography>
            </Box>
          ))}
        </Stack>
        {preparation && !preparation.materials.length && (
          <Typography variant="caption" color="text.secondary">
            {t('mine.design.noMaterials')}
          </Typography>
        )}
      </Box>
      <ActionButton
        intent="primary"
        endIcon={<ArrowUpRight size={17} aria-hidden="true" />}
        disabled={meeting.lifecycleState === 'CANCELLED'}
        onClick={() =>
          navigate(
            meeting.lifecycleState === 'ENDED'
              ? `/meetings/history?meeting=${encodeURIComponent(meeting.meetingId)}`
              : meetingPreparationPath(meeting.meetingId)
          )
        }
      >
        {t(meeting.lifecycleState === 'ENDED' ? 'history.openRecap' : 'home.focus.prepare')}
      </ActionButton>
      <MeetingScheduleManagement meeting={meeting} onChanged={onChanged} />
      <MyMeetingCopyLink key={meeting.meetingId} meeting={meeting} />
    </Stack>
  );
}
