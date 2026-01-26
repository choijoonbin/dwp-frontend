// ----------------------------------------------------------------------

import type { HitlRequest } from '@dwp-frontend/shared-utils/aura/use-aura-store';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type HitlApprovalDialogProps = {
  request: HitlRequest;
  onApprove: () => void;
  onReject: () => void;
};

export const HitlApprovalDialog = ({ request, onApprove, onReject }: HitlApprovalDialogProps) => (
    <Dialog open maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <Iconify icon="solar:shield-warning-bold" width={24} sx={{ color: 'warning.main' }} />
          <Typography variant="h6">작업 승인 필요</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="warning" icon={<Iconify icon="solar:info-circle-bold" width={20} />}>
            에이전트가 다음 작업을 수행하기 전 사용자 승인이 필요합니다.
          </Alert>

          <Paper sx={{ p: 2, bgcolor: 'background.neutral' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              작업 내용
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
              {request.message}
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, bgcolor: 'background.neutral' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              실행할 액션
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
              {request.action}
            </Typography>
          </Paper>

          <Paper sx={{ p: 2, bgcolor: 'background.neutral' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              파라미터
            </Typography>
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1,
                bgcolor: 'background.paper',
                borderRadius: 0.5,
                fontSize: '0.75rem',
                overflow: 'auto',
                maxHeight: 200,
              }}
            >
              {JSON.stringify(request.params, null, 2)}
            </Box>
          </Paper>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button variant="outlined" color="error" onClick={onReject} startIcon={<Iconify icon="solar:close-circle-bold" />}>
          거절
        </Button>
        <Button variant="contained" color="primary" onClick={onApprove} startIcon={<Iconify icon="solar:check-circle-bold" />}>
          승인 및 실행
        </Button>
      </DialogActions>
    </Dialog>
  );
