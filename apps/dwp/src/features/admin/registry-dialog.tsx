import { useEffect, useState } from 'react';

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
  create: { title: 'New registry entry', submit: 'Create draft' },
  edit: { title: 'Edit draft revision', submit: 'Save changes' },
  revision: { title: 'New registry revision', submit: 'Create revision' },
} as const;

export function RegistryDialog({
  open,
  mode,
  value,
  busy,
  onClose,
  onSubmit,
}: RegistryDialogProps) {
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
        <DialogTitle>{dialogCopy[mode].title}</DialogTitle>
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
            label="Registry type"
            value={registryType}
            onChange={(event) => setRegistryType(event.target.value as RegistryType)}
            disabled={mode !== 'create'}
          >
            {registryTypes.map((type) => (
              <MenuItem key={type} value={type}>
                {type.charAt(0) + type.slice(1).toLowerCase()}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            autoFocus={mode === 'create'}
            label="Registry key"
            value={entryKey}
            onChange={(event) => setEntryKey(event.target.value.toUpperCase())}
            disabled={mode !== 'create'}
            required
            inputProps={{ pattern: '[A-Za-z][A-Za-z0-9_.-]{0,99}', maxLength: 100 }}
          />
          <TextField
            autoFocus={mode !== 'create'}
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            inputProps={{ maxLength: 160 }}
            sx={{ gridColumn: { sm: '1 / -1' } }}
          />
          <TextField
            label="Owner reference"
            value={ownerRef}
            onChange={(event) => setOwnerRef(event.target.value)}
            required
            inputProps={{ maxLength: 160 }}
          />
          <TextField
            label="Artifact version"
            value={artifactVersion}
            onChange={(event) => setArtifactVersion(event.target.value)}
            required
            inputProps={{ maxLength: 64 }}
          />
          <TextField
            select
            label="Risk tier"
            value={riskTier}
            onChange={(event) => setRiskTier(event.target.value as RiskTier)}
          >
            {riskTiers.map((tier) => (
              <MenuItem key={tier} value={tier}>
                {tier.charAt(0) + tier.slice(1).toLowerCase()}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Description"
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
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={busy || !valid}>
            {dialogCopy[mode].submit}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
