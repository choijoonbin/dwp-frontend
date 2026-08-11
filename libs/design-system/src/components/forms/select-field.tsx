import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

import { resolveFieldFeedback } from './form-field';

import type { TextFieldProps } from '@mui/material/TextField';
import type { FieldFeedbackProps } from './form-field';

export type SelectValue = string | number;

export type SelectFieldOption<T extends SelectValue = string> = {
  value: T;
  label: React.ReactNode;
  disabled?: boolean;
};

export type SelectFieldProps<T extends SelectValue = string> = Omit<
  TextFieldProps,
  'children' | 'error' | 'helperText' | 'onChange' | 'select' | 'value'
> &
  FieldFeedbackProps & {
    value: T | '';
    options: readonly SelectFieldOption<T>[];
    onValueChange: (value: T | '') => void;
    placeholder?: string;
  };

export function SelectField<T extends SelectValue = string>({
  value,
  options,
  onValueChange,
  placeholder,
  supportingText,
  errorMessage,
  reserveFeedbackSpace = false,
  fullWidth = true,
  ...props
}: SelectFieldProps<T>) {
  return (
    <TextField
      {...props}
      select
      fullWidth={fullWidth}
      value={value}
      error={Boolean(errorMessage)}
      helperText={resolveFieldFeedback({ errorMessage, supportingText, reserveFeedbackSpace })}
      onChange={(event) => onValueChange(event.target.value as T | '')}
    >
      {placeholder && (
        <MenuItem value="" disabled>
          {placeholder}
        </MenuItem>
      )}
      {options.map((option) => (
        <MenuItem key={String(option.value)} value={option.value} disabled={option.disabled}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
