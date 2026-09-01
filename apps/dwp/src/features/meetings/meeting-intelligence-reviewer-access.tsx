import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, UserCheck, UserMinus } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActionButton, SelectField } from '@dwp-frontend/design-system';
import { useToast } from '@dwp-frontend/shared-utils';
import {
  getVideoMeetingIntelligenceReviewerAssignments,
  grantVideoMeetingIntelligenceAccess,
  revokeVideoMeetingIntelligenceAccess,
  type VideoMeetingIntelligencePermission,
  type VideoMeetingIntelligenceReport,
} from '@dwp-frontend/shared-utils/api/video-meeting-intelligence-api';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { deriveMeetingIntelligenceReviewerAccess } from './meeting-intelligence-reviewer-model';
import { meetingInsetSurface, meetingListSurface, meetingSurface } from './meeting-visual-system';

const REVIEW_ASSIGNMENT_REASON = 'HUMAN_REVIEW_ASSIGNED';

export function MeetingIntelligenceReviewerAccess({
  meetingId,
  report,
}: {
  meetingId: string;
  report: VideoMeetingIntelligenceReport;
}) {
  const { t } = useTranslation('meetings');
  const toast = useToast();
  const queryClient = useQueryClient();
  const titleId = useId();
  const [selectedUserId, setSelectedUserId] = useState('');
  const queryKey = useMemo(
    () =>
      [
        'meetings',
        meetingId,
        'intelligence',
        'reports',
        report.reportId,
        'reviewer-assignments',
      ] as const,
    [meetingId, report.reportId]
  );
  const assignmentsQuery = useQuery({
    queryKey,
    queryFn: () => getVideoMeetingIntelligenceReviewerAssignments(meetingId, report.reportId),
    staleTime: 15_000,
    retry: 1,
  });
  const model = deriveMeetingIntelligenceReviewerAccess(assignmentsQuery.data);

  useEffect(() => {
    if (
      selectedUserId &&
      !model.assignableCandidates.some((candidate) => String(candidate.userId) === selectedUserId)
    ) {
      setSelectedUserId('');
    }
  }, [model.assignableCandidates, selectedUserId]);

  const grantMutation = useMutation({
    mutationFn: (principalUserId: number) =>
      grantVideoMeetingIntelligenceAccess(meetingId, report.reportId, principalUserId, {
        expectedReportVersion: assignmentsQuery.data?.reportVersion ?? report.version,
        permission: 'REVIEW',
        expiresAt: null,
        reasonCode: REVIEW_ASSIGNMENT_REASON,
      }),
    onSuccess: async () => {
      setSelectedUserId('');
      await queryClient.invalidateQueries({ queryKey });
      toast.success(t('history.recap.intelligence.reviewers.assigned'));
    },
    onError: () => toast.error(t('history.recap.intelligence.reviewers.actionError')),
  });
  const revokeMutation = useMutation({
    mutationFn: ({
      principalUserId,
      permission,
    }: {
      principalUserId: number;
      permission: Extract<VideoMeetingIntelligencePermission, 'REVIEW' | 'MANAGE'>;
    }) =>
      revokeVideoMeetingIntelligenceAccess(
        meetingId,
        report.reportId,
        principalUserId,
        permission,
        assignmentsQuery.data?.reportVersion ?? report.version
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      toast.success(t('history.recap.intelligence.reviewers.revoked'));
    },
    onError: () => toast.error(t('history.recap.intelligence.reviewers.actionError')),
  });

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={(theme) => ({ ...meetingSurface(theme, { tone: 'primary', elevated: false }), p: 2 })}
    >
      <Stack direction="row" alignItems="flex-start" gap={1.25}>
        <Box
          aria-hidden="true"
          sx={(theme) => ({
            ...meetingInsetSurface(theme, 'primary'),
            width: 38,
            height: 38,
            display: 'grid',
            flex: '0 0 auto',
            placeItems: 'center',
          })}
        >
          <UserCheck size={19} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography id={titleId} component="h3" variant="subtitle1" fontWeight={750}>
            {t('history.recap.intelligence.reviewers.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {t('history.recap.intelligence.reviewers.description')}
          </Typography>
        </Box>
      </Stack>

      <Alert severity="info" icon={<ShieldCheck size={18} />} sx={{ mt: 1.5 }}>
        {t('history.recap.intelligence.reviewers.separationNote')}
      </Alert>

      {assignmentsQuery.isLoading && (
        <Typography role="status" variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {t('history.recap.intelligence.reviewers.loading')}
        </Typography>
      )}
      {assignmentsQuery.isError && (
        <Alert
          severity="warning"
          sx={{ mt: 2 }}
          action={
            <ActionButton intent="quiet" size="small" onClick={() => assignmentsQuery.refetch()}>
              {t('history.recap.intelligence.reviewers.retry')}
            </ActionButton>
          }
        >
          {t('history.recap.intelligence.reviewers.loadError')}
        </Alert>
      )}

      {assignmentsQuery.data && (
        <Stack gap={2} sx={{ mt: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="flex-start" gap={1}>
            <SelectField
              label={t('history.recap.intelligence.reviewers.candidateLabel')}
              placeholder={t('history.recap.intelligence.reviewers.candidatePlaceholder')}
              value={selectedUserId}
              options={model.assignableCandidates.map((candidate) => ({
                value: String(candidate.userId),
                label: `${candidate.displayName} · ${t(`room.roles.${candidate.participantRole}`)}`,
              }))}
              supportingText={
                model.assignableCandidates.length
                  ? t('history.recap.intelligence.reviewers.candidateHelp')
                  : t('history.recap.intelligence.reviewers.noEligible')
              }
              onValueChange={setSelectedUserId}
            />
            <ActionButton
              intent="primary"
              startIcon={<UserCheck size={17} aria-hidden="true" />}
              loading={grantMutation.isPending}
              loadingLabel={t('history.recap.intelligence.reviewers.assigning')}
              disabled={!selectedUserId}
              onClick={() => selectedUserId && grantMutation.mutate(Number(selectedUserId))}
              sx={{ minHeight: 44, mt: { sm: 1 } }}
            >
              {t('history.recap.intelligence.reviewers.assign')}
            </ActionButton>
          </Stack>

          <Box>
            <Typography component="h4" variant="subtitle2" fontWeight={750} sx={{ mb: 1 }}>
              {t('history.recap.intelligence.reviewers.activeTitle')}
            </Typography>
            {model.activeReviewers.length ? (
              <Box role="list" sx={(theme) => meetingListSurface(theme)}>
                {model.activeReviewers.map((reviewer) => (
                  <Stack
                    key={reviewer.aclId}
                    role="listitem"
                    direction={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                    justifyContent="space-between"
                    gap={1}
                    sx={{ px: 1.5, py: 1.25 }}
                  >
                    <Stack direction="row" alignItems="center" gap={1} sx={{ minWidth: 0 }}>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {reviewer.displayName ??
                          t('history.recap.intelligence.reviewers.unknownParticipant')}
                      </Typography>
                      <Chip
                        size="small"
                        variant="outlined"
                        label={t(
                          `history.recap.intelligence.reviewers.permissions.${reviewer.permission}`
                        )}
                      />
                    </Stack>
                    <ActionButton
                      intent="quiet"
                      size="small"
                      startIcon={<UserMinus size={16} aria-hidden="true" />}
                      loading={
                        revokeMutation.isPending &&
                        revokeMutation.variables?.principalUserId === reviewer.principalUserId
                      }
                      loadingLabel={t('history.recap.intelligence.reviewers.revoking')}
                      onClick={() =>
                        revokeMutation.mutate({
                          principalUserId: reviewer.principalUserId,
                          permission: reviewer.permission,
                        })
                      }
                      sx={{ minHeight: 44 }}
                    >
                      {t('history.recap.intelligence.reviewers.revoke')}
                    </ActionButton>
                  </Stack>
                ))}
              </Box>
            ) : (
              <Box sx={(theme) => ({ ...meetingInsetSurface(theme), p: 1.5 })}>
                <Typography variant="body2" color="text.secondary">
                  {t('history.recap.intelligence.reviewers.noActive')}
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>
      )}
    </Box>
  );
}
