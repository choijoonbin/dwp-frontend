import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';

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

  const submit = async () => {
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
    <FormDialog
      open={open}
      title={t(dialogCopy[mode].title)}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t(dialogCopy[mode].submit)}
      busy={busy}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={submit}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2,
        }}
      >
        <SelectField
          label={t('registry.fields.type')}
          value={registryType}
          onValueChange={(next) => setRegistryType(next as RegistryType)}
          disabled={mode !== 'create'}
          options={registryTypes.map((type) => ({
            value: type,
            label: t(`registry.types.${type}`),
          }))}
        />
        <FormField
          autoFocus={mode === 'create'}
          label={t('registry.fields.key')}
          value={entryKey}
          onChange={(event) => setEntryKey(event.target.value.toUpperCase())}
          disabled={mode !== 'create'}
          required
          slotProps={{
            htmlInput: { pattern: '[A-Za-z][A-Za-z0-9_.-]{0,99}', maxLength: 100 },
          }}
        />
        <FormField
          autoFocus={mode !== 'create'}
          label={t('registry.fields.name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          slotProps={{ htmlInput: { maxLength: 160 } }}
          sx={{ gridColumn: { sm: '1 / -1' } }}
        />
        <FormField
          label={t('registry.fields.owner')}
          value={ownerRef}
          onChange={(event) => setOwnerRef(event.target.value)}
          required
          slotProps={{ htmlInput: { maxLength: 160 } }}
        />
        <FormField
          label={t('registry.fields.version')}
          value={artifactVersion}
          onChange={(event) => setArtifactVersion(event.target.value)}
          required
          slotProps={{ htmlInput: { maxLength: 64 } }}
        />
        <SelectField
          label={t('registry.fields.risk')}
          value={riskTier}
          onValueChange={(next) => setRiskTier(next as RiskTier)}
          options={riskTiers.map((tier) => ({
            value: tier,
            label: t(`registry.risk.${tier}`),
          }))}
        />
        <FormField
          label={t('registry.fields.description')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          multiline
          minRows={3}
          slotProps={{ htmlInput: { maxLength: 1000 } }}
          sx={{ gridColumn: { sm: '1 / -1' } }}
        />
      </Box>
    </FormDialog>
  );
}
