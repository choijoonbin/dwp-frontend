import TextField from '@mui/material/TextField';

import type { TextFieldProps } from '@mui/material/TextField';

export type FieldFeedbackProps = {
  supportingText?: React.ReactNode;
  errorMessage?: React.ReactNode;
  reserveFeedbackSpace?: boolean;
};

export type FormFieldProps = Omit<TextFieldProps, 'error' | 'helperText'> & FieldFeedbackProps;

export function resolveFieldFeedback({
  errorMessage,
  supportingText,
  reserveFeedbackSpace,
}: FieldFeedbackProps): React.ReactNode {
  return errorMessage ?? supportingText ?? (reserveFeedbackSpace ? ' ' : undefined);
}

export function FormField({
  supportingText,
  errorMessage,
  reserveFeedbackSpace = false,
  fullWidth = true,
  ...props
}: FormFieldProps) {
  return (
    <TextField
      {...props}
      fullWidth={fullWidth}
      error={Boolean(errorMessage)}
      helperText={resolveFieldFeedback({ errorMessage, supportingText, reserveFeedbackSpace })}
    />
  );
}
