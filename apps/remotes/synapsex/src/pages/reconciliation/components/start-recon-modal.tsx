/**
 * Start reconciliation run modal
 */

import type { FormEvent } from 'react';
import type { ReconRunType } from '@dwp-frontend/shared-utils';

import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';

import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

const RUN_TYPES: { value: ReconRunType; label: string }[] = [
  { value: 'DOC_OPENITEM_MATCH', label: 'Doc vs Open Item Match' },
  { value: 'ACTION_EFFECT', label: 'Action Effect' },
];

type StartReconModalProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (runType: ReconRunType) => void;
  isLoading?: boolean;
};

export const StartReconModal = ({
  open,
  onClose,
  onSubmit,
  isLoading,
}: StartReconModalProps) => {
  const [runType, setRunType] = useState<ReconRunType>('DOC_OPENITEM_MATCH');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(runType);
    onClose();
  };

  return (
    <>
      <DialogTitle>Start Reconciliation Run</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            Run a reconciliation job to validate data integrity between SAP source and normalized tables.
          </DialogContentText>
          <FormControl fullWidth>
            <InputLabel id="recon-run-type-label">Run Type</InputLabel>
            <Select
              labelId="recon-run-type-label"
              label="Run Type"
              value={runType}
              onChange={(e) => setRunType(e.target.value as ReconRunType)}
            >
              {RUN_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isLoading} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
            startIcon={<Iconify icon="solar:play-bold" width={18} />}
          >
            {isLoading ? 'Starting…' : 'Start Run'}
          </Button>
        </DialogActions>
      </form>
    </>
  );
};
