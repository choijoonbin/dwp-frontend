import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BriefcaseBusiness, Link2, ShieldCheck } from 'lucide-react';
import {
  ActionButton,
  ConfirmDialog,
  InlineFeedback,
  LoadingState,
  LocalErrorState,
  SelectField,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { workAssignmentSourceRoute } from '@dwp-frontend/shared-utils/api/work-assignment-navigation';
import type {
  WorkAssignmentTask,
  WorkAssignmentTransition,
} from '@dwp-frontend/shared-utils/api/work-assignment-contracts';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import {
  availableWorkAssignmentActions,
  WORK_ASSIGNMENT_REASON_CODES,
} from './work-hub-assignment-model';
import type { WorkHubItem } from './work-hub-contracts';
import { WorkSourceDetailSection } from './work-hub-source-detail-section';
import { WorkHubAssignmentHistory } from './work-hub-assignment-history';
import { useWorkHubAssignmentDetail } from './use-work-hub-assignment-detail';

function PersonLabel({ personId, actorId }: { personId: number; actorId: number }) {
  const { t } = useTranslation('work');
  return (
    <>{t(personId === actorId ? 'workHub.assignment.me' : 'workHub.assignment.otherMember')}</>
  );
}

function AssignmentFields({ task, actorId }: { task: WorkAssignmentTask; actorId: number }) {
  const { t } = useTranslation('work');
  const sameOwner = task.createdByUserId === task.assigneeUserId;
  const fields = [
    ...(sameOwner
      ? [
          {
            label: t('workHub.assignment.requesterAndAssignee'),
            value: <PersonLabel personId={task.assigneeUserId} actorId={actorId} />,
          },
        ]
      : [
          {
            label: t('workHub.assignment.requester'),
            value: <PersonLabel personId={task.createdByUserId} actorId={actorId} />,
          },
          {
            label: t('workHub.assignment.assignee'),
            value: <PersonLabel personId={task.assigneeUserId} actorId={actorId} />,
          },
        ]),
    {
      label: t('workHub.assignment.assignmentState'),
      value: t(`workHub.assignment.assignmentStates.${task.assignmentState}`),
    },
    {
      label: t('workHub.assignment.workState'),
      value: t(`workHub.assignment.workStates.${task.workState}`),
    },
    {
      label: t('workHub.detail.priority'),
      value: t(`workHub.priority.${task.priority}`),
    },
    {
      label: t('workHub.detail.due'),
      value: task.dueAt
        ? formatDate(task.dueAt, { dateStyle: 'medium', timeStyle: 'short' })
        : t('workHub.urgency.NO_DUE_DATE'),
    },
  ];
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' },
        gap: 1.5,
      }}
    >
      {fields.map((field) => (
        <Box key={field.label} sx={{ minWidth: 0 }}>
          <Typography component="dt" variant="caption" color="text.secondary">
            {field.label}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            sx={{ m: 0, mt: 0.35, fontWeight: 'fontWeightBold', overflowWrap: 'anywhere' }}
          >
            {field.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function WorkHubAssignmentDetail({
  item,
  commandsEnabled,
  onAccessDenied,
  onChanged,
  onOpenSource,
}: {
  item: WorkHubItem;
  commandsEnabled: boolean;
  onAccessDenied: () => void;
  onChanged: () => void;
  onOpenSource: (route: string) => boolean;
}) {
  const { t } = useTranslation(['work', 'common']);
  const { user } = useAuth();
  const actorId = Number(user?.userId);
  const state = useWorkHubAssignmentDetail({
    item,
    actorId,
    commandsEnabled,
    onAccessDenied,
    onChanged,
  });
  const [confirm, setConfirm] = useState<WorkAssignmentTransition | null>(null);
  const [reason, setReason] = useState('');
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [sourceError, setSourceError] = useState(false);
  useEffect(() => {
    setConfirm(null);
    setReason('');
    setConfirmAttempted(false);
    setSourceError(false);
  }, [item.key, item.version]);
  const task = state.task;
  const actions = task ? availableWorkAssignmentActions(task) : [];
  const reasonOptions =
    confirm === 'decline' || confirm === 'cancel' ? WORK_ASSIGNMENT_REASON_CODES[confirm] : [];
  const reasonChoices = reasonOptions.map((code, index) => ({
    code,
    value: `reason-${index + 1}`,
  }));
  const selectedReason = reasonChoices.find((choice) => choice.value === reason)?.code;
  const route = task ? workAssignmentSourceRoute(task.source) : null;

  if (!Number.isSafeInteger(actorId) || actorId < 1)
    return (
      <LocalErrorState
        title={t('work:workHub.assignment.unavailableTitle')}
        description={t('work:workHub.assignment.unavailableDescription')}
        size="compact"
      />
    );
  if (state.query.isPending)
    return (
      <LoadingState
        label={t('work:workHub.assignment.loading')}
        variant="skeleton"
        skeletonRows={5}
      />
    );
  if (!task)
    return (
      <LocalErrorState
        title={t('work:workHub.assignment.unavailableTitle')}
        description={t('work:workHub.assignment.unavailableDescription')}
        retryLabel={t('common:actions.retry')}
        onRetry={() => void state.query.refetch()}
        size="compact"
      />
    );

  return (
    <Stack gap={2.5} data-testid="work-assignment-detail">
      <WorkSourceDetailSection
        title={t('work:workHub.assignment.confirmedWork')}
        description={t('work:workHub.assignment.confirmedWorkDescription')}
        icon={BriefcaseBusiness}
        tone="primary"
      >
        <Stack gap={2}>
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <Chip
              size="small"
              variant="outlined"
              label={t(`work:workHub.assignment.assignmentStates.${task.assignmentState}`)}
            />
            <Chip
              size="small"
              color={task.workState === 'COMPLETED' ? 'success' : 'info'}
              label={t(`work:workHub.assignment.workStates.${task.workState}`)}
            />
          </Stack>
          <AssignmentFields task={task} actorId={actorId} />
          <Box>
            <Typography variant="caption" color="text.secondary">
              {t('work:workHub.assignment.description')}
            </Typography>
            <Typography
              variant="body2"
              sx={{ mt: 0.35, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
            >
              {task.description || t('work:workHub.assignment.noDescription')}
            </Typography>
          </Box>
        </Stack>
      </WorkSourceDetailSection>

      {state.outcome && (
        <InlineFeedback
          severity="success"
          title={t('work:workHub.assignment.result.confirmedTitle')}
        >
          {t(
            state.outcome.currentAdvanced
              ? 'work:workHub.assignment.result.confirmedAndChanged'
              : 'work:workHub.assignment.result.confirmedDetail',
            {
              time: formatDate(state.outcome.receipt.appliedAt, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            }
          )}
        </InlineFeedback>
      )}
      {state.conflict && (
        <InlineFeedback
          severity="warning"
          title={t('work:workHub.assignment.result.conflictTitle')}
        >
          <Stack gap={1}>
            <Typography variant="body2">
              {t('work:workHub.assignment.result.conflictDetail')}
            </Typography>
            <ActionButton intent="secondary" onClick={state.reviewConflict}>
              {t('work:workHub.assignment.result.reviewCurrent')}
            </ActionButton>
          </Stack>
        </InlineFeedback>
      )}
      {state.uncertain && (
        <InlineFeedback
          severity="warning"
          title={t('work:workHub.assignment.result.uncertainTitle')}
        >
          <Stack gap={1}>
            <Typography variant="body2">
              {t('work:workHub.assignment.result.uncertainDetail')}
            </Typography>
            <Stack direction="row" gap={1} flexWrap="wrap">
              <ActionButton intent="primary" onClick={state.recover} disabled={!state.canRecover}>
                {t('work:workHub.assignment.result.checkResult')}
              </ActionButton>
              {state.canRetry && (
                <ActionButton intent="secondary" onClick={state.retry}>
                  {t('work:workHub.assignment.result.retrySame')}
                </ActionButton>
              )}
            </Stack>
          </Stack>
        </InlineFeedback>
      )}
      {!commandsEnabled && (
        <InlineFeedback
          severity="warning"
          title={t('work:workHub.assignment.commandsUnavailableTitle')}
        >
          {t('work:workHub.assignment.commandsUnavailableDescription')}
        </InlineFeedback>
      )}

      <WorkSourceDetailSection
        title={t('work:workHub.assignment.actionsTitle')}
        description={t('work:workHub.assignment.actionsDescription')}
        icon={ShieldCheck}
      >
        <Stack direction="row" gap={1} flexWrap="wrap">
          {actions.map((action) => (
            <ActionButton
              key={action}
              intent={action === 'decline' || action === 'cancel' ? 'quiet' : 'primary'}
              loading={state.busy}
              disabled={
                !commandsEnabled ||
                state.busy ||
                state.conflict ||
                state.uncertain ||
                state.query.isFetching
              }
              onClick={() => {
                setReason('');
                setConfirmAttempted(false);
                setConfirm(action);
              }}
              sx={{ minHeight: 44 }}
            >
              {t(`work:workHub.assignment.actions.${action}`)}
            </ActionButton>
          ))}
          {actions.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {t('work:workHub.assignment.noActions')}
            </Typography>
          )}
        </Stack>
        {task.capabilities.canReassign && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {t('work:workHub.assignment.reassignUnavailable')}
          </Typography>
        )}
      </WorkSourceDetailSection>

      <WorkSourceDetailSection
        title={t('work:workHub.assignment.sourceTitle')}
        description={t('work:workHub.assignment.sourceDescription')}
        icon={Link2}
        tone={task.source.availability === 'UNAVAILABLE' ? 'warning' : 'neutral'}
      >
        <Typography variant="body2" color="text.secondary">
          {t(`work:workHub.assignment.sourceStates.${task.source.availability}`)}
        </Typography>
        {route && (
          <ActionButton
            intent="secondary"
            sx={{ mt: 1.5, minHeight: 44 }}
            onClick={() => {
              setSourceError(!onOpenSource(route));
            }}
          >
            {t('work:workHub.assignment.openSource')}
          </ActionButton>
        )}
        {sourceError && (
          <Typography role="alert" variant="caption" color="error.main" display="block" mt={1}>
            {t('work:workHub.assignment.sourceOpenFailed')}
          </Typography>
        )}
      </WorkSourceDetailSection>

      <WorkHubAssignmentHistory
        task={task}
        actorId={actorId}
        onAccessDenied={onAccessDenied}
        onTaskChanged={() => {
          void state.query.refetch().then(() => onChanged());
        }}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={t('work:workHub.assignment.confirmTitle', {
          action: confirm ? t(`work:workHub.assignment.actions.${confirm}`) : '',
        })}
        description={t('work:workHub.assignment.confirmDescription')}
        cancelLabel={t('common:actions.cancel')}
        confirmLabel={t('work:workHub.assignment.confirmAction')}
        intent={confirm === 'decline' || confirm === 'cancel' ? 'danger' : 'primary'}
        onClose={() => {
          setConfirm(null);
          setConfirmAttempted(false);
        }}
        onConfirm={() => {
          if (!confirm) return;
          if (reasonOptions.length > 0 && !selectedReason) {
            setConfirmAttempted(true);
            return;
          }
          if (state.execute(confirm, selectedReason)) setConfirm(null);
        }}
        details={
          reasonOptions.length > 0 ? (
            <SelectField
              label={t('work:workHub.assignment.reason')}
              value={reason}
              placeholder={t('work:workHub.assignment.chooseReason')}
              options={reasonChoices.map((choice) => ({
                value: choice.value,
                label: t(`work:workHub.assignment.reasons.${choice.code}`),
              }))}
              onValueChange={(value) => setReason(String(value))}
              supportingText={t('work:workHub.assignment.reasonRequired')}
              errorMessage={
                confirmAttempted && !selectedReason
                  ? t('work:workHub.assignment.reasonRequired')
                  : undefined
              }
            />
          ) : undefined
        }
      />
    </Stack>
  );
}
