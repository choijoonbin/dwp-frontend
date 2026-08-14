import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { ActionIconButton, FormField, SelectField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ApprovalFormField } from '@dwp-frontend/shared-utils';

const FIELD_TYPE_OPTIONS = ['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'USER'].map(
  (value) => ({ value, label: value })
);

export function ApprovalFormFieldEditor({
  field,
  index,
  fieldCount,
  onChange,
  onRemove,
}: {
  field: ApprovalFormField;
  index: number;
  fieldCount: number;
  onChange: (value: ApprovalFormField) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation('approvals');
  const update = (patch: Partial<ApprovalFormField>) => onChange({ ...field, ...patch });

  return (
    <Box sx={{ p: 1.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
        <Typography variant="overline" color="text.secondary">
          {t('admin.studio.fieldOrdinal', { count: index + 1 })}
        </Typography>
        <ActionIconButton
          label={t('admin.studio.removeField')}
          size="small"
          intent="danger"
          disabled={fieldCount === 1}
          onClick={onRemove}
        >
          <Trash2 size={16} />
        </ActionIconButton>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1.15fr 1.15fr 140px 120px' },
          gap: 1,
        }}
      >
        <FormField
          size="small"
          label={t('admin.studio.fieldKey')}
          value={field.key}
          onChange={(event) => update({ key: event.target.value.replace(/[^A-Za-z0-9_]/g, '') })}
        />
        <FormField
          size="small"
          label={t('admin.studio.labelKo')}
          value={field.labelKo ?? ''}
          onChange={(event) => update({ labelKo: event.target.value })}
        />
        <FormField
          size="small"
          label={t('admin.studio.labelEn')}
          value={field.labelEn ?? ''}
          onChange={(event) => update({ labelEn: event.target.value })}
        />
        <SelectField
          size="small"
          label={t('admin.studio.fieldType')}
          value={field.type}
          options={FIELD_TYPE_OPTIONS}
          onValueChange={(value) => {
            if (!value) return;
            const type = value as ApprovalFormField['type'];
            update({
              type,
              options:
                type === 'SELECT'
                  ? field.options?.length
                    ? field.options
                    : ['OPTION_1', 'OPTION_2']
                  : [],
            });
          }}
        />
        <SelectField
          size="small"
          label={t('admin.studio.requirement')}
          value={field.required ? 'REQUIRED' : 'OPTIONAL'}
          options={[
            { value: 'REQUIRED', label: t('admin.studio.required') },
            { value: 'OPTIONAL', label: t('admin.studio.optional') },
          ]}
          onValueChange={(value) => update({ required: value === 'REQUIRED' })}
        />
      </Box>
      <Box
        sx={{
          mt: 1,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        <FormField
          size="small"
          label={t('admin.studio.helpKo')}
          value={field.helpKo ?? ''}
          onChange={(event) => update({ helpKo: event.target.value })}
          inputProps={{ maxLength: 500 }}
        />
        <FormField
          size="small"
          label={t('admin.studio.helpEn')}
          value={field.helpEn ?? ''}
          onChange={(event) => update({ helpEn: event.target.value })}
          inputProps={{ maxLength: 500 }}
        />
      </Box>
      {field.type === 'SELECT' && (
        <FormField
          size="small"
          fullWidth
          sx={{ mt: 1 }}
          label={t('admin.studio.options')}
          value={(field.options ?? []).join(', ')}
          onChange={(event) =>
            update({
              options: event.target.value
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
            })
          }
          supportingText={t('admin.studio.optionsHelp')}
        />
      )}
    </Box>
  );
}
