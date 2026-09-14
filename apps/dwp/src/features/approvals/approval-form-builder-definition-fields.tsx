import { useTranslation } from 'react-i18next';
import { FormField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import { StatusChip } from './approval-ui';
import type { ApprovalFormCategory, ApprovalWorkflow } from '@dwp-frontend/shared-utils';
import type { FormDraft } from './approval-form-catalog-drafts';

export function ApprovalFormDefinitionFields({
  creating,
  draft,
  categories,
  workflows,
  korean,
  onChange,
}: {
  creating: boolean;
  draft: FormDraft;
  categories: ApprovalFormCategory[];
  workflows: ApprovalWorkflow[];
  korean: boolean;
  onChange: (draft: FormDraft) => void;
}) {
  const { t } = useTranslation('approvals');
  return (
    <Box
      component="section"
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', md: 'repeat(4,minmax(0,1fr))' },
        gap: 1.25,
      }}
    >
      <FormField
        required
        disabled={!creating}
        label={t('admin.formCatalog.editor.formKey')}
        value={draft.formKey}
        onChange={(event) =>
          onChange({
            ...draft,
            formKey: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
          })
        }
      />
      <FormControl fullWidth required>
        <InputLabel id="approval-builder-category-label">
          {t('admin.formCatalog.editor.category')}
        </InputLabel>
        <Select
          id="approval-builder-category"
          labelId="approval-builder-category-label"
          label={t('admin.formCatalog.editor.category')}
          value={draft.categoryId}
          onChange={(event) => onChange({ ...draft, categoryId: event.target.value })}
        >
          {categories
            .filter((category) => category.lifecycleState === 'ACTIVE')
            .map((category) => (
              <MenuItem key={category.categoryId} value={category.categoryId}>
                {korean ? category.nameKo : category.nameEn}
              </MenuItem>
            ))}
        </Select>
      </FormControl>
      <FormField
        required
        label={t('admin.studio.nameKo')}
        value={draft.nameKo}
        onChange={(event) => onChange({ ...draft, nameKo: event.target.value })}
      />
      <FormField
        required
        label={t('admin.studio.nameEn')}
        value={draft.nameEn}
        onChange={(event) => onChange({ ...draft, nameEn: event.target.value })}
      />
      <FormField
        required
        multiline
        minRows={2}
        label={t('admin.studio.descriptionKo')}
        value={draft.descriptionKo}
        onChange={(event) => onChange({ ...draft, descriptionKo: event.target.value })}
      />
      <FormField
        required
        multiline
        minRows={2}
        label={t('admin.studio.descriptionEn')}
        value={draft.descriptionEn}
        onChange={(event) => onChange({ ...draft, descriptionEn: event.target.value })}
      />
      <FormField
        required
        label={t('admin.formCatalog.editor.owner')}
        value={draft.ownerGroupRef}
        onChange={(event) =>
          onChange({
            ...draft,
            ownerGroupRef: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
          })
        }
      />
      <FormControl fullWidth required>
        <InputLabel id="approval-builder-route-label">
          {t('admin.formCatalog.editor.defaultRoute')}
        </InputLabel>
        <Select
          id="approval-builder-route"
          labelId="approval-builder-route-label"
          label={t('admin.formCatalog.editor.defaultRoute')}
          value={draft.defaultWorkflowId}
          onChange={(event) => onChange({ ...draft, defaultWorkflowId: event.target.value })}
        >
          {workflows.map((workflow) => (
            <MenuItem key={workflow.workflowId} value={workflow.workflowId}>
              <Stack direction="row" gap={1} alignItems="center">
                <Box sx={{ typography: 'body2' }}>{korean ? workflow.nameKo : workflow.nameEn}</Box>
                <StatusChip status={workflow.lifecycleState} />
              </Stack>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}
