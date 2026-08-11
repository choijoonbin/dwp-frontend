import Box from '@mui/material/Box';

import { DatePickerField } from './date-picker-field';
import { isOrderedDateRange } from './date-time-policy';

import type { DatePickerFieldProps } from './date-picker-field';
import type { DateRangeValue } from './date-time-policy';

export type DateRangePickerFieldProps = {
  value: DateRangeValue;
  onValueChange: (value: DateRangeValue) => void;
  startLabel: string;
  endLabel: string;
  orderErrorMessage: string;
  supportingText?: string;
  errorMessage?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string | null;
  maxDate?: string | null;
  pickerProps?: Omit<
    DatePickerFieldProps,
    | 'disabled'
    | 'errorMessage'
    | 'label'
    | 'maxDate'
    | 'minDate'
    | 'onValueChange'
    | 'required'
    | 'supportingText'
    | 'value'
  >;
};

export function DateRangePickerField({
  value,
  onValueChange,
  startLabel,
  endLabel,
  orderErrorMessage,
  supportingText,
  errorMessage,
  required = false,
  disabled = false,
  minDate,
  maxDate,
  pickerProps,
}: DateRangePickerFieldProps) {
  const orderError = isOrderedDateRange(value) ? undefined : orderErrorMessage;
  return (
    <Box
      role="group"
      aria-label={`${startLabel} - ${endLabel}`}
      sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}
    >
      <DatePickerField
        {...pickerProps}
        label={startLabel}
        value={value.start}
        onValueChange={(start) => onValueChange({ ...value, start })}
        minDate={minDate}
        maxDate={value.end ?? maxDate}
        required={required}
        disabled={disabled}
        reserveFeedbackSpace
      />
      <DatePickerField
        {...pickerProps}
        label={endLabel}
        value={value.end}
        onValueChange={(end) => onValueChange({ ...value, end })}
        minDate={value.start ?? minDate}
        maxDate={maxDate}
        required={required}
        disabled={disabled}
        supportingText={supportingText}
        errorMessage={errorMessage ?? orderError}
        reserveFeedbackSpace
      />
    </Box>
  );
}
