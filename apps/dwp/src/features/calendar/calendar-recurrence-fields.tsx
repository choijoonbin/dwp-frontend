import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DatePickerField, FormField, SelectField } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';

import {
  CALENDAR_RECURRENCE_DAYS,
  calendarRecurrenceAnchorDay,
  calendarRecurrenceDaysForStart,
  calendarRecurrenceUntilIsValid,
  type CalendarRecurrenceDraftState,
  type CalendarRecurrenceEndMode,
} from './calendar-event-editor-model';

import type { CalendarDayOfWeek, CalendarRecurrence } from '@dwp-frontend/shared-utils';

export type CalendarRecurrenceDraft = CalendarRecurrenceDraftState;

export function CalendarRecurrenceFields({
  form,
  disabled = false,
  validationVisible = false,
  boundedRequired = false,
  onFormPatch,
}: Readonly<{
  form: CalendarRecurrenceDraft;
  disabled?: boolean;
  validationVisible?: boolean;
  boundedRequired?: boolean;
  onFormPatch: (patch: Partial<CalendarRecurrenceDraft>) => void;
}>) {
  const { t } = useTranslation('calendar');
  const anchorHintId = useId();
  const anchorDay = useMemo(
    () => calendarRecurrenceAnchorDay(form.startsAt, form.timeZone),
    [form.startsAt, form.timeZone]
  );
  const untilMissing = form.recurrenceEndMode === 'UNTIL' && !form.recurrenceUntil;
  const untilBeforeStart =
    form.recurrenceEndMode === 'UNTIL' &&
    Boolean(form.recurrenceUntil) &&
    !calendarRecurrenceUntilIsValid(form);
  const countInvalid =
    form.recurrenceEndMode === 'COUNT' &&
    (!Number.isInteger(form.recurrenceCount) ||
      form.recurrenceCount < 1 ||
      form.recurrenceCount > 4_000);
  const unboundedResource = boundedRequired && form.recurrenceEndMode === 'NEVER';

  return (
    <Stack spacing={2}>
      <SelectField<CalendarRecurrence>
        disabled={disabled}
        label={t('event.recurrenceLabel')}
        value={form.recurrence}
        options={(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const).map((value) => ({
          value,
          label: t(`event.recurrence.${value}`),
        }))}
        onValueChange={(value) => value && onFormPatch({ recurrence: value })}
      />

      {form.recurrence !== 'NONE' && (
        <>
          <SelectField<number>
            disabled={disabled}
            label={t('event.recurrenceIntervalLabel')}
            value={form.recurrenceInterval}
            options={[1, 2, 3, 4].map((value) => ({
              value,
              label: t(`event.recurrenceIntervals.${form.recurrence}`, { count: value }),
            }))}
            onValueChange={(value) => value && onFormPatch({ recurrenceInterval: Number(value) })}
          />

          {form.recurrence === 'WEEKLY' && (
            <Box component="fieldset" sx={{ m: 0, p: 0, border: 0, minWidth: 0 }}>
              <Typography component="legend" variant="caption" fontWeight={700} sx={{ mb: 0.75 }}>
                {t('event.recurrenceDaysLabel')}
              </Typography>
              <ToggleButtonGroup
                value={form.recurrenceDays}
                onChange={(_, values: CalendarDayOfWeek[]) =>
                  onFormPatch({
                    recurrenceDays: calendarRecurrenceDaysForStart(
                      values,
                      form.startsAt,
                      form.timeZone
                    ),
                  })
                }
                aria-label={t('event.recurrenceDaysLabel')}
                size="small"
                disabled={disabled}
                sx={{ display: 'flex', flexWrap: 'wrap' }}
              >
                {CALENDAR_RECURRENCE_DAYS.map((day) => (
                  <ToggleButton
                    key={day}
                    value={day}
                    aria-label={t(`settings.daysLong.${day}`)}
                    aria-describedby={day === anchorDay ? anchorHintId : undefined}
                    sx={{ flex: '1 1 4rem' }}
                  >
                    {t(`settings.days.${day}`)}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography
                id={anchorHintId}
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.75 }}
              >
                {t('event.recurrenceAnchorHint', {
                  day: t(`settings.daysLong.${anchorDay}`),
                })}
              </Typography>
            </Box>
          )}

          <SelectField<CalendarRecurrenceEndMode>
            disabled={disabled}
            label={t('event.recurrenceEndLabel')}
            value={form.recurrenceEndMode}
            options={(['NEVER', 'UNTIL', 'COUNT'] as const).map((value) => ({
              value,
              label: t(`event.recurrenceEnd.${value}`),
            }))}
            onValueChange={(value) => value && onFormPatch({ recurrenceEndMode: value })}
            errorMessage={
              validationVisible && unboundedResource
                ? t('event.resourceRecurrenceBoundRequired')
                : undefined
            }
          />

          {form.recurrenceEndMode === 'UNTIL' && (
            <DatePickerField
              disabled={disabled}
              label={t('event.recurrenceUntilLabel')}
              value={form.recurrenceUntil}
              onValueChange={(value) => onFormPatch({ recurrenceUntil: value ?? '' })}
              errorMessage={
                validationVisible && untilMissing
                  ? t('event.recurrenceUntilRequired')
                  : validationVisible && untilBeforeStart
                    ? t('event.recurrenceUntilBeforeStart')
                    : undefined
              }
            />
          )}

          {form.recurrenceEndMode === 'COUNT' && (
            <FormField
              disabled={disabled}
              type="number"
              label={t('event.recurrenceCountLabel')}
              value={form.recurrenceCount}
              onChange={(event) => onFormPatch({ recurrenceCount: Number(event.target.value) })}
              inputProps={{ min: 1, max: 4_000, step: 1, inputMode: 'numeric' }}
              errorMessage={
                validationVisible && countInvalid ? t('event.recurrenceCountError') : undefined
              }
            />
          )}
        </>
      )}
    </Stack>
  );
}
