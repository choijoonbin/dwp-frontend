import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DatePickerField, FormField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { ApprovalFormField } from '@dwp-frontend/shared-utils';

type ApprovalInformationResponseFieldsProps = {
  responseMessage: string;
  responsePayload: Record<string, string>;
  responseFields: ApprovalFormField[];
  detailReady: boolean;
  korean: boolean;
  detailStatus?: ReactNode;
  onResponseMessageChange: (value: string) => void;
  onResponsePayloadChange: (key: string, value: string) => void;
};

export function ApprovalInformationResponseFields({
  responseMessage,
  responsePayload,
  responseFields,
  detailReady,
  korean,
  detailStatus,
  onResponseMessageChange,
  onResponsePayloadChange,
}: ApprovalInformationResponseFieldsProps) {
  const { t } = useTranslation('approvals');

  return (
    <Stack gap={2}>
      <FormField
        autoFocus
        required
        multiline
        minRows={4}
        label={t('requests.responseLabel')}
        supportingText={t('requests.responseHelp')}
        value={responseMessage}
        onChange={(event) => onResponseMessageChange(event.target.value)}
        inputProps={{ maxLength: 2000 }}
      />
      <Box>
        <Typography component="h3" variant="subtitle2">
          {t('requests.amendmentTitle')}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('requests.amendmentHelp')}
        </Typography>
      </Box>
      {detailStatus}
      {detailReady && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.25,
          }}
        >
          {responseFields.map((field) => {
            const label = korean
              ? (field.labelKo ?? t(`requestFields.${field.key}`, { defaultValue: field.key }))
              : (field.labelEn ?? t(`requestFields.${field.key}`, { defaultValue: field.key }));
            const help = korean ? field.helpKo : field.helpEn;
            const value = responsePayload[field.key] ?? '';
            const setValue = (next: string) => onResponsePayloadChange(field.key, next);
            if (field.type === 'SELECT') {
              const labelId = `approval-amendment-${field.key}-label`;
              return (
                <FormControl key={field.key} fullWidth required={field.required}>
                  <InputLabel id={labelId}>{label}</InputLabel>
                  <Select
                    id={`approval-amendment-${field.key}`}
                    labelId={labelId}
                    label={label}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                  >
                    {(field.options ?? []).map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>{help || t('requests.template.fieldHelp.SELECT')}</FormHelperText>
                </FormControl>
              );
            }
            if (field.type === 'DATE') {
              return (
                <DatePickerField
                  key={field.key}
                  required={field.required}
                  label={label}
                  value={value || null}
                  onValueChange={(next) => setValue(next ?? '')}
                  supportingText={help}
                />
              );
            }
            return (
              <FormField
                key={field.key}
                required={field.required}
                multiline={field.type === 'TEXTAREA'}
                minRows={field.type === 'TEXTAREA' ? 3 : undefined}
                type={field.type === 'NUMBER' ? 'number' : 'text'}
                label={label}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                supportingText={
                  help ||
                  (field.type === 'USER' ? t('requests.template.fieldHelp.USER') : undefined)
                }
              />
            );
          })}
        </Box>
      )}
    </Stack>
  );
}
