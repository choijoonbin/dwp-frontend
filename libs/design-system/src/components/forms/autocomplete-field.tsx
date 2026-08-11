import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';

import { resolveFieldFeedback } from './form-field';

import type { AutocompleteProps } from '@mui/material/Autocomplete';
import type { TextFieldProps } from '@mui/material/TextField';
import type { FieldFeedbackProps } from './form-field';

export type AutocompleteFieldProps<T> = Omit<
  AutocompleteProps<T, false, false, false>,
  'renderInput'
> &
  FieldFeedbackProps & {
    label: string;
    required?: boolean;
    textFieldProps?: Omit<TextFieldProps, 'error' | 'helperText' | 'label' | 'required'>;
  };

export function AutocompleteField<T>({
  label,
  required = false,
  supportingText,
  errorMessage,
  reserveFeedbackSpace = false,
  textFieldProps,
  ...props
}: AutocompleteFieldProps<T>) {
  return (
    <Autocomplete
      {...props}
      renderInput={(params) => (
        <TextField
          {...params}
          {...textFieldProps}
          fullWidth={textFieldProps?.fullWidth ?? true}
          label={label}
          required={required}
          error={Boolean(errorMessage)}
          helperText={resolveFieldFeedback({ errorMessage, supportingText, reserveFeedbackSpace })}
        />
      )}
    />
  );
}
