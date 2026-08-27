import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormDialog, FormField, SelectField } from '@dwp-frontend/design-system';

import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';

import type { CreateGovernanceRoleRequest, GovernanceRole } from '@dwp-frontend/shared-utils';

export type RoleGovernanceRoleDraft = {
  code: string;
  name: string;
  description: string;
  status: string;
  assignableToGroups: boolean;
};

export function canSubmitRoleGovernanceDraft(
  draft: Pick<RoleGovernanceRoleDraft, 'code' | 'name'>,
  busy: boolean
) {
  return !busy && Boolean(draft.code.trim()) && Boolean(draft.name.trim());
}

export function roleGovernanceDraftRequest(
  draft: RoleGovernanceRoleDraft
): CreateGovernanceRoleRequest & { status: string } {
  return {
    code: draft.code.trim(),
    name: draft.name.trim(),
    description: draft.description.trim(),
    status: draft.status,
    privileged: false,
    assignableToGroups: draft.assignableToGroups,
  };
}

export function RoleGovernanceRoleDialog({
  role,
  open,
  busy,
  onClose,
  onSave,
}: {
  role: GovernanceRole | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (request: CreateGovernanceRoleRequest & { status: string }) => Promise<void>;
}) {
  const { t } = useTranslation('admin');
  const [code, setCode] = useState(role?.code ?? '');
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [status, setStatus] = useState(role?.status ?? 'ACTIVE');
  const [assignableToGroups, setAssignableToGroups] = useState(role?.assignableToGroups ?? true);
  const draft = { code, name, description, status, assignableToGroups };

  return (
    <FormDialog
      open={open}
      title={t(role ? 'roleGovernance.roleDialog.edit' : 'roleGovernance.roleDialog.create')}
      cancelLabel={t('common.actions.cancel')}
      submitLabel={t('common.actions.save')}
      busy={busy}
      submitDisabled={!canSubmitRoleGovernanceDraft(draft, busy)}
      onClose={onClose}
      onSubmit={() => onSave(roleGovernanceDraftRequest(draft))}
    >
      <Stack gap={2}>
        <FormField
          autoFocus
          required
          disabled={Boolean(role)}
          label={t('roleGovernance.fields.code')}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <FormField
          required
          label={t('roleGovernance.fields.name')}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <FormField
          multiline
          minRows={2}
          label={t('roleGovernance.fields.description')}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {role ? (
          <SelectField
            label={t('roleGovernance.fields.status')}
            value={status}
            options={[
              { value: 'ACTIVE', label: t('common.status.ACTIVE') },
              { value: 'INACTIVE', label: t('common.status.INACTIVE') },
            ]}
            onValueChange={setStatus}
          />
        ) : null}
        <FormControlLabel
          control={
            <Checkbox
              checked={assignableToGroups}
              onChange={(event) => setAssignableToGroups(event.target.checked)}
            />
          }
          label={t('roleGovernance.fields.assignableToGroups')}
        />
      </Stack>
    </FormDialog>
  );
}
