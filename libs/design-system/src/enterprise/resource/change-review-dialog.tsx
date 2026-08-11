import { useEffect, useState } from 'react';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { FormDialog } from '../../components/dialogs';

export type ChangeReviewItem = {
  label: string;
  before?: React.ReactNode;
  after?: React.ReactNode;
};

export type ChangeReviewDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  changes: ChangeReviewItem[];
  impactTitle: string;
  impacts?: string[];
  reasonLabel: string;
  reasonRequiredMessage: string;
  cancelLabel: string;
  confirmLabel: string;
  confirmingLabel?: string;
  busy?: boolean;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
};

export function ChangeReviewDialog({
  open,
  title,
  description,
  changes,
  impactTitle,
  impacts = [],
  reasonLabel,
  reasonRequiredMessage,
  cancelLabel,
  confirmLabel,
  confirmingLabel,
  busy = false,
  destructive = false,
  onClose,
  onConfirm,
}: ChangeReviewDialogProps) {
  const [reason, setReason] = useState('');
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    if (!open) {
      setReason('');
      setAttempted(false);
    }
  }, [open]);

  return (
    <FormDialog
      open={open}
      title={title}
      description={description}
      cancelLabel={cancelLabel}
      submitLabel={confirmLabel}
      submittingLabel={confirmingLabel}
      submitIntent={destructive ? 'danger' : 'primary'}
      busy={busy}
      submitDisabled={!reason.trim()}
      onClose={onClose}
      onSubmit={() => {
        setAttempted(true);
        if (reason.trim()) return onConfirm(reason.trim());
      }}
    >
      <Stack gap={2.5}>
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
          {changes.map((change) => (
            <Box
              key={change.label}
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '140px 1fr 1fr' },
                gap: 1.5,
                py: 1.25,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {change.label}
              </Typography>
              <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                {change.before ?? '-'}
              </Typography>
              <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                {change.after ?? '-'}
              </Typography>
            </Box>
          ))}
        </Box>
        {impacts.length > 0 && (
          <Box>
            <Typography component="h3" variant="subtitle2">
              {impactTitle}
            </Typography>
            <Box component="ul" sx={{ my: 1, pl: 2.5 }}>
              {impacts.map((impact) => (
                <Typography component="li" variant="body2" key={impact}>
                  {impact}
                </Typography>
              ))}
            </Box>
          </Box>
        )}
        <TextField
          required
          multiline
          minRows={3}
          label={reasonLabel}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={attempted && !reason.trim()}
          helperText={attempted && !reason.trim() ? reasonRequiredMessage : ' '}
        />
      </Stack>
    </FormDialog>
  );
}
