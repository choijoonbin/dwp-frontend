import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, File, Paperclip, RefreshCw, ShieldCheck, Upload, X } from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  FormDialog,
  FormField,
  InlineFeedback,
} from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { approvalAttachmentScanEligible } from './approval-attachment-client-model';

import type { ApprovalAttachmentClient } from './use-approval-attachment-client';
import type { ApprovalAttachmentItem } from '@dwp-frontend/shared-utils/api/approval-attachment-contract';

export function ApprovalAttachmentPanel({
  client,
  saveFirst = false,
}: {
  client: ApprovalAttachmentClient;
  saveFirst?: boolean;
}) {
  const { t } = useTranslation('approvals');
  const titleId = useId();
  const input = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const [downloadItem, setDownloadItem] = useState<ApprovalAttachmentItem>();
  const [reason, setReason] = useState('');
  const { state, controller, attachments } = client;
  const busy = state.busy;
  const items = attachments?.manifest.items ?? [];
  const selected = new Set(items.map((item) => item.attachmentId));
  const problemKey =
    state.problem === 'UNKNOWN'
      ? state.unknownKind === 'RESERVE'
        ? 'reserveUnknown'
        : 'unknown'
      : state.problem === 'CONFLICT'
        ? 'sourceChanged'
        : state.problem === 'REJECTED'
          ? 'rejected'
          : state.problem === 'DENIED'
            ? 'unavailable'
            : 'error';
  const restoreFocus = () => window.requestAnimationFrame(() => opener.current?.focus());
  useEffect(() => {
    const element = input.current;
    const onCancel = () => window.requestAnimationFrame(() => opener.current?.focus());
    element?.addEventListener('cancel', onCancel);
    return () => element?.removeEventListener('cancel', onCancel);
  }, [client.uploadReady]);
  const closeDownload = () => {
    if (busy) return;
    setDownloadItem(undefined);
    setReason('');
  };

  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      data-testid="approval-attachment-panel"
      sx={{ minWidth: 0, borderTop: 1, borderColor: 'divider', py: 2 }}
    >
      <Stack
        direction="row"
        gap={1}
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 1.5 }}
      >
        <Stack direction="row" alignItems="center" gap={1} minWidth={0}>
          <Box sx={{ color: 'primary.main', display: 'flex' }}>
            <Paperclip size={19} aria-hidden="true" />
          </Box>
          <Typography
            id={titleId}
            component="h3"
            variant="subtitle2"
            sx={{ overflowWrap: 'anywhere' }}
          >
            {t('requests.attachments.title')}
          </Typography>
        </Stack>
        {client.available && !saveFirst && (
          <ActionIconButton
            label={t('requests.attachments.refresh')}
            disabled={busy || client.source.isFetching}
            onClick={() => void client.refresh()}
          >
            <RefreshCw size={17} />
          </ActionIconButton>
        )}
      </Stack>
      {saveFirst || !client.available || !client.ready ? (
        <InlineFeedback severity={saveFirst ? 'info' : 'warning'}>
          {t(saveFirst ? 'requests.attachments.saveFirst' : 'requests.attachments.unavailable')}
        </InlineFeedback>
      ) : null}
      {state.problem && (
        <Box role="status" aria-live="polite" sx={{ my: 1 }}>
          <InlineFeedback severity={state.problem === 'UNKNOWN' ? 'warning' : 'error'}>
            {t(`requests.attachments.${problemKey}`)}
          </InlineFeedback>
        </Box>
      )}
      {!client.masked && (
        <>
          {((state.problem === 'UNKNOWN' && state.unknownKind !== 'CONTENT') ||
            (state.problem === 'CONFLICT' && controller.unresolved)) && (
            <ActionButton
              type="button"
              intent="secondary"
              startIcon={<RefreshCw size={16} />}
              disabled={!client.ready || busy}
              onClick={() => void controller.retryOriginal()}
            >
              {t('requests.attachments.retryOriginal')}
            </ActionButton>
          )}
          {client.uploadReady && (
            <Stack gap={1.25} sx={{ py: 1.5 }}>
              <input
                ref={input}
                type="file"
                accept={attachments?.allowedMediaTypes.join(',')}
                aria-label={t('requests.attachments.choose')}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  padding: 0,
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void controller.choose(file);
                  restoreFocus();
                }}
              />
              <ActionButton
                ref={opener}
                type="button"
                intent="secondary"
                startIcon={<Upload size={17} />}
                disabled={busy || controller.unresolved || Boolean(state.file)}
                onClick={() => input.current?.click()}
                sx={{ alignSelf: 'flex-start' }}
              >
                {t('requests.attachments.choose')}
              </ActionButton>
              {attachments && (
                <Typography variant="caption" color="text.secondary">
                  {t('requests.attachments.limits', {
                    bytes: attachments.maxFileBytes,
                    count: attachments.maxFiles,
                  })}
                </Typography>
              )}
            </Stack>
          )}
          {state.file && (
            <Stack
              direction="row"
              gap={1}
              alignItems="center"
              sx={{ my: 1, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
            >
              <File size={19} aria-hidden="true" />
              <Box minWidth={0} flex={1}>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  {state.file.fileName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('requests.attachments.size', { bytes: state.file.sizeBytes })}
                </Typography>
              </Box>
              <ActionIconButton
                label={t('requests.attachments.upload')}
                disabled={!client.uploadReady || busy || controller.unresolved}
                onClick={() => void controller.upload()}
              >
                <Upload size={17} />
              </ActionIconButton>
              <ActionIconButton
                label={t('requests.attachments.cancel')}
                disabled={busy || controller.unresolved}
                onClick={() => controller.clearFile()}
              >
                <X size={17} />
              </ActionIconButton>
            </Stack>
          )}
          <Stack
            component="ul"
            aria-label={t('requests.attachments.title')}
            sx={{ listStyle: 'none', p: 0, m: 0 }}
          >
            {state.uploads
              .filter((row) => !selected.has(row.upload.attachmentId))
              .map((row) => (
                <Stack
                  component="li"
                  key={row.upload.uploadId}
                  gap={1}
                  sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}
                >
                  <Stack direction="row" gap={1} alignItems="flex-start">
                    <Box
                      sx={{
                        color: approvalAttachmentScanEligible(row.upload)
                          ? 'success.main'
                          : 'warning.main',
                        display: 'flex',
                      }}
                    >
                      <ShieldCheck size={19} aria-hidden="true" />
                    </Box>
                    <Box flex={1} minWidth={0}>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                        {row.fileName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t('requests.attachments.size', { bytes: row.upload.sizeBytes })}
                      </Typography>
                    </Box>
                  </Stack>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={t(`requests.attachments.states.${row.upload.state}`)}
                    sx={{
                      alignSelf: 'flex-start',
                      maxWidth: '100%',
                      height: 'auto',
                      '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 },
                    }}
                  />
                  <Stack direction="row" gap={0.5} useFlexGap flexWrap="wrap">
                    <ActionIconButton
                      label={t('requests.attachments.refresh')}
                      disabled={!client.ready || busy}
                      onClick={() => void controller.inspect(row.upload.uploadId)}
                    >
                      <RefreshCw size={17} />
                    </ActionIconButton>
                    {state.unknownKind === 'CONTENT' && (
                      <ActionButton
                        type="button"
                        size="small"
                        intent="secondary"
                        disabled={!client.ready || busy}
                        onClick={() => void controller.reconcile(row.upload.uploadId)}
                      >
                        {t('requests.attachments.reconcile')}
                      </ActionButton>
                    )}
                    {approvalAttachmentScanEligible(row.upload) && (
                      <ActionButton
                        type="button"
                        intent="secondary"
                        size="small"
                        startIcon={<Paperclip size={16} />}
                        disabled={!client.uploadReady || busy || controller.unresolved}
                        onClick={() =>
                          void controller.select([...selected, row.upload.attachmentId])
                        }
                      >
                        {t('requests.attachments.select')}
                      </ActionButton>
                    )}
                    {row.upload.state !== 'CANCELLED' && (
                      <ActionIconButton
                        label={t('requests.attachments.cancel')}
                        disabled={!client.uploadReady || busy || controller.unresolved}
                        onClick={() => void controller.cancel(row.upload.uploadId)}
                      >
                        <X size={17} />
                      </ActionIconButton>
                    )}
                  </Stack>
                </Stack>
              ))}
            {items.map((item) => (
              <Stack
                component="li"
                key={item.attachmentId}
                direction="row"
                alignItems="center"
                gap={1}
                sx={{ py: 1.5, borderBottom: 1, borderColor: 'divider' }}
              >
                <Box sx={{ display: 'flex', color: 'primary.main' }}>
                  <Paperclip size={19} aria-hidden="true" />
                </Box>
                <Box flex={1} minWidth={0}>
                  <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                    {item.fileName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t('requests.attachments.size', { bytes: item.sizeBytes })}{' '}
                    {t(
                      attachments?.manifest.sealed
                        ? 'requests.attachments.sealed'
                        : 'requests.attachments.selected'
                    )}
                  </Typography>
                </Box>
                {client.downloadReady && (
                  <ActionIconButton
                    label={t('requests.attachments.download')}
                    disabled={busy || controller.unresolved}
                    onClick={() => {
                      setDownloadItem(item);
                      setReason('');
                    }}
                  >
                    <Download size={17} />
                  </ActionIconButton>
                )}
                {client.uploadReady && (
                  <ActionIconButton
                    label={t('requests.attachments.remove')}
                    disabled={busy || controller.unresolved}
                    onClick={() =>
                      void controller.select([...selected].filter((id) => id !== item.attachmentId))
                    }
                  >
                    <X size={17} />
                  </ActionIconButton>
                )}
              </Stack>
            ))}
          </Stack>
        </>
      )}
      <FormDialog
        open={Boolean(downloadItem) && !client.masked}
        title={t('requests.attachments.downloadTitle')}
        cancelLabel={t('requests.attachments.close')}
        submitLabel={t('requests.attachments.download')}
        busy={busy}
        submitDisabled={!client.downloadReady || !reason.trim() || controller.unresolved}
        mobileFullScreen
        onClose={closeDownload}
        onSubmit={async () => {
          if (downloadItem) {
            await controller.download(downloadItem, reason);
            if (!controller.getSnapshot().problem) closeDownload();
          }
        }}
      >
        <Stack gap={2}>
          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
            {downloadItem?.fileName}
          </Typography>
          <FormField
            label={t('requests.attachments.reason')}
            value={reason}
            required
            disabled={busy || !client.downloadReady}
            inputProps={{ maxLength: 500 }}
            onChange={(event) => setReason(event.target.value)}
          />
        </Stack>
      </FormDialog>
    </Box>
  );
}
