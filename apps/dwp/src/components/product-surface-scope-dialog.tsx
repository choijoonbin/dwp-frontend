import { FormDialog } from '@dwp-frontend/design-system/components/dialogs/form-dialog';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';

import MenuItem from '@mui/material/MenuItem';

import type { EffectiveScope } from '../features/shell/product-surface-context';

export default function ProductSurfaceScopeDialog({
  open,
  title,
  description,
  cancelLabel,
  submitLabel,
  scopeLabel,
  scopes,
  selectedScope,
  serverNowMs,
  readOnlyLabel,
  onSelectedScopeChange,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description: string;
  cancelLabel: string;
  submitLabel: string;
  scopeLabel: string;
  scopes: readonly EffectiveScope[];
  selectedScope: string;
  serverNowMs: number;
  readOnlyLabel: string;
  onSelectedScopeChange: (scopeKey: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <FormDialog
      open={open}
      title={title}
      description={description}
      cancelLabel={cancelLabel}
      submitLabel={submitLabel}
      submitDisabled={!selectedScope}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <FormField
        select
        label={scopeLabel}
        value={selectedScope}
        onChange={(event) => onSelectedScopeChange(event.target.value)}
      >
        {scopes.map((scope) => (
          <MenuItem
            key={scope.key}
            value={scope.key}
            disabled={scope.validUntil ? Date.parse(scope.validUntil) <= serverNowMs : false}
          >
            {scope.displayName}
            {scope.readOnly ? ` · ${readOnlyLabel}` : ''}
          </MenuItem>
        ))}
      </FormField>
    </FormDialog>
  );
}
