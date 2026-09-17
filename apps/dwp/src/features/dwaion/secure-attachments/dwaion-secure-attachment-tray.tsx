import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  CircleAlert,
  FileCheck2,
  FilePlus2,
  LoaderCircle,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  ActionButton,
  ActionIconButton,
  foundationTokens,
  InlineFeedback,
} from '@dwp-frontend/design-system';
import { formatDate, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { secureAttachmentCopy } from './dwaion-secure-attachment-copy';
import {
  DWAION_ATTACHMENT_ACCEPT,
  formatDwaionAttachmentBytes,
} from './dwaion-secure-attachment-model';
import { useDwaionSecureAttachments } from './use-dwaion-secure-attachments';

import type { DwaionSecureAttachment } from '@dwp-frontend/shared-utils';

export type DwaionAttachmentSelection = {
  attachmentIds: string[];
  canSubmit: boolean;
  hasFiles: boolean;
};

export function DwaionSecureAttachmentTray({
  conversationId,
  disabled = false,
  expanded = false,
  onSelectionChange,
}: {
  conversationId?: string | null;
  disabled?: boolean;
  expanded?: boolean;
  onSelectionChange: (selection: DwaionAttachmentSelection) => void;
}) {
  const { i18n } = useTranslation('work');
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const copy = secureAttachmentCopy(locale);
  const inputId = useId();
  const input = useRef<HTMLInputElement | null>(null);
  const state = useDwaionSecureAttachments(conversationId);

  useEffect(() => {
    onSelectionChange({
      attachmentIds: state.readyIds,
      canSubmit: state.canSubmit,
      hasFiles: state.hasFiles,
    });
  }, [onSelectionChange, state.canSubmit, state.hasFiles, state.readyIds]);

  const openPicker = () => {
    if (!disabled) input.current?.click();
  };

  return (
    <Box component="section" aria-labelledby={`${inputId}-title`} sx={{ minWidth: 0 }}>
      <input
        ref={input}
        id={inputId}
        type="file"
        hidden
        multiple
        disabled={disabled}
        accept={DWAION_ATTACHMENT_ACCEPT.join(',')}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length) state.addFiles(files);
        }}
      />
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        {expanded ? (
          <Box sx={{ minWidth: 0 }}>
            <Typography
              id={`${inputId}-title`}
              component="h3"
              variant="subtitle2"
              sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}
            >
              <ShieldCheck size={16} aria-hidden="true" />
              {copy.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {copy.description}
            </Typography>
          </Box>
        ) : (
          <span id={`${inputId}-title`} hidden>
            {copy.title}
          </span>
        )}
        <ActionButton
          intent="quiet"
          size="small"
          startIcon={<FilePlus2 size={16} aria-hidden="true" />}
          disabled={disabled}
          onClick={openPicker}
          sx={{ minHeight: 40, flex: '0 0 auto' }}
        >
          {copy.add}
        </ActionButton>
      </Stack>

      <Collapse in={state.hasFiles || Boolean(state.selectionError || state.operationError)}>
        <Stack gap={0.75} sx={{ mt: 1 }}>
          {state.selectionError ? (
            <InlineFeedback severity="warning" onClose={state.clearError} closeLabel={copy.dismiss}>
              {copy.errors[state.selectionError]}
            </InlineFeedback>
          ) : null}
          {state.operationError ? (
            <InlineFeedback
              severity="error"
              action={
                state.operationError === 'UPLOAD' ? (
                  <ActionButton intent="quiet" size="small" onClick={state.retryUploads}>
                    {copy.retry}
                  </ActionButton>
                ) : undefined
              }
            >
              {state.operationError === 'UPLOAD'
                ? copy.uploadFailed
                : state.operationError === 'DELETE'
                  ? copy.deleteFailed
                  : copy.waiting}
            </InlineFeedback>
          ) : null}
          {state.uploadingNames.map((name) => (
            <AttachmentUploadingRow key={name} name={name} label={copy.uploading} />
          ))}
          {state.attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.attachmentId}
              attachment={attachment}
              disabled={disabled}
              onRemove={() => void state.remove(attachment)}
              copy={copy}
              locale={locale}
            />
          ))}
          {!state.canSubmit && state.hasFiles ? (
            <Typography role="status" variant="caption" color="warning.main">
              {copy.waiting}
            </Typography>
          ) : null}
        </Stack>
      </Collapse>
    </Box>
  );
}

function AttachmentUploadingRow({ name, label }: { name: string; label: string }) {
  return (
    <Box sx={rowSx} aria-live="polite">
      <Stack direction="row" alignItems="center" gap={1}>
        <LoaderCircle size={18} aria-hidden="true" />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight="fontWeightBold" noWrap>
            {name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Box>
      </Stack>
      <LinearProgress sx={{ mt: 0.75 }} />
    </Box>
  );
}

function AttachmentRow({
  attachment,
  disabled,
  onRemove,
  copy,
  locale,
}: {
  attachment: DwaionSecureAttachment;
  disabled: boolean;
  onRemove: () => void;
  copy: ReturnType<typeof secureAttachmentCopy>;
  locale: 'ko' | 'en';
}) {
  const healthy = attachment.state === 'READY';
  const failing = ['BLOCKED', 'FAILED', 'CANCELLED'].includes(attachment.state);
  const Icon = healthy ? CheckCircle2 : failing ? CircleAlert : FileCheck2;
  return (
    <Box
      sx={{
        ...rowSx,
        borderColor: failing ? 'error.light' : healthy ? 'success.light' : 'divider',
      }}
    >
      <Stack direction="row" alignItems="flex-start" gap={1}>
        <Box
          sx={{
            color: failing ? 'error.main' : healthy ? 'success.main' : 'primary.main',
            mt: 0.25,
          }}
        >
          <Icon size={18} aria-hidden="true" />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight="fontWeightBold" sx={{ overflowWrap: 'anywhere' }}>
            {attachment.fileName}
          </Typography>
          <Stack direction="row" gap={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
            <Chip
              size="small"
              color={failing ? 'error' : healthy ? 'success' : 'default'}
              label={copy.states[attachment.state]}
            />
            <Chip
              size="small"
              variant="outlined"
              label={formatDwaionAttachmentBytes(attachment.sizeBytes)}
            />
            {attachment.citations.length ? (
              <Chip
                size="small"
                variant="outlined"
                label={copy.citations(attachment.citations.length)}
              />
            ) : null}
          </Stack>
          <Stack direction="row" gap={0.45} useFlexGap flexWrap="wrap" sx={{ mt: 0.65 }}>
            {attachment.stages.map((stage) => (
              <Typography
                key={stage.key}
                component="span"
                variant="caption"
                color={
                  stage.state === 'BLOCKED' || stage.state === 'FAILED'
                    ? 'error.main'
                    : 'text.secondary'
                }
              >
                {copy.stages[stage.key]} · {stage.state}
              </Typography>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {copy.retention} ·{' '}
            {formatDate(
              attachment.retentionExpiresAt,
              { dateStyle: 'medium', timeStyle: 'short' },
              locale
            )}
          </Typography>
        </Box>
        <ActionIconButton
          label={copy.remove}
          tooltip={copy.remove}
          intent="danger"
          disabled={disabled || attachment.state === 'DELETION_PENDING'}
          onClick={onRemove}
          sx={{ width: 40, height: 40, flex: '0 0 auto' }}
        >
          <Trash2 size={17} aria-hidden="true" />
        </ActionIconButton>
      </Stack>
    </Box>
  );
}

const rowSx = {
  p: 1,
  border: 1,
  borderColor: 'divider',
  borderRadius: foundationTokens.radius.control + 'px',
  bgcolor: 'background.paper',
} as const;
