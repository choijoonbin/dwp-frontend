import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  MessageSquarePlus,
  Printer,
  RefreshCw,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  InlineFeedback,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalSurface } from './approval-ui';
import { useApprovalRequestDocuments } from './use-approval-request-documents';
import { downloadApprovalDocumentArtifact } from './approval-document-delivery';
import { ApprovalDocumentPrintPreview } from './approval-document-print-preview';

import type { ApprovalRequestDetail } from '@dwp-frontend/shared-utils';
import { HttpError } from '@dwp-frontend/shared-utils';

export function ApprovalRequestDocumentTools({
  requestId,
  detail,
  onRefreshDetail,
  onBlockedChange,
  onAccessDenied,
  onAccessRestored,
  isOwnerCurrent,
  ownerError,
}: {
  requestId: string;
  detail?: ApprovalRequestDetail;
  onRefreshDetail: () => Promise<ApprovalRequestDetail | undefined>;
  onBlockedChange: (blocked: boolean, isBlocked: () => boolean) => void;
  onAccessDenied: () => void;
  onAccessRestored: () => void;
  isOwnerCurrent: () => boolean;
  ownerError?: unknown;
}) {
  const { t } = useTranslation('approvals');
  const documents = useApprovalRequestDocuments(requestId, detail, isOwnerCurrent, ownerError);
  const [intent, setIntent] = useState<'PRINT' | 'DOWNLOAD'>();
  const [reason, setReason] = useState('');
  const [delivering, setDelivering] = useState(false);
  const [deliveryError, setDeliveryError] = useState(false);
  const deliveryFlight = useRef(false);
  const blocked = documents.pending || documents.unknown || delivering;
  const notify = useRef(onBlockedChange);
  notify.current = onBlockedChange;
  const documentGuard = useRef(documents.isBlocked);
  documentGuard.current = documents.isBlocked;
  useEffect(() => {
    notify.current(blocked, () => documentGuard.current() || deliveryFlight.current);
    return () => notify.current(false, () => false);
  }, [blocked]);
  useEffect(() => {
    setIntent(undefined);
    setReason('');
    setDeliveryError(false);
  }, [requestId]);
  useEffect(() => {
    if (documents.artifact) setIntent(undefined);
  }, [documents.artifact]);
  const refresh = async () => {
    const refreshedDetail = await onRefreshDetail();
    if (await documents.refresh(refreshedDetail)) onAccessRestored();
  };
  const sourceError =
    Boolean(ownerError) ||
    documents.tools.isError ||
    documents.comments.isError ||
    Boolean(documents.verificationError);
  const deniedCallback = useRef(onAccessDenied);
  deniedCallback.current = onAccessDenied;
  const errors = [
    ownerError,
    documents.verificationError,
    documents.tools.error,
    documents.comments.error,
  ];
  const denied = errors.some(
    (error) => error instanceof HttpError && [401, 403, 404].includes(error.status)
  );
  const errorSource = errors.find(
    (error) => error instanceof HttpError && [401, 403, 404].includes(error.status)
  );
  useEffect(() => {
    if (errorSource instanceof HttpError && [401, 403, 404].includes(errorSource.status))
      deniedCallback.current();
  }, [errorSource]);
  const comments = documents.sourceReady ? documents.comments.data : undefined;
  const download = async () => {
    if (!documents.artifact || deliveryFlight.current) return;
    deliveryFlight.current = true;
    setDelivering(true);
    setDeliveryError(false);
    try {
      await downloadApprovalDocumentArtifact(
        documents.artifact.document,
        documents.verifyArtifact,
        documents.artifactCurrent
      );
      documents.clearArtifact();
    } catch {
      setDeliveryError(true);
    } finally {
      deliveryFlight.current = false;
      setDelivering(false);
    }
  };
  return (
    <ApprovalSurface
      title={t('requests.documents.title')}
      action={
        <ActionIconButton
          label={t('actions.refresh')}
          tooltip={t('actions.refresh')}
          disabled={documents.pending || delivering}
          onClick={() => void refresh()}
        >
          <RefreshCw size={17} />
        </ActionIconButton>
      }
    >
      <Stack gap={2} sx={{ p: 2 }}>
        <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
          <ActionButton
            intent="secondary"
            size="small"
            startIcon={<Printer size={16} />}
            disabled={!documents.printAllowed || blocked}
            onClick={() => {
              setIntent('PRINT');
              setReason('');
            }}
          >
            {t('requests.documents.print')}
          </ActionButton>
          <ActionButton
            intent="secondary"
            size="small"
            startIcon={<Download size={16} />}
            disabled={!documents.downloadAllowed || blocked}
            onClick={() => {
              setIntent('DOWNLOAD');
              setReason('');
            }}
          >
            {t('requests.documents.download')}
          </ActionButton>
        </Stack>
        {(sourceError || documents.recovery) && (
          <InlineFeedback
            severity={documents.recovery === 'CONFLICT' ? 'warning' : 'error'}
            action={
              <Stack direction="row" gap={1} useFlexGap flexWrap="wrap">
                <ActionButton
                  intent="quiet"
                  size="small"
                  disabled={documents.pending || delivering}
                  onClick={() => void refresh()}
                >
                  {t('actions.refresh')}
                </ActionButton>
                {documents.unknown && (
                  <ActionButton
                    intent="secondary"
                    size="small"
                    disabled={!documents.retryAllowed || documents.pending || delivering}
                    onClick={documents.retryOriginal}
                  >
                    {t('requests.documents.retryOriginal')}
                  </ActionButton>
                )}
              </Stack>
            }
          >
            {t(
              documents.unknown
                ? 'requests.documents.unknown'
                : documents.recovery === 'CONFLICT'
                  ? 'requests.documents.conflict'
                  : 'requests.documents.sourceError'
            )}
          </InlineFeedback>
        )}
        {!sourceError &&
          !documents.pending &&
          documents.visibleTools &&
          !documents.printAllowed &&
          !documents.downloadAllowed &&
          !documents.commentAllowed && (
            <Typography variant="caption" color="text.secondary">
              {t('requests.documents.policyBlocked')}
            </Typography>
          )}
        <Divider />
        <Typography component="h3" variant="subtitle2">
          {t('requests.documents.comments')}
        </Typography>
        {(documents.tools.isFetching || documents.comments.isFetching) && (
          <LoadingState label={t('common:labels.loading')} embedded size="compact" />
        )}
        {comments &&
          (comments.items.length ? (
            <Stack divider={<Divider flexItem />}>
              {comments.items.map((comment) => (
                <Box key={comment.commentId} sx={{ py: 1 }}>
                  <Stack direction="row" gap={1} useFlexGap flexWrap="wrap" sx={{ mb: 0.5 }}>
                    <Typography variant="caption" fontWeight="fontWeightBold">
                      {t('requests.documents.author', { id: comment.authorUserId })}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(comment.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
                    </Typography>
                  </Stack>
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                  >
                    {comment.text}
                  </Typography>
                </Box>
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              {t('requests.documents.emptyComments')}
            </Typography>
          ))}
        {comments && comments.totalElements > comments.size && (
          <Stack direction="row" gap={1} alignItems="center">
            <ActionIconButton
              label={t('common:actions.previous')}
              tooltip={t('common:actions.previous')}
              disabled={blocked || documents.page === 0}
              onClick={() => documents.setPage(documents.page - 1)}
            >
              <ArrowLeft size={16} />
            </ActionIconButton>
            <Typography variant="caption">
              {t('requests.drafts.page', {
                page: documents.page + 1,
                total: Math.ceil(comments.totalElements / comments.size),
              })}
            </Typography>
            <ActionIconButton
              label={t('common:actions.next')}
              tooltip={t('common:actions.next')}
              disabled={blocked || (documents.page + 1) * comments.size >= comments.totalElements}
              onClick={() => documents.setPage(documents.page + 1)}
            >
              <ArrowRight size={16} />
            </ActionIconButton>
          </Stack>
        )}
        <FormField
          multiline
          minRows={3}
          label={t('requests.documents.commentText')}
          value={denied ? '' : documents.text}
          disabled={!documents.commentAllowed || blocked}
          inputProps={{ maxLength: 2000 }}
          onChange={(event) => documents.setText(event.target.value)}
        />
        <ActionButton
          intent="primary"
          startIcon={<MessageSquarePlus size={16} />}
          disabled={!documents.commentAllowed || blocked || !documents.text.trim()}
          loading={documents.pending}
          onClick={documents.addComment}
        >
          {t('requests.documents.addComment')}
        </ActionButton>
        {documents.artifact?.document.format === 'JSON' && (
          <InlineFeedback
            severity="success"
            action={
              <ActionButton
                intent="secondary"
                size="small"
                startIcon={<Download size={16} />}
                disabled={delivering}
                loading={delivering}
                onClick={() => void download()}
              >
                {t('requests.documents.download')}
              </ActionButton>
            }
          >
            {t('requests.documents.generated')}
          </InlineFeedback>
        )}
        {deliveryError && (
          <InlineFeedback severity="error">{t('requests.documents.expired')}</InlineFeedback>
        )}
      </Stack>
      <FormDialog
        open={Boolean(intent)}
        title={t('requests.documents.exportTitle')}
        description={t('requests.documents.exportDescription')}
        cancelLabel={t('actions.cancel')}
        submitLabel={t(
          intent === 'PRINT' ? 'requests.documents.print' : 'requests.documents.download'
        )}
        busy={documents.pending}
        mobileFullScreen
        submitDisabled={
          documents.unknown ||
          reason.trim().length < 4 ||
          !(intent === 'PRINT' ? documents.printAllowed : documents.downloadAllowed)
        }
        onClose={() => {
          if (!documents.isBlocked()) setIntent(undefined);
        }}
        onSubmit={() => {
          if (intent) documents.exportDocument(intent, reason);
        }}
      >
        <Stack gap={2}>
          {documents.recovery && (
            <InlineFeedback severity="warning">
              {t(documents.unknown ? 'requests.documents.unknown' : 'requests.documents.conflict')}
            </InlineFeedback>
          )}
          <FormField
            required
            multiline
            minRows={3}
            label={t('requests.documents.exportReason')}
            value={reason}
            disabled={documents.pending || documents.unknown}
            inputProps={{ maxLength: 1000 }}
            onChange={(event) => {
              if (!documents.isBlocked()) setReason(event.target.value);
            }}
          />
          {documents.recovery && (
            <ActionButton
              intent="quiet"
              disabled={documents.pending}
              onClick={() => void refresh()}
            >
              {t('actions.refresh')}
            </ActionButton>
          )}
          {documents.unknown && (
            <ActionButton
              intent="secondary"
              disabled={!documents.retryAllowed || documents.pending}
              onClick={documents.retryOriginal}
            >
              {t('requests.documents.retryOriginal')}
            </ActionButton>
          )}
        </Stack>
      </FormDialog>
      <ApprovalDocumentPrintPreview
        document={
          documents.artifact?.document.format === 'HTML' ? documents.artifact.document : null
        }
        onVerify={documents.verifyArtifact}
        isCurrent={documents.artifactCurrent}
        onClose={documents.clearArtifact}
      />
    </ApprovalSurface>
  );
}
