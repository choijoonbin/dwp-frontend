import { useTranslation } from 'react-i18next';
import { FilePlus2, MessageSquareReply } from 'lucide-react';
import { ActionButton, InlineFeedback, LoadingState } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalRequestLifecycleInspector } from './approval-request-lifecycle-inspector';
import { ApprovalRequestListPanel } from './approval-request-list-panel';

import type {
  ApprovalRequest,
  ApprovalRequestDetail,
  ApprovalRequestStatus,
  ApprovalTimelineEvent,
} from '@dwp-frontend/shared-utils';
import type { ApprovalAttachmentClient } from './use-approval-attachment-client';
import type { ApprovalRequestRecovery } from './approval-request-model';

export type ApprovalRequestDeepLinkProblemKind = 'NOT_FOUND' | 'DENIED' | 'ERROR' | 'WRONG_VIEW';

export function ApprovalRequestDeepLinkProblem({
  problem,
  status,
  retrying,
  onRetry,
  onClose,
}: {
  problem: ApprovalRequestDeepLinkProblemKind;
  status?: ApprovalRequestStatus;
  retrying: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('approvals');
  const message =
    problem === 'WRONG_VIEW' && status
      ? `${t('requests.draftLoadError')} · ${t('requests.columns.status')}: ${t(`status.${status}`)}`
      : problem === 'ERROR'
        ? t('requests.detail.loadError')
        : t('requests.draftLoadError');

  return (
    <InlineFeedback
      severity="error"
      action={
        <Stack direction="row" gap={0.5}>
          {problem === 'ERROR' && (
            <ActionButton intent="quiet" size="small" disabled={retrying} onClick={onRetry}>
              {t('actions.retry')}
            </ActionButton>
          )}
          <ActionButton intent="quiet" size="small" onClick={onClose}>
            {t('actions.close')}
          </ActionButton>
        </Stack>
      }
    >
      {message}
    </InlineFeedback>
  );
}

export function ApprovalRequestUnknownResponseNotice({ onResume }: { onResume: () => void }) {
  const { t } = useTranslation('approvals');
  return (
    <InlineFeedback
      severity="warning"
      action={
        <ActionButton intent="quiet" size="small" onClick={onResume}>
          {t('requests.amendment.resumeUnknown')}
        </ActionButton>
      }
    >
      {t('requests.commands.unknown')}
    </InlineFeedback>
  );
}

export function ApprovalRequestLifecycleCollection({
  deepLinkLoading,
  loading,
  error,
  retrying,
  filtered,
  requests,
  selected,
  actionsReady,
  pending,
  attachments,
  onRetry,
  onSelect,
  onOpenDetails,
  onEdit,
  onRespond,
  onWithdraw,
  onResubmit,
  resubmitPendingId,
}: {
  deepLinkLoading: boolean;
  loading: boolean;
  error: boolean;
  retrying: boolean;
  filtered: boolean;
  requests: readonly ApprovalRequest[];
  selected?: ApprovalRequest;
  actionsReady: boolean;
  pending: boolean;
  attachments: ApprovalAttachmentClient;
  onRetry: () => void;
  onSelect: (request: ApprovalRequest) => void;
  onOpenDetails: (request: ApprovalRequest) => void;
  onEdit: (request: ApprovalRequest) => void;
  onRespond: (request: ApprovalRequest) => void;
  onWithdraw: (request: ApprovalRequest) => void;
  onResubmit?: (request: ApprovalRequest) => void;
  resubmitPendingId?: string;
}) {
  const { t } = useTranslation('approvals');
  if (deepLinkLoading || loading)
    return <LoadingState label={t('common:labels.loading')} size="page" embedded />;
  if (error)
    return (
      <InlineFeedback
        severity="error"
        action={
          <ActionButton intent="quiet" size="small" disabled={retrying} onClick={onRetry}>
            {t('actions.retry')}
          </ActionButton>
        }
      >
        {t('requests.loadError')}
      </InlineFeedback>
    );
  if (!requests.length)
    return (
      <Stack alignItems="center" gap={1} sx={{ py: 8, color: 'text.secondary' }}>
        <FilePlus2 size={32} aria-hidden="true" />
        <Typography component="p" variant="subtitle1">
          {t(filtered ? 'requests.search.noResults' : 'requests.empty')}
        </Typography>
        <Typography variant="body2" textAlign="center">
          {t('requests.emptyDescription')}
        </Typography>
      </Stack>
    );

  const shared = {
    requests,
    selectedId: selected?.requestId,
    actionsReady,
    pending,
    onSelect,
    onOpenDetails,
    onEdit,
    onRespond,
    onWithdraw,
    onResubmit,
    resubmitPendingId,
  };
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr)',
          lg: 'minmax(360px, .9fr) minmax(340px, 1.1fr)',
        },
        minHeight: 520,
      }}
    >
      <Box sx={{ minWidth: 0, borderRight: { lg: 1 }, borderColor: 'divider' }}>
        <ApprovalRequestListPanel {...shared} />
      </Box>
      <Box sx={{ display: { xs: 'none', lg: 'block' }, minWidth: 0, p: 2 }}>
        <ApprovalRequestLifecycleInspector
          {...shared}
          request={selected}
          attachments={attachments}
        />
      </Box>
    </Box>
  );
}

export function ApprovalRequestActionFeedback({
  recovery,
  unresolved,
  sourceChanged,
  informationDenied,
  pending,
  detailFetching,
  requestsFetching,
  onRefresh,
}: {
  recovery?: ApprovalRequestRecovery | 'UNKNOWN';
  unresolved: boolean;
  sourceChanged: boolean;
  informationDenied: boolean;
  pending: boolean;
  detailFetching: boolean;
  requestsFetching: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <>
      {recovery && (
        <InlineFeedback
          severity={recovery === 'CONFLICT' ? 'warning' : 'error'}
          action={
            <ActionButton type="button" intent="quiet" size="small" onClick={onRefresh}>
              {t('actions.refresh')}
            </ActionButton>
          }
        >
          {t(unresolved ? 'requests.commands.unknown' : 'requests.actionError')}
        </InlineFeedback>
      )}
      {sourceChanged && !informationDenied && (
        <InlineFeedback
          severity="warning"
          action={
            !recovery ? (
              <ActionButton
                intent="quiet"
                size="small"
                disabled={pending || detailFetching || requestsFetching}
                onClick={onRefresh}
              >
                {t('actions.refresh')}
              </ActionButton>
            ) : undefined
          }
        >
          {t('requests.amendment.sourceChanged')}
        </InlineFeedback>
      )}
    </>
  );
}

export function ApprovalRequestInformationContext({
  detail,
  event,
}: {
  detail: ApprovalRequestDetail;
  event?: ApprovalTimelineEvent;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Stack direction="row" gap={0.75} useFlexGap flexWrap="wrap">
      {event?.actorDisplayName && <Chip size="small" label={event.actorDisplayName} />}
      {event?.stepName && <Chip size="small" variant="outlined" label={event.stepName} />}
      {event?.occurredAt && (
        <Chip
          size="small"
          variant="outlined"
          label={formatDate(event.occurredAt, { dateStyle: 'medium', timeStyle: 'short' })}
        />
      )}
      {detail.request.dueAt && (
        <Chip
          size="small"
          variant="outlined"
          label={`${t('requests.columns.due')}: ${formatDate(detail.request.dueAt, {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}`}
        />
      )}
      <Chip size="small" variant="outlined" label={`v${detail.request.version}`} />
    </Stack>
  );
}

export function ApprovalRequestInformationPrompt({ message }: { message: string }) {
  return (
    <InlineFeedback severity="warning" icon={<MessageSquareReply size={18} aria-hidden="true" />}>
      {message}
    </InlineFeedback>
  );
}

export function ApprovalRequestInformationDetailStatus({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const { t } = useTranslation('approvals');
  if (loading)
    return (
      <Typography variant="body2" color="text.secondary">
        {t('requests.amendmentLoading')}
      </Typography>
    );
  if (!error) return null;
  return (
    <InlineFeedback
      severity="error"
      action={
        <ActionButton type="button" intent="quiet" size="small" onClick={onRetry}>
          {t('actions.retry')}
        </ActionButton>
      }
    >
      {t('requests.draftLoadError')}
    </InlineFeedback>
  );
}
