import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import { ArrowUpRight, CheckCheck, FileCheck2, RefreshCw, X } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  ConfirmDialog,
  ErrorState,
  InlineFeedback,
  LoadingState,
  SectionHeader,
  SelectField,
  foundationTokens,
} from '@dwp-frontend/design-system';
import type { WorkAssignmentTransition } from '@dwp-frontend/shared-utils/api/work-assignment-contracts';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import {
  availableFollowUpActions,
  followUpSourcePath,
  FOLLOW_UP_REASON_CODES,
} from './meeting-follow-ups-model';
import { useFollowUpDetail } from './meeting-follow-ups-state';

type Props = {
  assignmentId: string;
  actorId: number;
  scopeKey: string;
  onAccessDenied: () => void;
  onChanged: () => void;
  onClose: () => void;
};

export function MeetingFollowUpsDetail(props: Props) {
  const { t, i18n } = useTranslation('meetings');
  const navigate = useNavigate();
  const state = useFollowUpDetail(props);
  const [confirm, setConfirm] = useState<WorkAssignmentTransition | null>(null);
  const [reason, setReason] = useState('');
  const task = state.query.isError ? undefined : state.query.data;
  const sourcePath = task ? followUpSourcePath(task) : null;
  const reasonOptions =
    confirm === 'decline' || confirm === 'cancel' ? FOLLOW_UP_REASON_CODES[confirm] : [];
  const displayDate = (value: string | null) =>
    value && Number.isFinite(Date.parse(value))
      ? formatDate(
          value,
          { dateStyle: 'medium', timeStyle: 'short' },
          resolveSupportedLocale(i18n.language)
        )
      : t('followUps.notSet');
  return (
    <Box
      component="section"
      aria-labelledby="follow-up-detail-title"
      data-testid="meeting-follow-up-detail"
      sx={{
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: foundationTokens.radius.surface + 'px',
        p: { xs: 2, lg: 3 },
        minWidth: 0,
        overflowWrap: 'anywhere',
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        gap={1}
        sx={{ mb: 2 }}
      >
        <Typography id="follow-up-detail-title" component="h2" variant="subtitle1">
          {t('followUps.detailTitle')}
        </Typography>
        <Stack direction="row">
          <ActionIconButton
            label={t('followUps.refreshDetail')}
            loading={state.query.isFetching}
            disabled={state.busy}
            onClick={() => void state.query.refetch()}
          >
            <RefreshCw size={16} aria-hidden="true" />
          </ActionIconButton>
          <ActionIconButton
            label={t('followUps.closeDetail')}
            onClick={props.onClose}
            disabled={state.busy}
          >
            <X size={18} aria-hidden="true" />
          </ActionIconButton>
        </Stack>
      </Stack>
      {state.query.isError ? (
        <ErrorState
          title={t('followUps.detailError')}
          description={t('followUps.detailErrorHint')}
          retryLabel={t('actions.retry')}
          onRetry={() => void state.query.refetch()}
        />
      ) : !task ? (
        <LoadingState label={t('followUps.loadingDetail')} variant="skeleton" skeletonRows={4} />
      ) : (
        <Stack gap={2.5}>
          <Box>
            <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mb: 1.5 }}>
              <Chip size="small" label={t('followUps.assignmentStates.' + task.assignmentState)} />
              <Chip
                size="small"
                color={task.workState === 'COMPLETED' ? 'success' : 'default'}
                label={t('followUps.workStates.' + task.workState)}
              />
            </Stack>
            <Typography component="h3" variant="h4" sx={{ mb: 1 }}>
              {task.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {task.description || t('followUps.noDescription')}
            </Typography>
          </Box>
          <Box
            component="dl"
            sx={{
              m: 0,
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 2,
            }}
          >
            {[
              [
                'assignee',
                task.assigneeUserId === props.actorId
                  ? t('followUps.me')
                  : t('followUps.userReference', { id: task.assigneeUserId }),
              ],
              [
                'requester',
                task.createdByUserId === props.actorId
                  ? t('followUps.me')
                  : t('followUps.userReference', { id: task.createdByUserId }),
              ],
              ['due', displayDate(task.dueAt)],
              ['priority', t('followUps.priorities.' + task.priority)],
            ].map(([label, value]) => (
              <Box key={label}>
                <Typography component="dt" variant="caption" color="text.secondary">
                  {t('followUps.' + label)}
                </Typography>
                <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.5 }}>
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <SectionHeader
              icon={FileCheck2}
              title={t('followUps.sourceTitle')}
              density="compact"
              glyph="plain"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {t('followUps.sourceStates.' + task.source.availability)}
            </Typography>
            {sourcePath && (
              <ActionButton
                intent="quiet"
                endIcon={<ArrowUpRight size={16} aria-hidden="true" />}
                onClick={() => navigate(sourcePath)}
                sx={{ mt: 1, minHeight: 44 }}
              >
                {t('followUps.openSource')}
              </ActionButton>
            )}
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              {t('followUps.sourceAclHint')}
            </Typography>
          </Box>
          {state.conflict && (
            <InlineFeedback severity="warning" title={t('followUps.conflictTitle')}>
              <Stack gap={1}>
                <Typography variant="body2">{t('followUps.conflictHint')}</Typography>
                <ActionButton
                  intent="secondary"
                  onClick={state.reviewConflict}
                  disabled={state.query.isFetching || state.query.isError}
                >
                  {t('followUps.reviewLatest')}
                </ActionButton>
              </Stack>
            </InlineFeedback>
          )}
          {state.uncertain && (
            <InlineFeedback severity="warning" title={t('followUps.uncertainTitle')}>
              <Stack gap={1}>
                <Typography variant="body2">{t('followUps.uncertainHint')}</Typography>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  <ActionButton intent="primary" onClick={state.recover} disabled={state.busy}>
                    {t('followUps.checkReceipt')}
                  </ActionButton>
                  <ActionButton intent="secondary" onClick={state.retry} disabled={state.busy}>
                    {t('followUps.retrySameCommand')}
                  </ActionButton>
                </Stack>
              </Stack>
            </InlineFeedback>
          )}
          {state.receipt && (
            <InlineFeedback severity="success" title={t('followUps.commandConfirmed')}>
              {t('followUps.receiptEvidence', {
                appliedVersion: state.receipt.appliedVersion,
                currentVersion: task.version,
                time: displayDate(state.receipt.appliedAt),
              })}
            </InlineFeedback>
          )}
          <Box>
            <SectionHeader
              icon={CheckCheck}
              title={t('followUps.actionsTitle')}
              density="compact"
              glyph="plain"
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1.5 }}>
              {t('followUps.acceptNotStart')}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
              {availableFollowUpActions(task).map((action) => (
                <ActionButton
                  key={action}
                  intent={action === 'cancel' || action === 'decline' ? 'quiet' : 'primary'}
                  disabled={
                    state.busy || state.conflict || state.uncertain || state.query.isFetching
                  }
                  sx={{ minHeight: 44 }}
                  onClick={() => {
                    setReason('');
                    setConfirm(action);
                  }}
                >
                  {t('followUps.actions.' + action)}
                </ActionButton>
              ))}
              {!availableFollowUpActions(task).length && (
                <Typography variant="body2" color="text.secondary">
                  {t('followUps.noActions')}
                </Typography>
              )}
            </Stack>
          </Box>
          <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
            <ActionButton intent="secondary" disabled fullWidth>
              {t('followUps.openWork')}
            </ActionButton>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              {t('followUps.workRouteUnavailable')}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              {t('followUps.reassignUnavailable')}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {t('followUps.currentEvidence', {
              version: task.version,
              revision: task.assignmentRevision,
              time: displayDate(task.updatedAt),
            })}
          </Typography>
        </Stack>
      )}
      <ConfirmDialog
        open={Boolean(confirm && task)}
        title={t('followUps.confirmTitle', {
          action: confirm ? t('followUps.actions.' + confirm) : '',
        })}
        description={t('followUps.confirmHint')}
        cancelLabel={t('actions.cancel')}
        confirmLabel={t('followUps.confirmCommand')}
        intent={confirm === 'cancel' || confirm === 'decline' ? 'danger' : 'primary'}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm || (reasonOptions.length && !reason)) return;
          state.execute(confirm, reason || undefined);
          setConfirm(null);
        }}
        details={
          reasonOptions.length ? (
            <SelectField
              label={t('followUps.reason')}
              value={reason}
              placeholder={t('followUps.chooseReason')}
              options={reasonOptions.map((value) => ({
                value,
                label: t('followUps.reasons.' + value),
              }))}
              onValueChange={setReason}
              supportingText={t('followUps.reasonRequired')}
              errorMessage={!reason ? t('followUps.reasonRequired') : undefined}
            />
          ) : undefined
        }
      />
    </Box>
  );
}
