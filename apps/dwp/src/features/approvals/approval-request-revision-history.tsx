import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, History, RotateCcw } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalPayloadData } from './approval-payload-data';

import type { useApprovalRequestRevisionHistory } from './use-approval-request-revision-history';

export function ApprovalRequestRevisionHistory({
  history,
  onRecover,
}: {
  history: ReturnType<typeof useApprovalRequestRevisionHistory>;
  onRecover?: (revision: number) => void;
}) {
  const { t } = useTranslation('approvals');
  const { page, setPage, setSelectedRevision, revisions, selected, detail, visible } = history;
  return (
    <Box
      component="section"
      aria-label={t('requests.autosave.history')}
      sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}
    >
      <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 1 }}>
        <History size={17} aria-hidden="true" />
        <Typography component="h3" variant="subtitle2">
          {t('requests.autosave.history')}
        </Typography>
      </Stack>
      {revisions.isFetching ? (
        <LoadingState label={t('common:labels.loading')} embedded />
      ) : revisions.isError ? (
        <InlineFeedback
          severity="error"
          action={
            <ActionButton intent="quiet" size="small" onClick={() => void revisions.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('requests.loadError')}
        </InlineFeedback>
      ) : !revisions.data?.items.length ? (
        <Typography variant="body2" color="text.secondary">
          {t('requests.drafts.historyEmpty')}
        </Typography>
      ) : (
        <>
          <List disablePadding aria-label={t('requests.autosave.history')}>
            {revisions.data.items.map((revision) => (
              <ListItem key={revision.revision} disablePadding>
                <ListItemButton
                  selected={selected?.revision === revision.revision}
                  onClick={() => setSelectedRevision(revision.revision)}
                  sx={{ minHeight: 48, px: 1, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Stack minWidth={0} width="100%" gap={0.5}>
                    <Stack direction="row" gap={1} justifyContent="space-between">
                      <Typography variant="subtitle2">
                        {t('requests.drafts.revisionLabel', { revision: revision.revision })}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(revision.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
                      </Typography>
                    </Stack>
                    {revision.reason && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {revision.reason}
                      </Typography>
                    )}
                  </Stack>
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          <Stack
            direction="row"
            justifyContent="flex-end"
            alignItems="center"
            gap={1}
            sx={{ py: 1 }}
          >
            <Typography variant="caption">
              {t('requests.drafts.page', { page: page + 1, total: revisions.data.totalPages })}
            </Typography>
            <ActionIconButton
              label={t('common:actions.previous')}
              disabled={page === 0 || revisions.isFetching}
              onClick={() => {
                setPage(page - 1);
                setSelectedRevision(undefined);
              }}
            >
              <ArrowLeft size={16} />
            </ActionIconButton>
            <ActionIconButton
              label={t('common:actions.next')}
              disabled={!revisions.data.hasNext || revisions.isFetching}
              onClick={() => {
                setPage(page + 1);
                setSelectedRevision(undefined);
              }}
            >
              <ArrowRight size={16} />
            </ActionIconButton>
          </Stack>
          {detail.isFetching ? (
            <LoadingState label={t('common:labels.loading')} embedded />
          ) : detail.isError ? (
            <InlineFeedback
              severity="error"
              action={
                <ActionButton intent="quiet" size="small" onClick={() => void detail.refetch()}>
                  {t('actions.retry')}
                </ActionButton>
              }
            >
              {t('requests.draftLoadError')}
            </InlineFeedback>
          ) : (
            visible && (
              <Stack gap={1.25} sx={{ py: 1 }}>
                {typeof visible.draftSnapshot.title === 'string' && (
                  <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                    {visible.draftSnapshot.title || t('requests.autosave.untitled')}
                  </Typography>
                )}
                {typeof visible.draftSnapshot.summary === 'string' && (
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {visible.draftSnapshot.summary}
                  </Typography>
                )}
                <ApprovalPayloadData
                  payload={Object.fromEntries(
                    Object.entries(visible.payload).filter(([key]) => key !== 'summary')
                  )}
                  hideSystemFields
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ overflowWrap: 'anywhere' }}
                >
                  {visible.revision.payloadSha256}
                </Typography>
                {!visible.revision.recoverable ? (
                  <InlineFeedback severity="warning">{t('requests.drafts.legacy')}</InlineFeedback>
                ) : (
                  onRecover && (
                    <ActionButton
                      intent="secondary"
                      startIcon={<RotateCcw size={16} />}
                      onClick={() => onRecover(visible.revision.revision)}
                    >
                      {t('requests.drafts.recover')}
                    </ActionButton>
                  )
                )}
              </Stack>
            )
          )}
        </>
      )}
    </Box>
  );
}
