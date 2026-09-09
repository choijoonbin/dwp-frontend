import { History } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import type { WorkAssignmentTask } from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { WorkSourceDetailSection } from './work-hub-source-detail-section';
import { WorkAssignmentHistoryChangedError } from './work-hub-assignment-history-model';
import { useWorkHubAssignmentHistory } from './use-work-hub-assignment-history';

const publicReasonKeys = new Set([
  'CAPACITY_LIMIT',
  'OUTSIDE_RESPONSIBILITY',
  'NO_LONGER_REQUIRED',
  'DUPLICATE_WORK',
]);

export function WorkHubAssignmentHistory({
  task,
  actorId,
  onAccessDenied,
  onTaskChanged,
}: {
  task: WorkAssignmentTask;
  actorId: number;
  onAccessDenied: () => void;
  onTaskChanged: () => void;
}) {
  const { t } = useTranslation('work');
  const query = useWorkHubAssignmentHistory({
    assignmentId: task.assignmentId,
    taskVersion: task.version,
    onAccessDenied,
    onTaskChanged,
  });
  return (
    <WorkSourceDetailSection
      title={t('workHub.assignment.history.title')}
      description={t('workHub.assignment.history.description')}
      icon={History}
    >
      {query.isPending ? (
        <LoadingState
          label={t('workHub.assignment.history.loading')}
          variant="skeleton"
          skeletonRows={3}
        />
      ) : query.isError ? (
        <InlineFeedback severity="warning" title={t('workHub.assignment.history.unavailableTitle')}>
          <Stack gap={1}>
            <Typography variant="body2">
              {t(
                query.error instanceof WorkAssignmentHistoryChangedError
                  ? query.error.direction === 'AHEAD'
                    ? 'workHub.assignment.history.changedAheadDescription'
                    : 'workHub.assignment.history.changedBehindDescription'
                  : 'workHub.assignment.history.unavailableDescription'
              )}
            </Typography>
            <ActionButton
              intent="secondary"
              onClick={
                query.error instanceof WorkAssignmentHistoryChangedError
                  ? query.error.direction === 'AHEAD'
                    ? onTaskChanged
                    : () => void query.refetch()
                  : () => void query.refetch()
              }
            >
              {t(
                query.error instanceof WorkAssignmentHistoryChangedError
                  ? query.error.direction === 'AHEAD'
                    ? 'workHub.assignment.history.reviewCurrent'
                    : 'workHub.assignment.history.retry'
                  : 'workHub.assignment.history.retry'
              )}
            </ActionButton>
          </Stack>
        </InlineFeedback>
      ) : query.data.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t('workHub.assignment.history.empty')}
        </Typography>
      ) : (
        <Stack component="ol" gap={1.5} sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {query.data.map((event) => (
            <Box
              component="li"
              key={event.eventId}
              sx={{
                minWidth: 0,
                p: 1.5,
                borderInlineStart: 3,
                borderColor: 'primary.main',
                bgcolor: 'action.hover',
                borderRadius: (theme) => `${theme.shape.borderRadius}px`,
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                gap={0.75}
              >
                <Typography variant="subtitle2">
                  {t(`workHub.assignment.history.actions.${event.action}`)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(event.occurredAt, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                {t('workHub.assignment.history.actor', {
                  actor: t(
                    event.actorUserId === actorId
                      ? 'workHub.assignment.me'
                      : 'workHub.assignment.otherMember'
                  ),
                })}
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block" mt={0.25}>
                {t('workHub.assignment.history.assignee', {
                  assignee: t(
                    event.assigneeUserId === actorId
                      ? 'workHub.assignment.me'
                      : 'workHub.assignment.otherMember'
                  ),
                })}
              </Typography>
              <Stack direction="row" gap={0.75} flexWrap="wrap" mt={1}>
                <Chip
                  size="small"
                  variant="outlined"
                  label={t(`workHub.assignment.assignmentStates.${event.assignmentState}`)}
                />
                <Chip size="small" label={t(`workHub.assignment.workStates.${event.workState}`)} />
              </Stack>
              {event.reasonCode && (
                <Typography variant="caption" color="text.secondary" display="block" mt={0.75}>
                  {t('workHub.assignment.history.reason', {
                    reason: publicReasonKeys.has(event.reasonCode)
                      ? t(`workHub.assignment.reasons.${event.reasonCode}`)
                      : t('workHub.assignment.history.policyReason'),
                  })}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </WorkSourceDetailSection>
  );
}
