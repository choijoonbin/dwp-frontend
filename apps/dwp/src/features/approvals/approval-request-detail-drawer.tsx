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
    staleTime: 10_000,
  });

  return (
    <Drawer
      anchor="right"
      open={Boolean(requestId)}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 620 }, maxWidth: '100vw' } }}
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
            <Typography component="h2" variant="h5">
              {detail.data?.request.title ?? t('requests.detail.title')}
            </Typography>
            {detail.data && (
              <Stack gap={1.25} sx={{ mt: 1 }}>
                <Stack direction="row" gap={0.75} alignItems="center">
                  <StatusChip status={detail.data.request.status} />
                  <Typography variant="caption" color="text.secondary">
                    {detail.data.request.requestNumber}
                  </Typography>
                </Stack>
                {canUpdateRequests && detail.data.request.status === 'NEEDS_INFO' && (
                  <ActionButton
                    intent="primary"
                    size="small"
                    startIcon={<MessageSquareReply size={15} />}
                    onClick={() => onRespond(detail.data.request)}
                  >
                    {t('actions.respondInfo')}
                  </ActionButton>
                )}
                {canUpdateRequests &&
                  ['SUBMITTED', 'IN_REVIEW'].includes(detail.data.request.status) && (
                    <ActionButton
                      intent="secondary"
                      size="small"
                      startIcon={<Undo2 size={15} />}
                      onClick={() => onWithdraw(detail.data.request)}
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
        {detail.isLoading && (
          <LoadingState label={t('common:labels.loading')} size="page" embedded />
        )}
        {detail.isError && (
          <Alert severity="error" sx={{ m: 2 }}>
            {t('requests.detail.loadError')}
          </Alert>
        )}
        {detail.data && (
          <Stack gap={2} sx={{ p: 2.5 }}>
            <ApprovalSurface title={t('requests.detail.context')}>
              <Stack divider={<Divider flexItem />} sx={{ p: 2 }} gap={1.25}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('requests.fields.summary')}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.35 }}>
                    {detail.data.request.summary}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('requests.columns.workflow')}
                  </Typography>
                  <Typography variant="body2" fontWeight={720} sx={{ mt: 0.35 }}>
                    {i18n.resolvedLanguage?.startsWith('ko')
                      ? detail.data.request.workflowNameKo
                      : detail.data.request.workflowNameEn}
                  </Typography>
                </Box>
              </Stack>
            </ApprovalSurface>
            <ApprovalSurface title={t('requests.detail.payload')}>
              <ApprovalPayloadData
                payload={detail.data.payload}
                formSchema={detail.data.formSchema}
                hideSystemFields
                labelWidth="minmax(130px, .42fr)"
              />
            </ApprovalSurface>
            <ApprovalSurface
              title={t('requests.detail.timeline')}
              meta={t('requests.detail.timelineMeta', { count: detail.data.timeline.length })}
            >
              <Stack divider={<Divider flexItem />} sx={{ p: 2 }}>
                {detail.data.timeline.map((event) => (
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
