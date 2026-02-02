import type { Theme, SxProps } from '@mui/material/styles';

import { Iconify } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { SimulationResult } from '../../data/mock-data';

// ----------------------------------------------------------------------

export type SimulationResultCardProps = {
  result: SimulationResult;
  sx?: SxProps<Theme>;
};

export const SimulationResultCard = ({ result, sx }: SimulationResultCardProps) => (
    <Box
      sx={{
        borderRadius: 1.5,
        border: 1,
        borderColor: result.predictedSuccess ? 'success.main' : 'error.main',
        bgcolor: result.predictedSuccess ? 'success.lighter' : 'error.lighter',
        overflow: 'hidden',
        ...sx,
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1.5}
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: result.predictedSuccess ? 'success.main' : 'error.main',
          bgcolor: result.predictedSuccess ? 'success.lighter' : 'error.lighter',
        }}
      >
        <Iconify
          icon={
            result.predictedSuccess
              ? 'solar:check-circle-bold-duotone'
              : 'solar:close-circle-bold'
          }
          width={20}
          sx={{ color: result.predictedSuccess ? 'success.main' : 'error.main' }}
        />
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {result.predictedSuccess ? 'Simulation Passed' : 'Simulation Failed'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Pre-execution validation complete
          </Typography>
        </Box>
      </Stack>

      <Stack spacing={2} sx={{ p: 2 }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
            <Iconify icon="solar:box-bold-duotone" width={14} sx={{ color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
              Impacted Objects
            </Typography>
          </Stack>
          <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
            {result.impactedObjects.map((obj, i) => (
              <Box
                key={i}
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  bgcolor: 'action.hover',
                  typography: 'caption',
                }}
              >
                <Iconify icon="solar:arrow-right-bold" width={12} sx={{ color: 'text.secondary' }} />
                {obj}
              </Box>
            ))}
          </Stack>
        </Box>

        <Box>
          <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
            <Iconify icon="solar:shield-check-bold-duotone" width={14} sx={{ color: 'text.secondary' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
              Validations
            </Typography>
          </Stack>
          <Stack spacing={0.75}>
            {result.validations.map((validation, i) => (
              <Stack key={i} direction="row" alignItems="center" spacing={1}>
                <Iconify
                  icon={
                    validation.passed
                      ? 'solar:check-circle-bold-duotone'
                      : 'solar:close-circle-bold'
                  }
                  width={16}
                  sx={{
                    color: validation.passed ? 'success.main' : 'error.main',
                    flexShrink: 0,
                  }}
                />
                <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
                  {validation.name}:
                </Typography>
                <Typography component="span" variant="body2" color="text.secondary">
                  {validation.message}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        {result.riskNotes.length > 0 && (
          <Box>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
              <Iconify icon="solar:danger-triangle-bold-duotone" width={14} sx={{ color: 'warning.main' }} />
              <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
                Risk Notes
              </Typography>
            </Stack>
            <Stack spacing={0.5}>
              {result.riskNotes.map((note, i) => (
                <Stack
                  key={i}
                  direction="row"
                  alignItems="flex-start"
                  spacing={1}
                  sx={{
                    px: 1.5,
                    py: 1,
                    borderRadius: 1,
                    bgcolor: 'warning.lighter',
                    typography: 'body2',
                    color: 'warning.dark',
                  }}
                >
                  <Iconify icon="solar:danger-triangle-bold-duotone" width={16} sx={{ flexShrink: 0, mt: 0.25 }} />
                  {note}
                </Stack>
              ))}
            </Stack>
          </Box>
        )}
      </Stack>
    </Box>
);
