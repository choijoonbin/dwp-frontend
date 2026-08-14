import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';

import { resolveFieldFeedback } from '../../components/forms';
import {
  dayjs,
  formatDateOnly,
  parseDateOnly,
  parseUtcDateTime,
  toUtcIso,
} from './date-time-policy';
import { DwpDatePickerProvider } from './date-picker-provider';
import { useDateTimePolicy } from './date-time-provider';

import type { DatePickerProps } from '@mui/x-date-pickers/DatePicker';
import type { DateTimePickerProps } from '@mui/x-date-pickers/DateTimePicker';
import type { TimePickerProps } from '@mui/x-date-pickers/TimePicker';
import type { TextFieldProps } from '@mui/material/TextField';
import type { FieldFeedbackProps } from '../../components/forms';

type PickerFieldContract = FieldFeedbackProps & {
  label: string;
  required?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  size?: TextFieldProps['size'];
};

export type DatePickerFieldProps = PickerFieldContract &
  Omit<
    DatePickerProps,
    'disabled' | 'label' | 'maxDate' | 'minDate' | 'onChange' | 'readOnly' | 'slotProps' | 'value'
  > & {
    value: string | null;
    onValueChange: (value: string | null) => void;
    minDate?: string | null;
    maxDate?: string | null;
  };

export function DatePickerField({
  label,
  value,
  onValueChange,
  minDate,
  maxDate,
  supportingText,
  errorMessage,
  reserveFeedbackSpace = false,
  required = false,
  fullWidth = true,
  disabled,
  readOnly,
  size,
  ...props
}: DatePickerFieldProps) {
  const { locale, timeZone } = useDateTimePolicy();
  return (
    <DwpDatePickerProvider>
      <DatePicker
        {...props}
        label={label}
        value={parseDateOnly(value, timeZone)}
        minDate={parseDateOnly(minDate, timeZone) ?? undefined}
        maxDate={parseDateOnly(maxDate, timeZone) ?? undefined}
        onChange={(next) => onValueChange(formatDateOnly(next))}
        disabled={disabled}
        readOnly={readOnly}
        timezone={timeZone}
        format={locale === 'ko' ? 'YYYY. MM. DD.' : 'MM/DD/YYYY'}
        slotProps={{
          textField: {
            fullWidth,
            size,
            required,
            error: Boolean(errorMessage),
            helperText: resolveFieldFeedback({
              errorMessage,
              supportingText,
              reserveFeedbackSpace,
            }),
          },
        }}
      />
    </DwpDatePickerProvider>
  );
}

export type DateTimePickerFieldProps = PickerFieldContract &
  Omit<
    DateTimePickerProps,
    'disabled' | 'label' | 'onChange' | 'readOnly' | 'slotProps' | 'timezone' | 'value'
  > & {
    value: string | null;
    onValueChange: (utcIsoValue: string | null) => void;
  };

export function DateTimePickerField({
  label,
  value,
  onValueChange,
  supportingText,
  errorMessage,
  reserveFeedbackSpace = false,
  required = false,
  fullWidth = true,
  disabled,
  readOnly,
  size,
  ...props
}: DateTimePickerFieldProps) {
  const { locale, timeZone } = useDateTimePolicy();
  return (
    <DwpDatePickerProvider>
      <DateTimePicker
        {...props}
        label={label}
        value={parseUtcDateTime(value)}
        onChange={(next) => onValueChange(toUtcIso(next))}
        disabled={disabled}
        readOnly={readOnly}
        timezone={timeZone}
        format={locale === 'ko' ? 'YYYY. MM. DD. HH:mm' : 'MM/DD/YYYY hh:mm A'}
        slotProps={{
          textField: {
            fullWidth,
            size,
            required,
            error: Boolean(errorMessage),
            helperText: resolveFieldFeedback({
              errorMessage,
              supportingText,
              reserveFeedbackSpace,
            }),
          },
        }}
      />
    </DwpDatePickerProvider>
  );
}

export type TimePickerFieldProps = PickerFieldContract &
  Omit<
    TimePickerProps,
    'disabled' | 'label' | 'onChange' | 'readOnly' | 'slotProps' | 'timezone' | 'value'
  > & {
    value: string | null;
    onValueChange: (localTimeValue: string | null) => void;
  };

export function TimePickerField({
  label,
  value,
  onValueChange,
  supportingText,
  errorMessage,
  reserveFeedbackSpace = false,
  required = false,
  fullWidth = true,
  disabled,
  readOnly,
  size,
  ...props
}: TimePickerFieldProps) {
  const { locale, timeZone } = useDateTimePolicy();
  const parsed = value
    ? dayjs.tz(`2000-01-01 ${value.slice(0, 5)}`, 'YYYY-MM-DD HH:mm', timeZone)
    : null;
  return (
    <DwpDatePickerProvider>
      <TimePicker
        {...props}
        label={label}
        value={parsed?.isValid() ? parsed : null}
        onChange={(next) => onValueChange(next?.isValid() ? next.format('HH:mm:ss') : null)}
        disabled={disabled}
        readOnly={readOnly}
        timezone={timeZone}
        format={locale === 'ko' ? 'HH:mm' : 'hh:mm A'}
        slotProps={{
          textField: {
            fullWidth,
            size,
            required,
            error: Boolean(errorMessage),
            helperText: resolveFieldFeedback({
              errorMessage,
              supportingText,
              reserveFeedbackSpace,
            }),
          },
        }}
      />
    </DwpDatePickerProvider>
  );
}
