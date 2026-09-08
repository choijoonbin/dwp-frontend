import { FormField } from '@dwp-frontend/design-system';
import { useTranslation } from 'react-i18next';
import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import MenuItem from '@mui/material/MenuItem';
import type { ServiceRequestField } from '@dwp-frontend/shared-utils/api/service-center-api';
import { serviceRequestFieldLabel, serviceRequestOptionLabel } from './service-request-model';
import { serviceResponseFieldValid } from './service-information-response-model';

export function ServiceInformationResponseFields({
  fields,
  values,
  disabled,
  onChange,
}: {
  fields: ServiceRequestField[];
  values: Record<string, unknown>;
  disabled: boolean;
  onChange: (key: string, value: unknown) => void;
}) {
  const { t, i18n } = useTranslation('services');
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
        gap: 2,
      }}
    >
      {fields.map((field) => {
        const value = values[field.key];
        const label = serviceRequestFieldLabel(field, i18n.resolvedLanguage ?? i18n.language);
        if (field.type === 'CHECKBOX')
          return (
            <FormControlLabel
              key={field.key}
              label={label}
              required={field.required}
              control={
                <Checkbox
                  disabled={disabled}
                  checked={value === true}
                  onChange={(event) => onChange(field.key, event.target.checked)}
                />
              }
              sx={{ minHeight: 44 }}
            />
          );
        return (
          <FormField
            key={field.key}
            label={label}
            required={field.required}
            disabled={disabled}
            select={field.type === 'SELECT'}
            type={field.type === 'NUMBER' ? 'number' : field.type === 'DATE' ? 'date' : 'text'}
            multiline={field.type === 'TEXTAREA'}
            minRows={field.type === 'TEXTAREA' ? 3 : undefined}
            value={String(value ?? '')}
            sx={field.type === 'TEXTAREA' ? { gridColumn: '1 / -1' } : undefined}
            slotProps={field.type === 'DATE' ? { inputLabel: { shrink: true } } : undefined}
            errorMessage={
              serviceResponseFieldValid(field, value)
                ? undefined
                : t('informationResponse.fieldInvalid')
            }
            onChange={(event) =>
              onChange(
                field.key,
                field.type === 'NUMBER' && event.target.value !== ''
                  ? Number(event.target.value)
                  : event.target.value
              )
            }
          >
            {field.type === 'SELECT' && [
              <MenuItem key="empty" value="">
                {t('requestDialog.selectPlaceholder')}
              </MenuItem>,
              ...(field.options ?? []).map((option) => (
                <MenuItem key={option} value={option}>
                  {serviceRequestOptionLabel(option)}
                </MenuItem>
              )),
            ]}
          </FormField>
        );
      })}
    </Box>
  );
}
