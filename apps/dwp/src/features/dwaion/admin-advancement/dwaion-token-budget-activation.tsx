import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export type TokenBudgetActivationState = 'ENABLED' | 'DISABLED';

export function tokenBudgetEnforcementLabel(
  policyMode: 'WARN' | 'THROTTLE' | 'BLOCK',
  activationState: TokenBudgetActivationState,
  activeLabel: string,
  stagedLabel: string
) {
  return `${policyMode} · ${activationState === 'ENABLED' ? activeLabel : stagedLabel}`;
}

export function DwaionTokenBudgetActivationNotice({
  activationState,
  warning,
  recovery,
}: {
  activationState: TokenBudgetActivationState;
  warning: string;
  recovery: string;
}) {
  if (activationState === 'ENABLED') return null;
  return (
    <Alert severity="warning">
      <Stack spacing={0.25}>
        <Typography variant="body2" fontWeight={700}>
          {warning}
        </Typography>
        <Typography variant="caption">{recovery}</Typography>
      </Stack>
    </Alert>
  );
}
