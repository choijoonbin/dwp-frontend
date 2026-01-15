// ----------------------------------------------------------------------

import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

// ----------------------------------------------------------------------

export type ApprovalDialogProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  content?: React.ReactNode;
  actionLabel?: string;
  cancelLabel?: string;
  metadata?: Record<string, any>;
};

export const ApprovalDialog = ({
  open,
  onClose,
  onConfirm,
  title = '에이전트 작업 승인',
  content,
  actionLabel = '승인 및 실행',
  cancelLabel = '취소',
  metadata,
}: ApprovalDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 2 }}>{title}</DialogTitle>

      <DialogContent>
        <Stack spacing={2}>
          {typeof content === 'string' ? (
            <Typography variant="body1">{content}</Typography>
          ) : (
            content
          )}

          {metadata && (
            <Box
              sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: 'background.neutral',
                border: (theme) => `dashed 1px ${theme.vars.palette.divider}`,
              }}
            >
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                상세 정보
              </Typography>
              {Object.entries(metadata).map(([key, value]) => (
                <Stack key={key} direction="row" spacing={1} sx={{ mb: 0.5 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', width: 80 }}>
                    {key}:
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                    {String(value)}
                  </Typography>
                </Stack>
              ))}
            </Box>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button variant="contained" color="primary" onClick={onConfirm} autoFocus>
          {actionLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
