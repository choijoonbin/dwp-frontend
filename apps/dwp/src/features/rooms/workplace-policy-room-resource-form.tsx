import { useTranslation } from 'react-i18next';
import { FormField, SelectField } from '@dwp-frontend/design-system';
import { resolveZonedClock } from '@dwp-frontend/shared-i18n';
import type { CalendarResourceInput } from '@dwp-frontend/shared-utils';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

export function roomResourceInputIsValid(input: CalendarResourceInput | null) {
  if (
    !input ||
    !/^[A-Z0-9][A-Z0-9_-]{2,79}$/.test(input.code) ||
    !input.nameKo.trim() ||
    !input.nameEn.trim() ||
    !input.site.trim() ||
    input.nameKo.length > 160 ||
    input.nameEn.length > 160 ||
    input.site.length > 160 ||
    (input.floor?.length ?? 0) > 80 ||
    input.features.length > 50 ||
    input.features.some((value) => !value.trim() || value.length > 60) ||
    !Number.isInteger(input.capacity) ||
    input.capacity < 1 ||
    input.capacity > 10000
  )
    return false;
  return input.timeZone.length <= 80 && Boolean(resolveZonedClock(new Date(0), input.timeZone));
}

export function WorkplacePolicyRoomResourceForm({
  input,
  disabled,
  onChange,
}: {
  input: CalendarResourceInput;
  disabled: boolean;
  onChange: (input: CalendarResourceInput) => void;
}) {
  const { t } = useTranslation('rooms');
  const patch = <K extends keyof CalendarResourceInput>(key: K, value: CalendarResourceInput[K]) =>
    onChange({ ...input, [key]: value });
  return (
    <Stack gap={2}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
        }}
      >
        <FormField
          label={t('admin.resources.code')}
          value={input.code}
          disabled={disabled}
          required
          inputProps={{ maxLength: 80 }}
          onChange={(event) => patch('code', event.target.value.toUpperCase())}
        />
        <FormField
          label={t('admin.resources.site')}
          value={input.site}
          disabled={disabled}
          required
          inputProps={{ maxLength: 160 }}
          onChange={(event) => patch('site', event.target.value)}
        />
        <FormField
          label={t('admin.resources.nameKo')}
          value={input.nameKo}
          disabled={disabled}
          required
          inputProps={{ maxLength: 160 }}
          onChange={(event) => patch('nameKo', event.target.value)}
        />
        <FormField
          label={t('admin.resources.nameEn')}
          value={input.nameEn}
          disabled={disabled}
          required
          inputProps={{ maxLength: 160 }}
          onChange={(event) => patch('nameEn', event.target.value)}
        />
        <FormField
          label={t('admin.resources.floor')}
          value={input.floor ?? ''}
          disabled={disabled}
          inputProps={{ maxLength: 80 }}
          onChange={(event) => patch('floor', event.target.value || null)}
        />
        <FormField
          type="number"
          label={t('admin.resources.capacity')}
          value={input.capacity}
          disabled={disabled}
          required
          inputProps={{ min: 1, max: 10000 }}
          onChange={(event) => patch('capacity', Number(event.target.value))}
        />
        <FormField
          label={t('admin.resources.timeZone')}
          value={input.timeZone}
          disabled={disabled}
          required
          inputProps={{ maxLength: 80 }}
          onChange={(event) => patch('timeZone', event.target.value)}
        />
        <SelectField
          label={t('admin.resources.state')}
          value={input.state}
          disabled={disabled}
          options={(['AVAILABLE', 'MAINTENANCE', 'RETIRED'] as const).map((value) => ({
            value,
            label: t(`admin.resources.states.${value}`),
          }))}
          onValueChange={(value) => patch('state', value as CalendarResourceInput['state'])}
        />
      </Box>
      <FormField
        label={t('admin.resources.features')}
        value={input.features.join(', ')}
        supportingText={t('admin.resources.featuresHint')}
        disabled={disabled}
        onChange={(event) =>
          patch(
            'features',
            event.target.value
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean)
          )
        }
      />
      <SelectField
        label={t('admin.resources.approvalRequired')}
        value={input.approvalRequired ? 'true' : 'false'}
        disabled={disabled}
        options={[
          { value: 'true', label: t('workplace.admin.policy.enabled') },
          { value: 'false', label: t('workplace.admin.policy.disabled') },
        ]}
        onValueChange={(value) => patch('approvalRequired', value === 'true')}
      />
    </Stack>
  );
}
