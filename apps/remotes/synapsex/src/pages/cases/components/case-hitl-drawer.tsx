/**
 * Case Detail HITL 승인 Drawer
 * pending_approval → approved/rejected → executing → succeeded/failed
 */

import type { Theme, SxProps } from '@mui/material/styles';

import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';
import Drawer from '@mui/material/Drawer';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import { StatusPill } from '../../../components/finance/status-pill';

import type { HitlStatus } from '../hooks/use-case-hitl';

// ----------------------------------------------------------------------

export type CaseHitlDrawerProps = {
  open: boolean;
  onClose: () => void;
  requestId: string | null;
  description?: string;
  status: HitlStatus;
  /** 승인 시 사용자 입력 comment(승인 사유)를 백엔드 Payload에 포함 */
  onApprove: (requestId: string, comment?: string) => void;
  onReject: (requestId: string, reason?: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
  sx?: SxProps<Theme>;
};

const statusToPill: Record<HitlStatus, 'pending_approval' | 'in_progress' | 'completed' | 'failed' | 'approved' | 'rejected'> = {
  pending_approval: 'pending_approval',
  approved: 'approved',
  rejected: 'rejected',
  executing: 'in_progress',
  succeeded: 'completed',
  failed: 'failed',
};

export const CaseHitlDrawer = ({
  open,
  onClose,
  requestId,
  description,
  status,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  sx,
}: CaseHitlDrawerProps) => {
  const [rejectReason, setRejectReason] = useState('');
  const [approveComment, setApproveComment] = useState('');
  const isPending = status === 'pending_approval';
  const isDone = status === 'approved' || status === 'rejected' || status === 'succeeded' || status === 'failed';

  const handleApprove = () => {
    if (requestId) onApprove(requestId, approveComment.trim() || undefined);
  };

  const handleReject = () => {
    if (requestId) onReject(requestId, rejectReason.trim() || undefined);
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: { width: { xs: '100%', sm: 400 }, p: 2, ...sx },
      }}
    >
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            HITL Approval
          </Typography>
          <StatusPill status={statusToPill[status] ?? 'pending_approval'} size="sm" />
        </Stack>

        {requestId && (
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            Request ID: {requestId}
          </Typography>
        )}

        {description && (
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        )}

        {isPending && (
          <>
            <Typography variant="body2">
              The Agent is requesting your approval to proceed. Approve or reject below.
            </Typography>
            <TextField
              label="Approval comment (optional)"
              placeholder="승인 사유"
              multiline
              rows={2}
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              size="small"
              fullWidth
            />
            <TextField
              label="Rejection reason (optional)"
              multiline
              rows={2}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              size="small"
              fullWidth
            />
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                color="error"
                onClick={handleReject}
                disabled={isRejecting}
                startIcon={<Iconify icon="solar:close-circle-bold" width={18} />}
              >
                Reject
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleApprove}
                disabled={isApproving}
                startIcon={<Iconify icon="solar:check-circle-bold" width={18} />}
              >
                Approve
              </Button>
            </Stack>
          </>
        )}

        {isDone && (
          <Button variant="outlined" onClick={onClose}>
            Close
          </Button>
        )}
      </Stack>
    </Drawer>
  );
};
