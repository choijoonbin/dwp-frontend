import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Smartphone, SlidersHorizontal } from 'lucide-react';
import { ActionIconButton, FormField, SelectField } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import type { ApprovalFormField } from '@dwp-frontend/shared-utils';
import type { LegacyFormDraft } from './approval-form-catalog-drafts';

export function ApprovalLegacyFormCanvas({
  draft,
  korean,
  selectedIndex,
  issueIndexes,
  onSelect,
}: {
  draft: LegacyFormDraft;
  korean: boolean;
  selectedIndex: number;
  issueIndexes: ReadonlySet<number>;
  onSelect: (index: number) => void;
}) {
  const { t } = useTranslation('approvals');
  const [mobilePreview, setMobilePreview] = useState(false);
  const [previewKorean, setPreviewKorean] = useState(korean);
  return (
    <Box
      component="section"
      aria-label={t('admin.studio.preview')}
      sx={{
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
        p: { xs: 1.5, sm: 2 },
      }}
    >
      <Stack direction="row" justifyContent="space-between" gap={1} flexWrap="wrap" sx={{ mb: 2 }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mobilePreview ? 'mobile' : 'desktop'}
          aria-label={t('admin.studio.preview')}
          onChange={(_, value: string | null) => value && setMobilePreview(value === 'mobile')}
        >
          <ToggleButton value="desktop" aria-label={t('admin.studio.previewDesktop')}>
            <Tooltip title={t('admin.studio.previewDesktop')}>
              <Monitor size={18} />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="mobile" aria-label={t('admin.studio.previewMobile')}>
            <Tooltip title={t('admin.studio.previewMobile')}>
              <Smartphone size={18} />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={previewKorean ? 'ko' : 'en'}
          aria-label={t('admin.studio.preview')}
          onChange={(_, value: string | null) => value && setPreviewKorean(value === 'ko')}
        >
          <ToggleButton value="ko" aria-label={t('admin.studio.previewKorean')}>
            {t('admin.studio.previewKorean')}
          </ToggleButton>
          <ToggleButton value="en" aria-label={t('admin.studio.previewEnglish')}>
            {t('admin.studio.previewEnglish')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Stack>
      <Box sx={{ width: 1, maxWidth: mobilePreview ? 390 : 'none', mx: 'auto', minWidth: 0 }}>
        <Box sx={{ typography: 'subtitle1', fontWeight: 'fontWeightBold' }}>
          {(previewKorean ? draft.nameKo : draft.nameEn) || draft.formKey}
        </Box>
        <Box sx={{ typography: 'caption', color: 'text.secondary', mb: 2 }}>
          {previewKorean ? draft.descriptionKo : draft.descriptionEn}
        </Box>
        <Stack gap={1.25}>
          {draft.fields.map((field, index) => (
            <Box
              key={`${field.key}-${index}`}
              sx={{
                width: 1,
                p: 1.25,
                border: 1,
                borderColor:
                  index === selectedIndex
                    ? 'primary.main'
                    : issueIndexes.has(index)
                      ? 'warning.main'
                      : 'divider',
                bgcolor: 'background.paper',
              }}
            >
              <Stack direction="row" justifyContent="flex-end" sx={{ mb: 0.5 }}>
                <ActionIconButton
                  label={t('admin.studio.fieldOrdinal', { count: index + 1 })}
                  size="small"
                  intent={index === selectedIndex ? 'primary' : 'default'}
                  onClick={() => onSelect(index)}
                >
                  <SlidersHorizontal size={15} />
                </ActionIconButton>
              </Stack>
              <PreviewField field={field} korean={previewKorean} />
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}

function PreviewField({ field, korean }: { field: ApprovalFormField; korean: boolean }) {
  const label = (korean ? field.labelKo : field.labelEn) || field.key;
  const supportingText = korean ? field.helpKo : field.helpEn;
  if (field.type === 'SELECT') {
    return (
      <SelectField
        size="small"
        required={field.required}
        label={label}
        value=""
        options={(field.options ?? []).map((option) => ({ value: option, label: option }))}
        supportingText={supportingText}
        slotProps={{
          select: {
            readOnly: true,
            // Preview samples must not participate in the definition's native submit validation.
            inputProps: { required: false },
            SelectDisplayProps: { 'aria-required': field.required, 'aria-readonly': true },
          },
        }}
        onValueChange={() => undefined}
      />
    );
  }
  return (
    <FormField
      size="small"
      fullWidth
      required={field.required}
      multiline={field.type === 'TEXTAREA'}
      minRows={field.type === 'TEXTAREA' ? 3 : undefined}
      type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
      label={label}
      supportingText={supportingText}
      slotProps={{ input: { readOnly: true } }}
      InputLabelProps={field.type === 'DATE' ? { shrink: true } : undefined}
    />
  );
}
