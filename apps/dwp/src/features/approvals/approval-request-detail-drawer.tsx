import { useTranslation } from 'react-i18next';
import { MessageSquareReply, Undo2, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, ActionIconButton, LoadingState } from '@dwp-frontend/design-system';
import { formatDate, useDisplayDictionary } from '@dwp-frontend/shared-i18n';
import { getApprovalRequestDetail } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalPayloadData } from './approval-payload-data';
import {
  approvalTimelineEventContext,
  approvalTimelineEventDetail,
} from './approval-timeline-copy';
import { ApprovalSurface, StatusChip } from './approval-ui';

import type { ApprovalRequest } from '@dwp-frontend/shared-utils';

type ApprovalRequestDetailDrawerProps = {
  requestId?: string;
  canUpdateRequests: boolean;
  onClose: () => void;
  onRespond: (request: ApprovalRequest) => void;
  onWithdraw: (request: ApprovalRequest) => void;
};

export function ApprovalRequestDetailDrawer({
  requestId,
  canUpdateRequests,
  onClose,
  onRespond,
  onWithdraw,
}: ApprovalRequestDetailDrawerProps) {
  const { t, i18n } = useTranslation('approvals');
  const display = useDisplayDictionary();
  const detail = useQuery({
    queryKey: ['approvals', 'requests', 'detail-view', requestId],
    queryFn: () => getApprovalRequestDetail(requestId!),
    enabled: Boolean(requestId),
    staleTime: 0,
    retry: 1,
  });
  const visibleDetail = detail.isError || detail.isFetching ? undefined : detail.data;

  return (
    <Drawer
      anchor="right"
      open={Boolean(requestId)}
      onClose={onClose}
      PaperProps={{
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'approval-request-detail-title',
        sx: { width: { xs: '100%', sm: 620 }, maxWidth: '100vw' },
      }}
    >
      <Box sx={{ minHeight: '100%', bgcolor: '#FAFBFD' }}>
        <Stack
          direction="row"
          alignItems="flex-start"
          justifyContent="space-between"
          gap={2}
          sx={{ p: 2.5, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}
        >
          <Box minWidth={0}>
            <Typography variant="overline" color="primary.main">
              {t('requests.detail.eyebrow')}
            </Typography>
            <Typography id="approval-request-detail-title" component="h2" variant="h5">
              {visibleDetail?.request.title ?? t('requests.detail.title')}
            </Typography>
            {visibleDetail && (
              <Stack gap={1.25} sx={{ mt: 1 }}>
                <Stack direction="row" gap={0.75} alignItems="center">
                  <StatusChip status={visibleDetail.request.status} />
                  <Typography variant="caption" color="text.secondary">
                    {visibleDetail.request.requestNumber}
                  </Typography>
                </Stack>
                {canUpdateRequests && visibleDetail.request.status === 'NEEDS_INFO' && (
                  <ActionButton
                    intent="primary"
                    size="small"
                    startIcon={<MessageSquareReply size={15} />}
                    onClick={() => onRespond(visibleDetail.request)}
                  >
                    {t('actions.respondInfo')}
                  </ActionButton>
                )}
                {canUpdateRequests &&
                  ['SUBMITTED', 'IN_REVIEW'].includes(visibleDetail.request.status) && (
                    <ActionButton
                      intent="secondary"
                      size="small"
                      startIcon={<Undo2 size={15} />}
                      onClick={() => onWithdraw(visibleDetail.request)}
                    >
                      {t('actions.withdraw')}
                    </ActionButton>
                  )}
              </Stack>
            )}
          </Box>
          <ActionIconButton
            label={t('actions.close')}
            tooltip={t('actions.close')}
            onClick={onClose}
          >
            <X size={19} />
          </ActionIconButton>
        </Stack>
        {Boolean(requestId) && detail.isFetching && (
          <LoadingState label={t('common:labels.loading')} size="page" embedded />
        )}
        {detail.isError && (
          <Alert
            severity="error"
            sx={{ m: 2 }}
            action={
              <ActionButton
                type="button"
                intent="quiet"
                size="small"
                disabled={detail.isFetching}
                onClick={() => void detail.refetch()}
              >
                {t('actions.retry')}
              </ActionButton>
            }
          >
            {t('requests.detail.loadError')}
          </Alert>
        )}
        {visibleDetail && (
          <Stack gap={2} sx={{ p: 2.5 }}>
            <ApprovalSurface title={t('requests.detail.context')}>
              <Stack divider={<Divider flexItem />} sx={{ p: 2 }} gap={1.25}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('requests.fields.summary')}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.35 }}>
                    {visibleDetail.request.summary}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('requests.columns.workflow')}
                  </Typography>
                  <Typography variant="body2" fontWeight={720} sx={{ mt: 0.35 }}>
                    {i18n.resolvedLanguage?.startsWith('ko')
                      ? visibleDetail.request.workflowNameKo
                      : visibleDetail.request.workflowNameEn}
                  </Typography>
                </Box>
              </Stack>
            </ApprovalSurface>
            <ApprovalSurface title={t('requests.detail.payload')}>
              <ApprovalPayloadData
                payload={visibleDetail.payload}
                formSchema={visibleDetail.formSchema}
                hideSystemFields
                labelWidth="minmax(130px, .42fr)"
              />
            </ApprovalSurface>
            <ApprovalSurface
              title={t('requests.detail.timeline')}
              meta={t('requests.detail.timelineMeta', { count: visibleDetail.timeline.length })}
            >
              <Stack divider={<Divider flexItem />} sx={{ p: 2 }}>
                {visibleDetail.timeline.map((event) => (
                  <Box key={event.eventId} sx={{ py: 1 }}>
                    <Typography variant="body2" fontWeight={720}>
                      {t(`events.${event.eventType}`, {
                        defaultValue: display('auditActions', event.eventType),
                      })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {approvalTimelineEventContext(t, event)} ·{' '}
                      {approvalTimelineEventDetail(t, event)} ·{' '}
                      {formatDate(event.occurredAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            </ApprovalSurface>
          </Stack>
        )}
      </Box>
    </Drawer>
  );
}
