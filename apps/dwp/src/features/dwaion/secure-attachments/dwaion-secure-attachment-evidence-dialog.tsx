import { useTranslation } from 'react-i18next';
import { ActionButton, foundationTokens } from '@dwp-frontend/design-system';
import type { DwaionAttachmentEvidence } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { secureAttachmentCopy } from './dwaion-secure-attachment-copy';

export function DwaionAttachmentEvidenceDialog({
  open,
  view,
  evidence,
  busy,
  error,
  copy,
  onClose,
}: {
  open: boolean;
  view: 'LOG' | 'DLP' | 'OCR' | null;
  evidence: readonly DwaionAttachmentEvidence[];
  busy: boolean;
  error: boolean;
  copy: ReturnType<typeof secureAttachmentCopy>;
  onClose: () => void;
}) {
  const { t } = useTranslation('work');
  const title =
    view === 'DLP' ? copy.maskingHistory : view === 'OCR' ? copy.ocrViewer : copy.inspectionLog;
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {busy ? <Typography>{copy.evidenceLoading}</Typography> : null}
        {error ? <Alert severity="error">{copy.evidenceError}</Alert> : null}
        <Stack gap={1}>
          {evidence.map((item) => {
            const events =
              view === 'DLP' ? item.maskingHistory : view === 'LOG' ? item.inspectionLog : [];
            return (
              <Box key={item.attachmentId} sx={evidenceRowSx}>
                <Typography variant="subtitle2">{item.attachmentId}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('dwaionOperational.secureAttachments.checksumPrefix')} {item.sourceSha256}
                </Typography>
                {events.map((event) => (
                  <Typography key={event.eventId} variant="body2" sx={{ mt: 0.5 }}>
                    {event.safeErrorCode
                      ? t('dwaionOperational.secureAttachments.eventMetadataWithError', {
                          eventType: event.eventType,
                          revision: event.revision,
                          state: event.currentState,
                          errorCode: event.safeErrorCode,
                        })
                      : t('dwaionOperational.secureAttachments.eventMetadata', {
                          eventType: event.eventType,
                          revision: event.revision,
                          state: event.currentState,
                        })}
                  </Typography>
                ))}
                {view === 'OCR' && item.ocrEvidence.length ? (
                  <Stack component="ul" sx={{ m: 0, mt: 0.75, pl: 2 }}>
                    {item.ocrEvidence.map((citation) => (
                      <Typography component="li" variant="caption" key={citation.citationId}>
                        {t('dwaionOperational.secureAttachments.ocrCitation', {
                          label: citation.label,
                          locator: citation.locator,
                        })}
                      </Typography>
                    ))}
                  </Stack>
                ) : null}
              </Box>
            );
          })}
        </Stack>
      </DialogContent>
      <DialogActions>
        <ActionButton intent="primary" onClick={onClose}>
          {copy.evidenceClose}
        </ActionButton>
      </DialogActions>
    </Dialog>
  );
}

const evidenceRowSx = {
  p: 1,
  border: 1,
  borderColor: 'divider',
  borderRadius: foundationTokens.radius.control + 'px',
  bgcolor: 'background.paper',
} as const;
