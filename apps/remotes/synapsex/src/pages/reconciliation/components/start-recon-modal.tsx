/**
 * Start reconciliation run modal
 */

import type { FormEvent } from 'react';
import type { ReconRunType } from '@dwp-frontend/shared-utils';

import { useState } from 'react';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';

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
  const { t } = useTranslation('common');
  const [runType, setRunType] = useState<ReconRunType>('DOC_OPENITEM_MATCH');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(runType);
    onClose();
  };

  return (
    <>
      <DialogTitle>{t('reconciliation.startModalTitle')}</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent>
          <DialogContentText sx={{ mb: 3 }}>
            {t('reconciliation.startModalHint')}
          </DialogContentText>
          <FormControl fullWidth>
            <InputLabel id="recon-run-type-label">{t('reconciliation.runType')}</InputLabel>
            <Select
              labelId="recon-run-type-label"
              label={t('reconciliation.runType')}
              value={runType}
              onChange={(e) => setRunType(e.target.value as ReconRunType)}
            >
              <MenuItem value="DOC_OPENITEM_MATCH">{t('reconciliation.runTypes.DOC_OPENITEM_MATCH')}</MenuItem>
              <MenuItem value="ACTION_EFFECT">{t('reconciliation.runTypes.ACTION_EFFECT')}</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isLoading} sx={{ color: 'text.secondary' }}>
            {t('confirm.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
            startIcon={<Iconify icon="solar:play-bold" width={18} />}
          >
            {isLoading ? t('reconciliation.starting') : t('reconciliation.startRun')}
          </Button>
        </DialogActions>
      </form>
    </>
  );
};
