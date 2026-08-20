import { FileText, RotateCcw, X } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { MessagingAttachmentDraft } from './use-messaging-attachment-queue';

function fileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function MessagingAttachmentDrafts({
  items,
  labels,
  onRetry,
  onRemove,
}: {
  items: MessagingAttachmentDraft[];
  labels: {
    uploading: string;
    ready: string;
    rejected: string;
    error: string;
    retry: string;
    remove: string;
  };
  onRetry: (localId: string) => void;
  onRemove: (localId: string) => void;
}) {
  if (!items.length) return null;

  return (
    <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap aria-live="polite">
      {items.map((item) => {
        const failed = item.state === 'ERROR' || item.state === 'REJECTED';
        const status =
          item.state === 'UPLOADING'
            ? labels.uploading
            : item.state === 'READY'
              ? labels.ready
              : item.state === 'REJECTED'
                ? labels.rejected
                : labels.error;
        return (
          <Stack
            key={item.localId}
            direction="row"
            spacing={0.7}
            alignItems="center"
            sx={{
              minWidth: 0,
              maxWidth: 280,
              px: 0.9,
              py: 0.65,
              border: 1,
              borderColor: failed ? 'error.light' : 'divider',
              borderRadius: 1,
              bgcolor: failed ? 'error.lighter' : 'background.paper',
            }}
          >
            {item.state === 'UPLOADING' ? (
              <CircularProgress size={16} />
            ) : (
              <FileText size={16} aria-hidden="true" />
            )}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="caption" fontWeight={750} noWrap display="block">
                {item.file.name}
              </Typography>
              <Typography
                variant="caption"
                color={failed ? 'error.main' : 'text.secondary'}
                display="block"
                noWrap
              >
                {fileSize(item.file.size)} · {status}
              </Typography>
            </Box>
            {failed ? (
              <ActionIconButton
                label={`${labels.retry}: ${item.file.name}`}
                size="small"
                onClick={() => onRetry(item.localId)}
              >
                <RotateCcw size={14} />
              </ActionIconButton>
            ) : null}
            <ActionIconButton
              label={`${labels.remove}: ${item.file.name}`}
              size="small"
              disabled={item.state === 'UPLOADING'}
              onClick={() => onRemove(item.localId)}
            >
              <X size={14} />
            </ActionIconButton>
          </Stack>
        );
      })}
    </Stack>
  );
}
