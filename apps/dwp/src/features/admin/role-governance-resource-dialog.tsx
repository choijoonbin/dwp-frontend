import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import Stack from '@mui/material/Stack';

import {
  localizedCodeLabel,
  ROLE_RESOURCE_TYPES,
  resourceTypeLabel,
} from './role-governance-display';

export function RoleGovernanceResourceDialog({
  open,
  busy,
  onClose,
  onSave,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (request: { type: string; key: string; name: string }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [type, setType] = useState('APP');
  const [key, setKey] = useState('');
  const [name, setName] = useState('');

  return (
    <FormDialog
      open={open}
      title={t('roleGovernance.resourceDialog.title')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.create')}
      busy={busy}
      submitDisabled={!key.trim() || !name.trim()}
      onClose={onClose}
      onSubmit={() => onSave({ type, key: key.trim(), name: name.trim() })}
    >
      <Stack gap={2}>
        <SelectField
          label={t('roleGovernance.fields.resourceType')}
          value={type}
          options={ROLE_RESOURCE_TYPES.map((value) => ({
            value,
            label: localizedCodeLabel(resourceTypeLabel(value, t), value),
          }))}
          onValueChange={setType}
        />
        <FormField
          required
          label={t('roleGovernance.fields.resourceKey')}
          value={key}
          onChange={(event) => setKey(event.target.value)}
        />
        <FormField
          required
          label={t('roleGovernance.fields.name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Stack>
    </FormDialog>
  );
}
