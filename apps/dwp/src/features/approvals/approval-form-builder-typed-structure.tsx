import { useTranslation } from 'react-i18next';
import { ChevronRight, Layers, LockKeyhole, Plus } from 'lucide-react';
import { ActionIconButton } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import { alpha } from '@mui/material/styles';
import { approvalTone } from './approval-ui';
import type {
  ApprovalTypedField,
  ApprovalTypedFormSchema,
} from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';
import type { ApprovalTypedFieldPath } from './approval-form-builder-typed-model';

export function ApprovalTypedFormStructure({
  schema,
  selected,
  korean,
  onSelect,
  onAdd,
}: {
  schema: ApprovalTypedFormSchema;
  selected: ApprovalTypedFieldPath;
  korean: boolean;
  onSelect: (path: ApprovalTypedFieldPath) => void;
  onAdd: (anchor: HTMLElement, parent?: string) => void;
}) {
  const { t } = useTranslation('approvals');
  const item = (field: ApprovalTypedField, path: ApprovalTypedFieldPath, index: number) => {
    const active = selected.join('.') === path.join('.');
    return (
      <ButtonBase
        key={path.join('.')}
        aria-pressed={active}
        data-approval-typed-field={path.join('.')}
        onClick={() => onSelect(path)}
        sx={{
          width: 1,
          minHeight: 58,
          px: 1.5,
          py: 1,
          gap: 1,
          textAlign: 'left',
          justifyContent: 'flex-start',
          borderTop: 1,
          borderColor: 'divider',
          borderInlineStart: 3,
          borderInlineStartColor: active ? approvalTone.primary : 'transparent',
          bgcolor: active ? alpha(approvalTone.primary, 0.07) : 'transparent',
          pl: path.length === 2 ? 3 : 1.5,
        }}
      >
        <Box sx={{ typography: 'caption', color: 'text.secondary', minWidth: 20 }}>
          {String(index + 1).padStart(2, '0')}
        </Box>
        <Box minWidth={0} flex={1}>
          <Box sx={{ typography: 'body2', fontWeight: 'fontWeightBold', overflowWrap: 'anywhere' }}>
            {(korean ? field.labelKo : field.labelEn) || field.key}
          </Box>
          <Box sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}>
            {field.key} · {t(`admin.typedForm.fieldTypes.${field.type}`)}
          </Box>
        </Box>
        {path.length === 1 && field.key === 'summary' ? (
          <LockKeyhole size={14} />
        ) : (
          <ChevronRight size={14} />
        )}
      </ButtonBase>
    );
  };
  return (
    <Box
      component="section"
      aria-label={t('admin.studio.formFields')}
      sx={{ border: 1, borderColor: 'divider', bgcolor: 'background.paper', minWidth: 0 }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        sx={{ p: 1.5 }}
      >
        <Box sx={{ typography: 'subtitle2' }}>{t('admin.studio.formFields')}</Box>
        <ActionIconButton
          label={t('admin.studio.addField')}
          tooltipDisablePortal
          disabled={schema.fields.length >= 50}
          onClick={(event) => onAdd(event.currentTarget)}
        >
          <Plus size={16} />
        </ActionIconButton>
      </Stack>
      <Box
        component="ol"
        sx={{
          m: 0,
          p: 0,
          listStyle: 'none',
          maxHeight: { xs: 'none', md: 640 },
          overflowY: 'auto',
        }}
      >
        {schema.fields.map((field, index) => (
          <Box component="li" key={field.key}>
            {item(field, [field.key], index)}
            {field.type === 'REPEATING_GROUP' ? (
              <>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ pl: 3, pr: 1, py: 0.5 }}
                >
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Layers size={14} />
                    <Box sx={{ typography: 'caption', color: 'text.secondary' }}>
                      {t('admin.typedForm.rowField')}
                    </Box>
                  </Stack>
                  <ActionIconButton
                    size="small"
                    label={t('admin.typedForm.rowField')}
                    tooltipDisablePortal
                    disabled={field.fields.length >= 20}
                    onClick={(event) => onAdd(event.currentTarget, field.key)}
                  >
                    <Plus size={14} />
                  </ActionIconButton>
                </Stack>
                {field.fields.map((child, childIndex) =>
                  item(child, [field.key, child.key], childIndex)
                )}
              </>
            ) : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
