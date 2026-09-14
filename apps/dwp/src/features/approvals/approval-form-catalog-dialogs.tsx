import { useTranslation } from 'react-i18next';
import { FormDialog, FormField } from '@dwp-frontend/design-system';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';

import type { ApprovalFormCategory } from '@dwp-frontend/shared-utils';
import type { CategoryDraft } from './approval-form-catalog-drafts';

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
  const korean = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language) === 'ko';
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
