/**
 * Case Detail Simulation Before/After Diff Viewer
 * API 응답 before/after를 필드별 diff 하이라이트로 표시
 */

import type { Theme, SxProps } from '@mui/material/styles';
import type { CaseSimulationResponse } from '@dwp-frontend/shared-utils';

import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

// ----------------------------------------------------------------------

export type CaseSimulationDiffProps = {
  result: CaseSimulationResponse | null | undefined;
  isLoading: boolean;
  onRunSimulation: () => void;
  sx?: SxProps<Theme>;
};

function renderDiffRows(before: Record<string, unknown>, after: Record<string, unknown>) {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const rows: Array<{ key: string; beforeVal: unknown; afterVal: unknown; changed: boolean }> = [];

  allKeys.forEach((key) => {
    const beforeVal = before[key];
    const afterVal = after[key];
    const changed = JSON.stringify(beforeVal) !== JSON.stringify(afterVal);
    rows.push({ key, beforeVal, afterVal, changed });
  });

  return rows;
}

export const CaseSimulationDiff = ({ result, isLoading, onRunSimulation, sx }: CaseSimulationDiffProps) => {
  if (!result) {
    return (
      <Box sx={{ p: 2, ...sx }}>
        <Card variant="outlined" sx={{ bgcolor: 'action.hover' }}>
          <CardContent sx={{ p: 4, textAlign: 'center' }}>
            <Iconify
              icon="solar:play-circle-bold-duotone"
              width={40}
              sx={{ color: 'primary.main', mb: 2, opacity: 0.8 }}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Run simulation to see before/after diff
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
              Simulate the proposed action to preview impact
            </Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<Iconify icon="solar:play-bold" width={16} />}
              onClick={onRunSimulation}
              disabled={isLoading}
            >
              {isLoading ? 'Running...' : 'Run Simulation'}
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  const { before, after, outcome, message } = result;
  const rows = renderDiffRows(before ?? {}, after ?? {});

  return (
    <Box sx={{ p: 2, ...sx }}>
      <Stack spacing={2}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            Simulation Result
          </Typography>
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              bgcolor: outcome === 'success' ? 'success.lighter' : 'error.lighter',
              color: outcome === 'success' ? 'success.dark' : 'error.dark',
              typography: 'caption',
              fontWeight: 600,
            }}
          >
            {outcome === 'success' ? 'Passed' : 'Failed'}
          </Box>
        </Stack>

        {message && (
          <Typography variant="body2" color="text.secondary">
            {message}
          </Typography>
        )}

        <Card variant="outlined">
          <CardContent sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              {rows.map((row) => (
                <Box
                  key={row.key}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: 1,
                    alignItems: 'center',
                    py: 0.75,
                    px: 1,
                    borderRadius: 1,
                    bgcolor: row.changed ? 'warning.lighter' : 'action.hover',
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary' }}>
                    {row.key}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'monospace',
                      ...(row.changed && { textDecoration: 'line-through', color: 'error.main' }),
                    }}
                  >
                    {row.beforeVal != null ? String(row.beforeVal) : '—'}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    {row.changed && <Iconify icon="solar:alt-arrow-right-bold" width={12} sx={{ color: 'warning.main' }} />}
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: 'monospace',
                        fontWeight: row.changed ? 600 : 400,
                        color: row.changed ? 'success.dark' : 'text.primary',
                      }}
                    >
                      {row.afterVal != null ? String(row.afterVal) : '—'}
                    </Typography>
                  </Stack>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>

        <Button
          variant="outlined"
          size="small"
          startIcon={<Iconify icon="solar:refresh-bold" width={16} />}
          onClick={onRunSimulation}
          disabled={isLoading}
        >
          {isLoading ? 'Running...' : 'Run Again'}
        </Button>
      </Stack>
    </Box>
  );
};
