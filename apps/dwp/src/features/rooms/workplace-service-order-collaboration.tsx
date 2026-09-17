import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, MessageSquare, Paperclip } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  addWorkplaceServiceOrderMessage,
  createWorkplaceIdempotencyKey,
  downloadWorkplaceServiceOrderAttachment,
  getWorkplaceServiceAttachmentScanStatus,
  recordWorkplaceServiceAttachmentScan,
  resolveIdempotentMutationIntent,
  uploadWorkplaceServiceOrderAttachment,
} from '@dwp-frontend/shared-utils';
import { ActionButton, FormField, InlineFeedback, SelectField } from '@dwp-frontend/design-system';
import { formatDate, formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { WorkplaceServiceContact } from './workplace-service-contact';
import {
  useWorkplaceServiceOrderAttachmentPages,
  useWorkplaceServiceOrderMessagePages,
} from './workplace-service-order-pages';
import { requireWorkplaceServiceWrite } from './workplace-services-ui-model';

import type {
  IdempotentMutationIntent,
  WorkplaceServiceAttachmentScanVerdict,
  WorkplaceServiceOrder,
  WorkplaceServiceOrderAttachment,
} from '@dwp-frontend/shared-utils';

type Props = Readonly<{
  order: WorkplaceServiceOrder;
  administrator?: boolean;
  canWrite: boolean;
  elevated?: boolean;
}>;

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.click();
  URL.revokeObjectURL(url);
}

function AttachmentRow({
  item,
  order,
  administrator,
  canWrite,
  elevated,
}: {
  item: WorkplaceServiceOrderAttachment;
  order: WorkplaceServiceOrder;
  administrator: boolean;
  canWrite: boolean;
  elevated: boolean;
}) {
  const { t, i18n } = useTranslation('rooms');
  const queryClient = useQueryClient();
  const [verdict, setVerdict] = useState<WorkplaceServiceAttachmentScanVerdict>('CLEAN');
  const [evidence, setEvidence] = useState('');
  const [detail, setDetail] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const scanIntent = useRef<IdempotentMutationIntent | null>(null);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const downloadMutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(item.scanState === 'CLEAN' && (!administrator || elevated));
      return downloadWorkplaceServiceOrderAttachment(
        order.serviceOrderId,
        item,
        administrator,
        administrator ? 'ELEVATED' : undefined
      ).then((blob) => saveBlob(blob, item.fileName));
    },
  });
  const statusMutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(administrator && elevated);
      return getWorkplaceServiceAttachmentScanStatus(
        order.serviceOrderId,
        item.attachmentId,
        'ELEVATED'
      );
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['workplace', 'services'] }),
  });
  const scanMutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(
        administrator &&
          canWrite &&
          elevated &&
          confirmed &&
          Boolean(evidence.trim() && reason.trim()) &&
          evidence.trim().length <= 320 &&
          detail.trim().length <= 1000 &&
          reason.trim().length <= 500
      );
      const input = {
        expectedVersion: item.scanVersion,
        verdict,
        scannerEvidenceReference: evidence.trim(),
        detail: detail.trim() || null,
        explicitConfirmation: true as const,
        reason: reason.trim(),
      };
      const intent = resolveIdempotentMutationIntent(scanIntent.current, input, () =>
        createWorkplaceIdempotencyKey('service-attachment-scan')
      );
      scanIntent.current = intent;
      return recordWorkplaceServiceAttachmentScan(order.serviceOrderId, item.attachmentId, input, {
        idempotencyKey: intent.key,
        activeAccessMode: 'ELEVATED',
      });
    },
    retry: false,
    onSuccess: () => {
      scanIntent.current = null;
      setEvidence('');
      setDetail('');
      setReason('');
      setConfirmed(false);
      void queryClient.invalidateQueries({ queryKey: ['workplace', 'services'] });
    },
    onError: () => void statusMutation.mutate(),
  });
  return (
    <Stack
      component="li"
      gap={1}
      sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.25, listStyle: 'none' })}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1}
      >
        <Box minWidth={0}>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {item.fileName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {item.contentType} · {formatNumber(item.byteSize, undefined, locale)} B
          </Typography>
        </Box>
        <Stack direction="row" gap={0.75} flexWrap="wrap">
          <Chip
            size="small"
            color={item.scanState === 'CLEAN' ? 'success' : 'warning'}
            label={t(`workplace.services.attachmentScanStates.${item.scanState}`)}
          />
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<Download size={15} />}
            loading={downloadMutation.isPending}
            disabled={item.scanState !== 'CLEAN' || (administrator && !elevated)}
            onClick={() => downloadMutation.mutate()}
          >
            {t('workplace.services.downloadAttachment')}
          </ActionButton>
        </Stack>
      </Stack>
      {item.scanState !== 'CLEAN' ? (
        <InlineFeedback severity="warning">
          {t('workplace.services.attachmentDownloadBlocked')}
        </InlineFeedback>
      ) : null}
      {downloadMutation.isError ? (
        <InlineFeedback severity="error">{t('workplace.services.downloadError')}</InlineFeedback>
      ) : null}
      {administrator && canWrite ? (
        <Stack component="details" spacing={1}>
          <Typography component="summary" variant="body2" sx={{ minHeight: 44, py: 1 }}>
            {t('workplace.services.attachmentScanReview')}
          </Typography>
          {item.scannerEvidenceReference ? (
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {t('workplace.services.attachmentEvidence', {
                evidence: item.scannerEvidenceReference,
              })}
            </Typography>
          ) : null}
          <SelectField
            label={t('workplace.services.attachmentVerdict')}
            value={verdict}
            onValueChange={(value) => setVerdict(value as WorkplaceServiceAttachmentScanVerdict)}
            options={(['CLEAN', 'INFECTED', 'ERROR'] as const).map((value) => ({
              value,
              label: t(`workplace.services.attachmentScanVerdicts.${value}`),
            }))}
            disabled={!elevated || scanMutation.isPending}
          />
          <FormField
            label={t('workplace.services.attachmentEvidenceReference')}
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            disabled={!elevated || scanMutation.isPending}
            inputProps={{ maxLength: 320 }}
          />
          <FormField
            multiline
            minRows={2}
            label={t('workplace.services.attachmentScanDetail')}
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            disabled={!elevated || scanMutation.isPending}
            inputProps={{ maxLength: 1000 }}
          />
          <FormField
            label={t('workplace.services.attachmentScanReason')}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={!elevated || scanMutation.isPending}
            inputProps={{ maxLength: 500 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
                disabled={!elevated || scanMutation.isPending}
              />
            }
            label={t('workplace.services.attachmentScanConfirmation')}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
            <ActionButton
              intent="quiet"
              loading={statusMutation.isPending}
              disabled={!elevated}
              onClick={() => statusMutation.mutate()}
            >
              {t('workplace.services.attachmentRefreshStatus')}
            </ActionButton>
            <ActionButton
              intent="primary"
              loading={scanMutation.isPending}
              disabled={
                !elevated ||
                !evidence.trim() ||
                evidence.trim().length > 320 ||
                detail.trim().length > 1000 ||
                !reason.trim() ||
                reason.trim().length > 500 ||
                !confirmed
              }
              onClick={() => scanMutation.mutate()}
            >
              {t('workplace.services.attachmentRecordVerdict')}
            </ActionButton>
          </Stack>
          {scanMutation.isError || statusMutation.isError ? (
            <InlineFeedback severity="error">
              {t('workplace.services.attachmentScanError')}
            </InlineFeedback>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );
}

export function WorkplaceServiceOrderCollaboration({
  order,
  administrator = false,
  canWrite,
  elevated = false,
}: Props) {
  const { t, i18n } = useTranslation('rooms');
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [messageReason, setMessageReason] = useState('');
  const [messageConfirmed, setMessageConfirmed] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentReason, setAttachmentReason] = useState('');
  const [attachmentConfirmed, setAttachmentConfirmed] = useState(false);
  const messageIntent = useRef<IdempotentMutationIntent | null>(null);
  const attachmentIntent = useRef<IdempotentMutationIntent | null>(null);
  const locale = resolveSupportedLocale(i18n.resolvedLanguage);
  const writable = canWrite && (!administrator || elevated);
  const messagesQuery = useWorkplaceServiceOrderMessagePages(order.serviceOrderId, administrator);
  const attachmentsQuery = useWorkplaceServiceOrderAttachmentPages(
    order.serviceOrderId,
    administrator
  );
  const messages = messagesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const attachments = attachmentsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const commandOptions = (idempotencyKey: string) => ({
    idempotencyKey,
    ...(administrator ? { activeAccessMode: 'ELEVATED' as const } : {}),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['workplace', 'services'] });
  const messageMutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(
        writable &&
          messageConfirmed &&
          Boolean(message.trim() && messageReason.trim()) &&
          message.length <= 2000 &&
          messageReason.trim().length <= 500
      );
      const input = {
        expectedVersion: order.version,
        message: message.trim(),
        reason: messageReason.trim(),
        explicitConfirmation: true as const,
      };
      const intent = resolveIdempotentMutationIntent(messageIntent.current, input, () =>
        createWorkplaceIdempotencyKey('service-order-message')
      );
      messageIntent.current = intent;
      return addWorkplaceServiceOrderMessage(
        order.serviceOrderId,
        input,
        commandOptions(intent.key),
        administrator
      );
    },
    retry: false,
    onSuccess: () => {
      messageIntent.current = null;
      setMessage('');
      setMessageReason('');
      setMessageConfirmed(false);
      void refresh();
    },
    onError: () => void refresh(),
  });
  const attachmentMutation = useMutation({
    mutationFn: () => {
      requireWorkplaceServiceWrite(
        writable &&
          attachmentConfirmed &&
          Boolean(attachment && attachmentReason.trim()) &&
          attachmentReason.trim().length <= 500
      );
      const payload = {
        expectedVersion: order.version,
        reason: attachmentReason.trim(),
        fileName: attachment!.name,
        contentType: attachment!.type,
        byteSize: attachment!.size,
        lastModified: attachment!.lastModified,
      };
      const intent = resolveIdempotentMutationIntent(attachmentIntent.current, payload, () =>
        createWorkplaceIdempotencyKey('service-order-attachment')
      );
      attachmentIntent.current = intent;
      return uploadWorkplaceServiceOrderAttachment(
        order.serviceOrderId,
        attachment!,
        order.version,
        attachmentReason.trim(),
        commandOptions(intent.key),
        administrator
      );
    },
    retry: false,
    onSuccess: () => {
      attachmentIntent.current = null;
      setAttachment(null);
      setAttachmentReason('');
      setAttachmentConfirmed(false);
      void refresh();
    },
    onError: () => void refresh(),
  });
  const resetMessageMutation = messageMutation.reset;
  const resetAttachmentMutation = attachmentMutation.reset;
  useEffect(() => {
    setMessage('');
    setMessageReason('');
    setMessageConfirmed(false);
    setAttachment(null);
    setAttachmentReason('');
    setAttachmentConfirmed(false);
    messageIntent.current = null;
    attachmentIntent.current = null;
    resetMessageMutation();
    resetAttachmentMutation();
  }, [order.serviceOrderId, resetAttachmentMutation, resetMessageMutation]);

  return (
    <Stack
      id="workplace-service-collaboration"
      spacing={2}
      data-testid="workplace-service-order-collaboration"
    >
      <Stack direction="row" gap={0.75} alignItems="center">
        <MessageSquare size={17} aria-hidden="true" />
        <Typography component="h3" variant="subtitle2" fontWeight="fontWeightBold">
          {t('workplace.services.collaborationTitle')}
        </Typography>
      </Stack>
      {!administrator ? <WorkplaceServiceContact order={order} canWrite={canWrite} /> : null}
      <Box>
        <Typography component="h4" variant="subtitle2">
          {t('workplace.services.messagesTitle')}
        </Typography>
        {messagesQuery.isError ? (
          <InlineFeedback severity="error">{t('workplace.services.historyError')}</InlineFeedback>
        ) : messages.length ? (
          <Stack component="ol" spacing={0.75} sx={{ p: 0, m: 0, mt: 1 }}>
            {messages.map((item) => (
              <Box
                component="li"
                key={item.messageId}
                sx={(theme) => ({
                  ...workplaceMemberSoftSurface(theme),
                  p: 1.25,
                  listStyle: 'none',
                })}
              >
                <Typography variant="body2">{item.message}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('workplace.services.messageMeta', {
                    author:
                      item.authorDisplayName ??
                      t(`workplace.services.authorRoles.${item.authorRole}`),
                    createdAt: formatDate(
                      item.createdAt,
                      { dateStyle: 'medium', timeStyle: 'short' },
                      locale
                    ),
                  })}
                </Typography>
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {t('workplace.services.messagesEmpty')}
          </Typography>
        )}
        {messagesQuery.hasNextPage ? (
          <ActionButton
            intent="quiet"
            size="small"
            loading={messagesQuery.isFetchingNextPage}
            onClick={() => void messagesQuery.fetchNextPage()}
          >
            {t('workplace.services.loadMore')}
          </ActionButton>
        ) : null}
      </Box>
      {canWrite && (
        <Stack spacing={1}>
          <FormField
            multiline
            minRows={2}
            label={t('workplace.services.messageLabel')}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={!writable || messageMutation.isPending}
            inputProps={{ maxLength: 2000 }}
          />
          <FormField
            label={t('workplace.services.messageReason')}
            value={messageReason}
            onChange={(event) => setMessageReason(event.target.value)}
            disabled={!writable || messageMutation.isPending}
            inputProps={{ maxLength: 500 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={messageConfirmed}
                onChange={(event) => setMessageConfirmed(event.target.checked)}
                disabled={!writable || messageMutation.isPending}
              />
            }
            label={t('workplace.services.messageConfirmation')}
          />
          {messageMutation.isError && (
            <InlineFeedback severity="error">
              {t('workplace.services.collaborationError')}
            </InlineFeedback>
          )}
          <ActionButton
            intent="primary"
            loading={messageMutation.isPending}
            disabled={
              !writable ||
              !message.trim() ||
              message.length > 2000 ||
              !messageReason.trim() ||
              messageReason.trim().length > 500 ||
              !messageConfirmed
            }
            onClick={() => {
              if (writable) messageMutation.mutate();
            }}
          >
            {t('workplace.services.sendMessage')}
          </ActionButton>
        </Stack>
      )}
      <Box>
        <Stack direction="row" gap={0.75} alignItems="center">
          <Paperclip size={16} aria-hidden="true" />
          <Typography component="h4" variant="subtitle2">
            {t('workplace.services.attachmentsTitle')}
          </Typography>
        </Stack>
        {attachmentsQuery.isError ? (
          <InlineFeedback severity="error">{t('workplace.services.historyError')}</InlineFeedback>
        ) : attachments.length ? (
          <Stack component="ul" spacing={0.75} sx={{ p: 0, m: 0, mt: 1 }}>
            {attachments.map((item) => (
              <AttachmentRow
                key={item.attachmentId}
                item={item}
                order={order}
                administrator={administrator}
                canWrite={canWrite}
                elevated={elevated}
              />
            ))}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            {t('workplace.services.attachmentsEmpty')}
          </Typography>
        )}
        {attachmentsQuery.hasNextPage ? (
          <ActionButton
            intent="quiet"
            size="small"
            loading={attachmentsQuery.isFetchingNextPage}
            onClick={() => void attachmentsQuery.fetchNextPage()}
          >
            {t('workplace.services.loadMore')}
          </ActionButton>
        ) : null}
      </Box>
      {canWrite && (
        <Stack spacing={1}>
          <FormField
            type="file"
            label={t('workplace.services.chooseFile')}
            InputLabelProps={{ shrink: true }}
            inputProps={{ accept: 'application/pdf,image/png,image/jpeg' }}
            onChange={(event) =>
              setAttachment((event.target as HTMLInputElement).files?.[0] ?? null)
            }
            disabled={!writable || attachmentMutation.isPending}
          />
          <FormField
            label={t('workplace.services.attachmentReason')}
            value={attachmentReason}
            onChange={(event) => setAttachmentReason(event.target.value)}
            disabled={!writable || attachmentMutation.isPending}
            inputProps={{ maxLength: 500 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={attachmentConfirmed}
                onChange={(event) => setAttachmentConfirmed(event.target.checked)}
                disabled={!writable || attachmentMutation.isPending}
              />
            }
            label={t('workplace.services.attachmentConfirmation')}
          />
          {attachmentMutation.isError && (
            <InlineFeedback severity="error">
              {t('workplace.services.collaborationError')}
            </InlineFeedback>
          )}
          <ActionButton
            intent="primary"
            loading={attachmentMutation.isPending}
            disabled={
              !writable ||
              !attachment ||
              !attachmentReason.trim() ||
              attachmentReason.trim().length > 500 ||
              !attachmentConfirmed
            }
            onClick={() => {
              if (writable) attachmentMutation.mutate();
            }}
          >
            {t('workplace.services.uploadAttachment')}
          </ActionButton>
        </Stack>
      )}
    </Stack>
  );
}
