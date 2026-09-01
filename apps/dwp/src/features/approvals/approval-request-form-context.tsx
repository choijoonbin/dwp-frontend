import { ActionButton } from '@dwp-frontend/design-system';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';

import type { ApprovalForm } from '@dwp-frontend/shared-utils';

export function ApprovalQueryErrorAlert({
  message,
  retryLabel,
  retrying,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <Alert
      severity="error"
      action={
        <ActionButton
          type="button"
          intent="quiet"
          size="small"
          disabled={retrying}
          onClick={onRetry}
        >
          {retryLabel}
        </ActionButton>
      }
    >
      {message}
    </Alert>
  );
}

export function PublishedApprovalFormSelector({
  forms,
  value,
  label,
  korean,
  disabled,
  onChange,
}: {
  forms: ApprovalForm[];
  value: string;
  label: string;
  korean: boolean;
  disabled: boolean;
  onChange: (formId: string) => void;
}) {
  return (
    <FormControl fullWidth required disabled={disabled}>
      <InputLabel id="approval-request-form-label">{label}</InputLabel>
      <Select
        id="approval-request-form"
        labelId="approval-request-form-label"
        label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {forms.map((form) => (
          <MenuItem key={form.formId} value={form.formId}>
            <Box minWidth={0}>
              <Typography variant="body2" fontWeight={720}>
                {korean ? form.nameKo : form.nameEn}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {korean ? form.categoryNameKo : form.categoryNameEn}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function PublishedApprovalTemplateSummary({
  processLabel,
  processValue,
  slaLabel,
  slaValue,
  formLabel,
  formValue,
}: {
  processLabel: string;
  processValue: string;
  slaLabel: string;
  slaValue: string;
  formLabel: string;
  formValue: string;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.default',
      }}
    >
      {[
        [processLabel, processValue],
        [slaLabel, slaValue],
        [formLabel, formValue],
      ].map(([label, value]) => (
        <Box key={label} sx={{ p: 1.5, borderRight: { sm: 1 }, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography variant="body2" fontWeight={740} sx={{ mt: 0.35 }}>
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
