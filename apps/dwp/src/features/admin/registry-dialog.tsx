import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import type { RegistryEntry, RegistryType, RiskTier } from '@dwp-frontend/shared-utils';

export type RegistryDialogMode = 'create' | 'edit' | 'revision';

export type RegistryDialogValue = {
  registryType: RegistryType;
  entryKey: string;
  name: string;
  description?: string;
  ownerRef: string;
  riskTier: RiskTier;
  artifactVersion: string;
};

type RegistryDialogProps = {
  open: boolean;
  mode: RegistryDialogMode;
  value?: RegistryEntry | null;
  busy: boolean;
  onClose: () => void;
  onSubmit: (value: RegistryDialogValue) => Promise<void>;
};

const registryTypes: RegistryType[] = ['APP', 'CONNECTOR', 'AGENT', 'TOOL', 'POLICY'];
const riskTiers: RiskTier[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const dialogCopy = {
  create: { title: 'registry.dialog.createTitle', submit: 'registry.actions.createDraft' },
  edit: { title: 'registry.dialog.editTitle', submit: 'registry.actions.saveChanges' },
  revision: { title: 'registry.dialog.revisionTitle', submit: 'registry.actions.createRevision' },
} as const;

export function RegistryDialog({
  open,
  mode,
  value,
  busy,
  onClose,
  onSubmit,
}: RegistryDialogProps) {
  const { t } = useTranslation('admin');
  const [registryType, setRegistryType] = useState<RegistryType>('APP');
  const [entryKey, setEntryKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ownerRef, setOwnerRef] = useState('');
  const [riskTier, setRiskTier] = useState<RiskTier>('MEDIUM');
  const [artifactVersion, setArtifactVersion] = useState('1.0.0');

  useEffect(() => {
    if (!open) return;
    setRegistryType(value?.registryType ?? 'APP');
    setEntryKey(value?.entryKey ?? '');
    setName(value?.name ?? '');
    setDescription(value?.description ?? '');
    setOwnerRef(value?.ownerRef ?? '');
    setRiskTier(value?.riskTier ?? 'MEDIUM');
    setArtifactVersion(value?.artifactVersion ?? '1.0.0');
  }, [open, value]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit({
      registryType,
      entryKey: entryKey.trim(),
      name: name.trim(),
      description: description.trim() || undefined,
      ownerRef: ownerRef.trim(),
      riskTier,
      artifactVersion: artifactVersion.trim(),
    });
  };

  const valid =
    entryKey.trim().length > 0 &&
    name.trim().length > 0 &&
    ownerRef.trim().length > 0 &&
    artifactVersion.trim().length > 0;

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <Box component="form" onSubmit={(event) => void submit(event)}>
        <DialogTitle>{t(dialogCopy[mode].title)}</DialogTitle>
        <DialogContent
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 2,
            pt: '8px !important',
          }}
        >
          <TextField
            select
            label={t('registry.fields.type')}
            value={registryType}
            onChange={(event) => setRegistryType(event.target.value as RegistryType)}
            disabled={mode !== 'create'}
          >
            {registryTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {t(`registry.types.${type}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            autoFocus={mode === 'create'}
            label={t('registry.fields.key')}
            value={entryKey}
            onChange={(event) => setEntryKey(event.target.value.toUpperCase())}
            disabled={mode !== 'create'}
            required
            inputProps={{ pattern: '[A-Za-z][A-Za-z0-9_.-]{0,99}', maxLength: 100 }}
          />
          <TextField
            autoFocus={mode !== 'create'}
            label={t('registry.fields.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            inputProps={{ maxLength: 160 }}
            sx={{ gridColumn: { sm: '1 / -1' } }}
          />
          <TextField
            label={t('registry.fields.owner')}
            value={ownerRef}
            onChange={(event) => setOwnerRef(event.target.value)}
            required
            inputProps={{ maxLength: 160 }}
          />
          <TextField
            label={t('registry.fields.version')}
            value={artifactVersion}
            onChange={(event) => setArtifactVersion(event.target.value)}
            required
            inputProps={{ maxLength: 64 }}
          />
          <TextField
            select
            label={t('registry.fields.risk')}
            value={riskTier}
            onChange={(event) => setRiskTier(event.target.value as RiskTier)}
          >
            {riskTiers.map((tier) => (
              <MenuItem key={tier} value={tier}>
                {t(`registry.risk.${tier}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label={t('registry.fields.description')}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            multiline
            minRows={3}
            inputProps={{ maxLength: 1000 }}
            sx={{ gridColumn: { sm: '1 / -1' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={busy || !valid}>
            {t(dialogCopy[mode].submit)}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
