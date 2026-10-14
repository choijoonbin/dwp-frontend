import { ActionButton } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { payrollCalculationCopyValue } from '../model/payroll-calculation-copy';

import type { PayrollCalculationRun } from '../model/payroll-calculation-contract';
import type { PayrollCalculationCopy } from '../model/payroll-calculation-copy';

export type PayrollCalculationRunListProps = Readonly<{
  runs: readonly PayrollCalculationRun[];
  selectedId: string | null;
  copy: PayrollCalculationCopy;
  disabled?: boolean;
  onSelect: (runId: string) => void;
}>;

function statusColor(state: PayrollCalculationRun['state']) {
  if (state === 'FAILED' || state === 'RESULT_UNKNOWN') return 'error' as const;
  if (state === 'CALCULATING' || state === 'PREPARING') return 'warning' as const;
  if (state === 'FINALIZED') return 'success' as const;
  return 'default' as const;
}

function shortId(value: string) {
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export function PayrollCalculationRunList({
  runs,
  selectedId,
  copy,
  disabled = false,
  onSelect,
}: PayrollCalculationRunListProps) {
  return (
    <Paper component="section" variant="outlined" sx={{ minWidth: 0, overflow: 'hidden' }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="baseline"
        gap={1}
        sx={{ p: 2 }}
      >
        <Typography component="h2" variant="h6">
          {copy.runs}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {payrollCalculationCopyValue(copy.runCount, { count: runs.length })}
        </Typography>
      </Stack>
      <Stack component="ul" sx={{ listStyle: 'none', m: 0, p: 1, pt: 0 }} gap={1}>
        {runs.map((run) => {
          const selected = run.runId === selectedId;
          return (
            <Box component="li" key={run.runId} minWidth={0}>
              <Paper
                variant="outlined"
                sx={{
                  p: 1.5,
                  minWidth: 0,
                  borderColor: selected ? 'primary.main' : 'divider',
                  bgcolor: selected ? 'action.selected' : 'background.paper',
                  '@media (forced-colors: active)': {
                    borderWidth: selected ? 3 : 1,
                  },
                }}
              >
                <Stack gap={1}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    gap={1}
                    alignItems="flex-start"
                  >
                    <Box minWidth={0}>
                      <Typography variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                        {run.runType.replace('_', ' ')} · {shortId(run.runId)}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ overflowWrap: 'anywhere' }}
                      >
                        {copy.payPeriod}: {shortId(run.payPeriodId)} · {copy.version} {run.version}
                      </Typography>
                    </Box>
                    <Chip size="small" color={statusColor(run.state)} label={run.state} />
                  </Stack>
                  <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ xs: 0.25, sm: 1 }}>
                    <Typography variant="caption">
                      {copy.workers}: {run.workerCount}
                    </Typography>
                    <Typography variant="caption">
                      {copy.net}: {run.net.amount} {run.net.currency}
                    </Typography>
                  </Stack>
                  <ActionButton
                    intent={selected ? 'quiet' : 'secondary'}
                    size="small"
                    disabled={disabled || selected}
                    onClick={() => onSelect(run.runId)}
                    aria-label={`${copy.inspect}: ${run.runType} ${shortId(run.runId)}`}
                    sx={{ alignSelf: { sm: 'flex-start' }, width: { xs: '100%', sm: 'auto' } }}
                  >
                    {selected ? copy.selected : copy.inspect}
                  </ActionButton>
                </Stack>
              </Paper>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}
