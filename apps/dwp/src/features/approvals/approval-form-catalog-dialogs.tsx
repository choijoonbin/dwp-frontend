import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import { ActionButton, FormDialog, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ApprovalFormFieldEditor } from './approval-form-field-editor';
import { StatusChip } from './approval-ui';

import type { ApprovalFormCategory, ApprovalWorkflow } from '@dwp-frontend/shared-utils';
import type { CategoryDraft, FormDraft } from './approval-form-catalog-drafts';

export function FormEditorDialog({
  open,
  creating,
  draft,
  categories,
  workflows,
  valid,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  creating: boolean;
  draft: FormDraft;
  categories: ApprovalFormCategory[];
  workflows: ApprovalWorkflow[];
  valid: boolean;
  busy: boolean;
  onChange: (draft: FormDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const korean = i18n.resolvedLanguage?.startsWith('ko');
  return (
    <FormDialog
      open={open}
      title={t(
        creating ? 'admin.formCatalog.editor.createTitle' : 'admin.formCatalog.editor.editTitle'
      )}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.save')}
      busy={busy}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={onSave}
      maxWidth="lg"
    >
      <Stack gap={2.25}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' },
            gap: 1.5,
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
            <InputLabel id="approval-form-category-label">
              {t('admin.formCatalog.editor.category')}
            </InputLabel>
            <Select
              id="approval-form-category"
              labelId="approval-form-category-label"
              label={t('admin.formCatalog.editor.category')}
              value={draft.categoryId}
              onChange={(event) => onChange({ ...draft, categoryId: event.target.value })}
            >
              {categories
                .filter((item) => item.lifecycleState === 'ACTIVE')
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
            minRows={3}
            label={t('admin.studio.descriptionKo')}
            value={draft.descriptionKo}
            onChange={(event) => onChange({ ...draft, descriptionKo: event.target.value })}
          />
          <FormField
            required
            multiline
            minRows={3}
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
            <InputLabel id="approval-form-default-route-label">
              {t('admin.formCatalog.editor.defaultRoute')}
            </InputLabel>
            <Select
              id="approval-form-default-route"
              labelId="approval-form-default-route-label"
              label={t('admin.formCatalog.editor.defaultRoute')}
              value={draft.defaultWorkflowId}
              onChange={(event) => onChange({ ...draft, defaultWorkflowId: event.target.value })}
            >
              {workflows.map((workflow) => (
                <MenuItem key={workflow.workflowId} value={workflow.workflowId}>
                  <Stack direction="row" gap={1} alignItems="center">
                    <Typography variant="body2">
                      {korean ? workflow.nameKo : workflow.nameEn}
                    </Typography>
                    <StatusChip status={workflow.lifecycleState} />
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography component="p" variant="subtitle2">
              {t('admin.studio.formFields')}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {t('admin.studio.fieldKeyNotice')}
            </Typography>
          </Box>
          <ActionButton
            intent="quiet"
            size="small"
            startIcon={<Plus size={16} />}
            onClick={() =>
              onChange({
                ...draft,
                fields: [
                  ...draft.fields,
                  {
                    key: `field${draft.fields.length + 1}`,
                    labelKo: `필드 ${draft.fields.length + 1}`,
                    labelEn: `Field ${draft.fields.length + 1}`,
                    helpKo: '',
                    helpEn: '',
                    type: 'TEXT',
                    required: false,
                    options: [],
                  },
                ],
              })
            }
          >
            {t('admin.studio.addField')}
          </ActionButton>
        </Stack>
        <Stack gap={1.25}>
          {draft.fields.map((field, index) => (
            <ApprovalFormFieldEditor
              key={`${field.key}-${index}`}
              field={field}
              index={index}
              fieldCount={draft.fields.length}
              onChange={(value) =>
                onChange({
                  ...draft,
                  fields: draft.fields.map((item, itemIndex) =>
                    itemIndex === index ? value : item
                  ),
                })
              }
              onRemove={() =>
                onChange({
                  ...draft,
                  fields: draft.fields.filter((_, itemIndex) => itemIndex !== index),
                })
              }
            />
          ))}
        </Stack>
      </Stack>
    </FormDialog>
  );
}

export function CategoryEditorDialog({
  open,
  editing,
  draft,
  categories,
  valid,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: boolean;
  draft: CategoryDraft;
  categories: ApprovalFormCategory[];
  valid: boolean;
  busy: boolean;
  onChange: (draft: CategoryDraft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const { t, i18n } = useTranslation('approvals');
  const korean = i18n.resolvedLanguage?.startsWith('ko');
  return (
    <FormDialog
      open={open}
      title={t(
        editing
          ? 'admin.formCatalog.categoryEditor.editTitle'
          : 'admin.formCatalog.categoryEditor.createTitle'
      )}
      cancelLabel={t('actions.cancel')}
      submitLabel={t('actions.save')}
      submittingLabel={t('actions.save')}
      busy={busy}
      submitDisabled={!valid}
      onClose={onClose}
      onSubmit={onSave}
      maxWidth="sm"
    >
      <Stack gap={1.5}>
        <FormField
          required
          disabled={editing}
          label={t('admin.formCatalog.categoryEditor.key')}
          value={draft.categoryKey}
          onChange={(event) =>
            onChange({
              ...draft,
              categoryKey: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''),
            })
          }
        />
        <FormControl fullWidth>
          <InputLabel id="approval-category-parent-label">
            {t('admin.formCatalog.categoryEditor.parent')}
          </InputLabel>
          <Select
            id="approval-category-parent"
            labelId="approval-category-parent-label"
            label={t('admin.formCatalog.categoryEditor.parent')}
            value={draft.parentCategoryId}
            onChange={(event) => onChange({ ...draft, parentCategoryId: event.target.value })}
          >
            <MenuItem value="">{t('admin.formCatalog.categoryEditor.root')}</MenuItem>
            {categories.map((category) => (
              <MenuItem key={category.categoryId} value={category.categoryId}>
                {korean ? category.nameKo : category.nameEn}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' },
            gap: 1.5,
          }}
        >
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
        </Box>
        <FormField
          multiline
          minRows={2}
          label={t('admin.studio.descriptionKo')}
          value={draft.descriptionKo}
          onChange={(event) => onChange({ ...draft, descriptionKo: event.target.value })}
        />
        <FormField
          multiline
          minRows={2}
          label={t('admin.studio.descriptionEn')}
          value={draft.descriptionEn}
          onChange={(event) => onChange({ ...draft, descriptionEn: event.target.value })}
        />
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 140px', gap: 1.5 }}>
          <FormField
            required
            label={t('admin.formCatalog.categoryEditor.icon')}
            value={draft.iconKey}
            onChange={(event) =>
              onChange({
                ...draft,
                iconKey: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
              })
            }
          />
          <FormField
            required
            type="number"
            label={t('admin.formCatalog.categoryEditor.order')}
            value={String(draft.sortOrder)}
            onChange={(event) => onChange({ ...draft, sortOrder: Number(event.target.value) })}
          />
        </Box>
        {editing && (
          <FormControl fullWidth>
            <InputLabel id="approval-category-status-label">
              {t('admin.formCatalog.categoryEditor.status')}
            </InputLabel>
            <Select
              id="approval-category-status"
              labelId="approval-category-status-label"
              label={t('admin.formCatalog.categoryEditor.status')}
              value={draft.lifecycleState}
              onChange={(event) =>
                onChange({
                  ...draft,
                  lifecycleState: event.target.value as CategoryDraft['lifecycleState'],
                })
              }
            >
              <MenuItem value="ACTIVE">{t('admin.formCatalog.categoryEditor.active')}</MenuItem>
              <MenuItem value="INACTIVE">{t('admin.formCatalog.categoryEditor.inactive')}</MenuItem>
            </Select>
          </FormControl>
        )}
      </Stack>
    </FormDialog>
  );
}
