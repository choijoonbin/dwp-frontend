import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileText } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import {
  createMessagingAttachmentDownload,
  downloadMessagingAttachmentContent,
  useToast,
} from '@dwp-frontend/shared-utils';

import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';

import type { MessagingAttachment } from '@dwp-frontend/shared-utils';

function fileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessagingAttachmentList({
  conversationId,
  attachments,
}: {
  conversationId: string;
  attachments: MessagingAttachment[];
}) {
  const { t } = useTranslation('messaging');
  const toast = useToast();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const download = async (attachment: MessagingAttachment) => {
    if (downloadingId) return;
    setDownloadingId(attachment.attachmentId);
    try {
      const grant = await createMessagingAttachmentDownload(
        conversationId,
        attachment.attachmentId
      );
      const content = await downloadMessagingAttachmentContent(grant.downloadUrl);
      const objectUrl = URL.createObjectURL(content);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = grant.filename;
      anchor.rel = 'noopener';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch {
      toast.error(t('message.attachments.downloadError'));
    } finally {
      setDownloadingId(null);
    }
  };

  if (!attachments.length) return null;

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
      {attachments.map((attachment) => {
        const downloading = downloadingId === attachment.attachmentId;
        return (
          <ActionButton
            key={attachment.attachmentId}
            intent="quiet"
            size="small"
            startIcon={
              downloading ? (
                <CircularProgress size={14} aria-hidden="true" />
              ) : (
                <FileText size={15} />
              )
            }
            endIcon={downloading ? undefined : <Download size={14} />}
            disabled={Boolean(downloadingId)}
            onClick={() => void download(attachment)}
            aria-label={t('message.attachments.download', { filename: attachment.filename })}
            sx={{
              maxWidth: 280,
              border: 1,
              borderColor: 'divider',
              bgcolor: 'background.paper',
              '& .MuiButton-startIcon': { flexShrink: 0 },
              '& .MuiButton-endIcon': { flexShrink: 0 },
            }}
          >
            {attachment.filename} · {fileSize(attachment.sizeBytes)}
          </ActionButton>
        );
      })}
    </Stack>
  );
}
