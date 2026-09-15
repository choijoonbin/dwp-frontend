import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CopyPlus, MessageSquareReply, Undo2, X } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ActionButton,
  ActionIconButton,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import {
  formatDate,
  resolveSupportedLocale,
  useDisplayDictionary,
} from '@dwp-frontend/shared-i18n';
import { getApprovalRequestDetail } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalPayloadData } from './approval-payload-data';
import { ApprovalRequestDocumentTools } from './approval-request-document-tools';
import { ApprovalSignaturePanel } from './approval-signature-panel';
import { ApprovalAttachmentPanel } from './approval-attachment-panel';
import type { ApprovalAttachmentClient } from './use-approval-attachment-client';
import {
  approvalTimelineEventContext,
  approvalTimelineEventDetail,
} from './approval-timeline-copy';
import { ApprovalSurface, StatusChip } from './approval-ui';
import { canCreateResubmissionDraft } from './use-approval-resubmit-draft';
import { useProductSurfaceRequestScope } from '../../components/use-product-surface-request-scope';

import type { ApprovalRequest, ApprovalRequestDetail } from '@dwp-frontend/shared-utils';

type ApprovalRequestDetailDrawerProps = {
  requestId?: string;
  canUpdateRequests: boolean;
  onClose: () => void;
  onReturnToWork?: () => void;
  onRespond: (request: ApprovalRequest) => void;
  onWithdraw: (request: ApprovalRequest) => void;
  onResubmit?: (request: ApprovalRequest) => void;
  resubmitPending?: boolean;
  attachments: ApprovalAttachmentClient;
};

export function ApprovalRequestDetailDrawer({
  requestId,
  canUpdateRequests,
  onClose,
  onReturnToWork,
  onRespond,
  onWithdraw,
  onResubmit,
  resubmitPending,
  attachments,
}: ApprovalRequestDetailDrawerProps) {
  const { t, i18n } = useTranslation('approvals');
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
  const display = useDisplayDictionary();
  const queryClient = useQueryClient();
  const [documentBlocked, setDocumentBlocked] = useState(false);
  const documentBlockedRef = useRef(false);
  const liveCloseGuard = useRef<() => boolean>(() => false);
  const signatureBlockedRef = useRef(false);
  const signatureCloseGuard = useRef<() => boolean>(() => false);
  const [deniedGeneration, setDeniedGeneration] = useState<string>();
  const close = () => {
    if (
      !documentBlockedRef.current &&
      !liveCloseGuard.current() &&
      !signatureBlockedRef.current &&
      !signatureCloseGuard.current()
    )
      onClose();
  };
  const requestScope = useProductSurfaceRequestScope({
    productKey: 'approvals',
    surfaceKey: 'approvals.work',
  });
  const detailKey = ['approvals', ...requestScope.cacheKey, 'requests', 'detail-view', requestId];
  const detail = useQuery({
    queryKey: detailKey,
    queryFn: ({ signal }) =>
      getApprovalRequestDetail(requestId!, requestScope.contextScopeKey, signal),
    enabled: requestScope.ready && Boolean(requestId),
    meta: requestScope.queryMeta,
    staleTime: 0,
    retry: false,
  });
  const generation = JSON.stringify([requestScope.cacheKey, requestId]);
  const generationRef = useRef(generation);
  generationRef.current = generation;
  const visibleDetail =
    !requestScope.ready || detail.isError || detail.isFetching || deniedGeneration === generation
      ? undefined
      : detail.data;

  return (
    <Drawer
      anchor="right"
      open={Boolean(requestId)}
      onClose={close}
      PaperProps={{
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'approval-request-detail-title',
        sx: { width: { xs: '100%', sm: 620 }, maxWidth: '100vw' },
      }}
    >
      <Box sx={{ minHeight: '100%', bgcolor: 'background.default' }}>
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
                {onReturnToWork && (
                  <ActionButton
                    intent="quiet"
                    size="small"
                    startIcon={<ArrowLeft size={15} />}
                    disabled={documentBlocked}
                    onClick={onReturnToWork}
                  >
                    {t('common:productSurface.actions.returnToWork')}
                  </ActionButton>
                )}
                {canUpdateRequests && visibleDetail.request.status === 'NEEDS_INFO' && (
                  <ActionButton
                    intent="primary"
                    size="small"
                    startIcon={<MessageSquareReply size={15} />}
                    disabled={documentBlocked}
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
                      disabled={documentBlocked}
                      onClick={() => onWithdraw(visibleDetail.request)}
                    >
                      {t('actions.withdraw')}
                    </ActionButton>
                  )}
                {canUpdateRequests &&
                  onResubmit &&
                  canCreateResubmissionDraft(visibleDetail.request) && (
                    <ActionButton
                      intent="primary"
                      size="small"
                      startIcon={<CopyPlus size={15} />}
                      disabled={documentBlocked || resubmitPending}
                      onClick={() => onResubmit(visibleDetail.request)}
                    >
                      {t('requests.resubmit.action')}
                    </ActionButton>
                  )}
              </Stack>
            )}
          </Box>
          <ActionIconButton
            label={t('actions.close')}
            tooltip={t('actions.close')}
            disabled={documentBlocked}
            onClick={close}
          >
            <X size={19} />
          </ActionIconButton>
        </Stack>
        {Boolean(requestId) && (!requestScope.ready || detail.isFetching) && (
          <LoadingState label={t('common:labels.loading')} size="page" embedded />
        )}
        {detail.isError && (
          <InlineFeedback
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
          </InlineFeedback>
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
                    {korean
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
        {requestId && (
          <Box sx={{ px: 2.5, pb: 2.5 }}>
            <ApprovalAttachmentPanel client={attachments} />
            <ApprovalRequestDocumentTools
              key={JSON.stringify([requestScope.cacheKey, requestId])}
              requestId={requestId}
              detail={visibleDetail}
              ownerError={detail.error}
              isOwnerCurrent={() => {
                const state = queryClient.getQueryState<ApprovalRequestDetail>(detailKey);
                return Boolean(
                  requestScope.ready &&
                  generationRef.current === generation &&
                  state?.status === 'success' &&
                  state.fetchStatus === 'idle' &&
                  !state.error &&
                  state.data?.request.requestId === requestId &&
                  state.data.request.version === detail.data?.request.version
                );
              }}
              onRefreshDetail={async () => {
                const result = await detail.refetch();
                return result.isSuccess && generationRef.current === generation
                  ? result.data
                  : undefined;
              }}
              onAccessDenied={() => {
                if (generationRef.current === generation) setDeniedGeneration(generation);
              }}
              onAccessRestored={() => {
                if (generationRef.current === generation) setDeniedGeneration(undefined);
              }}
              onBlockedChange={(blocked, isBlocked) => {
                documentBlockedRef.current = blocked;
                liveCloseGuard.current = isBlocked;
                setDocumentBlocked(blocked || signatureBlockedRef.current);
              }}
            />
            {detail.data?.request.status === 'APPROVED' && (
              <ApprovalSignaturePanel
                key={JSON.stringify([requestScope.cacheKey, requestId, 'signature'])}
                requestId={requestId}
                requestVersion={visibleDetail?.request.version}
                ownerError={detail.error}
                approved={visibleDetail?.request.status === 'APPROVED'}
                isOwnerCurrent={() => {
                  const state = queryClient.getQueryState<ApprovalRequestDetail>(detailKey);
                  return Boolean(
                    requestScope.ready &&
                    generationRef.current === generation &&
                    deniedGeneration !== generation &&
                    state?.status === 'success' &&
                    state.fetchStatus === 'idle' &&
                    !state.error &&
                    state.data?.request.requestId === requestId &&
                    state.data.request.status === 'APPROVED' &&
                    state.data.request.version === detail.data?.request.version
                  );
                }}
                onBlockedChange={(blocked, isBlocked) => {
                  signatureBlockedRef.current = blocked;
                  signatureCloseGuard.current = isBlocked;
                  setDocumentBlocked(blocked || documentBlockedRef.current);
                }}
              />
            )}
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
