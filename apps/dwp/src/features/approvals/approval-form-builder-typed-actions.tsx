import { useTranslation } from 'react-i18next';
import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';
import Stack from '@mui/material/Stack';
import {
  canDuplicateTypedEditorField,
  typedEditorFields,
} from './approval-form-builder-typed-model';
import type { ApprovalTypedFieldPath } from './approval-form-builder-typed-model';
import type { ApprovalTypedFormSchema } from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

export type ApprovalTypedFieldActionHandlers = {
  busy: boolean;
  onMove: (path: ApprovalTypedFieldPath, direction: -1 | 1) => void;
  onDuplicate: (path: ApprovalTypedFieldPath) => void;
  onRemove: (path: ApprovalTypedFieldPath) => void;
};

export function ApprovalTypedFieldActions({
  schema,
  path,
  busy,
  onMove,
  onDuplicate,
  onRemove,
}: ApprovalTypedFieldActionHandlers & {
  schema: ApprovalTypedFormSchema;
  path: ApprovalTypedFieldPath;
}) {
  const { t } = useTranslation('approvals');
  const fields = typedEditorFields(schema, path.length === 2 ? path[0] : undefined);
  const index = fields.findIndex((field) => field.key === path[path.length - 1]);
  const summary = path.length === 1 && path[0] === 'summary';
  return (
    <Stack direction="row" sx={{ flexShrink: 0 }}>
      <ActionIconButton
        size="small"
        label={t('admin.studio.moveUp')}
        tooltipDisablePortal
        disabled={busy || index <= 0}
        onClick={() => onMove(path, -1)}
      >
        <ArrowUp size={16} />
      </ActionIconButton>
      <ActionIconButton
        size="small"
        label={t('admin.studio.moveDown')}
        tooltipDisablePortal
        disabled={busy || index < 0 || index >= fields.length - 1}
        onClick={() => onMove(path, 1)}
      >
        <ArrowDown size={16} />
      </ActionIconButton>
      <ActionIconButton
        size="small"
        label={t('admin.typedForm.duplicateField')}
        tooltipDisablePortal
        disabled={busy || !canDuplicateTypedEditorField(schema, path)}
        onClick={() => onDuplicate(path)}
      >
        <Copy size={16} />
      </ActionIconButton>
      <ActionIconButton
        size="small"
        label={t('admin.studio.removeField')}
        tooltipDisablePortal
        intent="danger"
        disabled={busy || summary || index < 0 || fields.length <= 1}
        onClick={() => onRemove(path)}
      >
        <Trash2 size={16} />
      </ActionIconButton>
    </Stack>
  );
}
