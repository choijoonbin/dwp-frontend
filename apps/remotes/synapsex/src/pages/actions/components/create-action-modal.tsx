/**
 * Create action modal — caseId + actionType + payload editor
 */

import type { FormEvent } from 'react';

import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import InputLabel from '@mui/material/InputLabel';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

const actionTypes = [
  { value: 'POST_REVERSAL', label: 'Post Reversal' },
  { value: 'BLOCK_PAYMENT', label: 'Block Payment' },
  { value: 'FLAG_REVIEW', label: 'Flag for Review' },
  { value: 'CLEAR_ITEM', label: 'Clear Item' },
  { value: 'UPDATE_MASTER', label: 'Update Master Data' },
];

export type CreateActionForm = {
  caseId: number;
  actionType: string;
  payload: Record<string, unknown>;
};

type CreateActionModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (form: CreateActionForm) => void;
  isLoading?: boolean;
  defaultCaseId?: string;
  availableCaseIds: { id: string; caseNumber: string; caseIdNum?: number }[];
};

export const CreateActionModal = ({
  open,
  onClose,
  onSubmit,
  isLoading,
  defaultCaseId,
  availableCaseIds,
}: CreateActionModalProps) => {
  const [caseId, setCaseId] = useState(defaultCaseId ?? '');
  const [actionType, setActionType] = useState('POST_REVERSAL');
  const [payloadJson, setPayloadJson] = useState('{}');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(payloadJson || '{}');
    } catch {
      payload = {};
    }
    const selected = availableCaseIds.find((c) => c.id === caseId);
    const caseIdNum = selected?.caseIdNum ?? (Number(caseId) || parseInt(String(caseId).replace(/\D/g, ''), 10) || 0);
    onSubmit({
      caseId: caseIdNum,
      actionType,
      payload,
    });
    onClose();
    setCaseId(defaultCaseId ?? '');
    setActionType('POST_REVERSAL');
    setPayloadJson('{}');
  };

  return (
    <>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify icon="solar:add-circle-bold" width={20} sx={{ color: 'primary.main' }} />
          Create Action
        </Stack>
      </DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <Stack spacing={2}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Case</InputLabel>
              <Select
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                label="Case"
              >
                {availableCaseIds.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.caseNumber}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small" required>
              <InputLabel>Action Type</InputLabel>
              <Select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                label="Action Type"
              >
                {actionTypes.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Payload (JSON)
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={payloadJson}
                onChange={(e) => setPayloadJson(e.target.value)}
                placeholder='{"key": "value"}'
                size="small"
                sx={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}
              />
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button variant="outlined" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading || !caseId}
            startIcon={isLoading ? null : <Iconify icon="solar:add-circle-bold" width={18} />}
          >
            {isLoading ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </>
  );
};
