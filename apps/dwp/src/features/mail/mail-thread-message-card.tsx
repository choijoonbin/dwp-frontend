import { useTranslation } from 'react-i18next';
import { Download, Forward, ImageOff, RotateCcw } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { downloadMailMessageAttachment, useToast } from '@dwp-frontend/shared-utils';
import { ActionButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { mailRelativeTime } from './mail-components';
import {
  formatMailAttachmentSize,
  mailMessageAttachments,
  saveMailAttachmentBlob,
} from './mail-attachment-download';
import {
  mailMessageRecipients,
  mailRemoteImageCount,
  sanitizeMailHtml,
} from './mail-message-presentation';
import { mailRemoteImageState } from './mail-runtime-preferences';

import type { MailMessage, MailPreferences } from '@dwp-frontend/shared-utils';

export function MailThreadMessageCard({
  threadId,
  message,
  language,
  remoteImagePolicy,
  remoteImagesManuallyAllowed,
  onLoadRemoteImages,
  onForward,
}: {
  threadId: string;
  message: MailMessage;
  language: string;
  remoteImagePolicy: MailPreferences['remoteImages'];
  remoteImagesManuallyAllowed: boolean;
  onLoadRemoteImages: () => void;
  onForward: () => void;
}) {
  const { t } = useTranslation('mail');
  const toast = useToast();
  const outgoing = message.direction === 'OUTBOUND' || message.direction === 'DRAFT';
  const recipients = mailMessageRecipients(message);
  const attachments = mailMessageAttachments(message.attachments);
  const remoteImageCount = message.bodyFormat === 'HTML' ? mailRemoteImageCount(message.body) : 0;
  const remoteImages = mailRemoteImageState(remoteImagePolicy, remoteImagesManuallyAllowed);
  const download = useMutation({
    mutationFn: async (attachment: (typeof attachments)[number]) => ({
      attachment,
      blob: await downloadMailMessageAttachment(
        threadId,
        message.messageId,
        attachment.attachmentId
      ),
    }),
    onSuccess: ({ attachment, blob }) => saveMailAttachmentBlob(blob, attachment.fileName),
    onError: () => toast.error(t('thread.attachmentDownloadError')),
  });
  return (
    <Box
      sx={{
        width: { xs: 1, lg: 'min(92%, 820px)' },
        ml: outgoing ? 'auto' : 0,
        border: 1,
        borderColor: outgoing ? 'transparent' : 'divider',
        bgcolor: outgoing ? 'var(--dwp-product-soft)' : 'background.paper',
        borderRadius: 1,
        p: 2,
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center">
        <Avatar sx={{ width: 34, height: 34, fontSize: 13, bgcolor: 'primary.dark' }}>
          {message.senderName.slice(0, 2)}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" fontWeight={800} noWrap>
            {message.senderName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {message.senderEmail} · {mailRelativeTime(message.sentAt, language)}
          </Typography>
        </Box>
      </Stack>
      {recipients.length > 0 && (
        <Stack spacing={0.4} sx={{ mt: 1 }}>
          {(['TO', 'CC', 'BCC'] as const).map((type) => {
            const values = recipients.filter((recipient) => recipient.type === type);
            return values.length ? (
              <Typography key={type} variant="caption" color="text.secondary">
                <Box component="span" fontWeight="fontWeightBold">
                  {t(`thread.recipientType.${type}`, { defaultValue: type })}:{' '}
                </Box>
                {values
                  .map((recipient) =>
                    recipient.name ? `${recipient.name} <${recipient.email}>` : recipient.email
                  )
                  .join(', ')}
              </Typography>
            ) : null;
          })}
        </Stack>
      )}
      {remoteImageCount > 0 && !remoteImages.allowed && (
        <Alert
          severity="info"
          icon={<ImageOff size={17} />}
          action={
            remoteImages.canLoad ? (
              <ActionButton intent="quiet" size="small" onClick={onLoadRemoteImages}>
                {t('thread.loadRemoteImages')}
              </ActionButton>
            ) : undefined
          }
          sx={{ mt: 1.5 }}
        >
          {t(
            remoteImages.policy === 'BLOCK'
              ? 'thread.remoteImagesBlockedByPolicy'
              : 'thread.remoteImagesBlocked',
            { count: remoteImageCount }
          )}
        </Alert>
      )}
      {message.bodyFormat === 'HTML' ? (
        <Box
          className="dwp-mail-message-html"
          sx={{
            mt: 1.5,
            lineHeight: 1.75,
            overflowWrap: 'anywhere',
            '& img': { maxWidth: '100%', height: 'auto' },
            '& table': { maxWidth: '100%', borderCollapse: 'collapse' },
            '& td, & th': { border: 1, borderColor: 'divider', p: 0.5 },
            '& [data-mail-remote-image]': { color: 'text.secondary', fontStyle: 'italic' },
          }}
          dangerouslySetInnerHTML={{
            __html: sanitizeMailHtml(message.body, remoteImages.allowed),
          }}
        />
      ) : (
        <Typography
          variant="body2"
          sx={{
            mt: 1.5,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.75,
            overflowWrap: 'anywhere',
          }}
        >
          {message.body}
        </Typography>
      )}
      {attachments.length > 0 && (
        <Stack
          component="section"
          aria-label={t('thread.attachments')}
          direction="row"
          spacing={0.75}
          alignItems="center"
          flexWrap="wrap"
          useFlexGap
          sx={{ mt: 1.5 }}
        >
          {attachments.map((attachment) => (
            <ActionButton
              key={attachment.attachmentId}
              intent="secondary"
              size="small"
              startIcon={<Download size={14} />}
              disabled={download.isPending}
              loading={
                download.isPending && download.variables?.attachmentId === attachment.attachmentId
              }
              aria-label={t('thread.downloadAttachment', { name: attachment.fileName })}
              onClick={() => download.mutate(attachment)}
            >
              {attachment.fileName} · {formatMailAttachmentSize(attachment.sizeBytes, language)}
            </ActionButton>
          ))}
        </Stack>
      )}
      {outgoing && (
        <Stack
          direction="row"
          spacing={1}
          justifyContent="flex-end"
          alignItems="center"
          sx={{ mt: 1.5 }}
        >
          <Chip
            size="small"
            variant="outlined"
            color={
              message.deliveryState === 'FAILED'
                ? 'error'
                : message.deliveryState === 'SENT'
                  ? 'success'
                  : 'default'
            }
            label={t(`delivery.state.${message.deliveryState}`)}
          />
          {message.deliveryState === 'FAILED' && (
            <Stack spacing={0.35} alignItems="flex-end">
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<RotateCcw size={14} />}
                disabled
              >
                {t('delivery.retry')}
              </ActionButton>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ maxWidth: 360, textAlign: 'right' }}
              >
                {t('secondary.delivery.retryBlockedDescription')}
              </Typography>
            </Stack>
          )}
        </Stack>
      )}
      {message.direction !== 'DRAFT' && (
        <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1 }}>
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<Forward size={14} />}
            onClick={onForward}
          >
            {t('thread.forward')}
          </ActionButton>
        </Stack>
      )}
    </Box>
  );
}
