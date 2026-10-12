import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';

import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export const HRIS_REFERENCE_CONFIGURATION_RUNTIME_STATE = 'OFF' as const;

/**
 * Control-owned route adapter for the future SYS reference-configuration lifecycle.
 *
 * The module intentionally has no API client or command surface while the owner runtime is
 * default-off. SYS adds the lifecycle domain behind this boundary in its implementation slice.
 */
export function HrisReferenceConfigurationWorkspace() {
  const { t } = useTranslation('hcm');

  return (
    <Stack
      gap={2}
      data-testid="hris-reference-configuration-workspace"
      data-runtime-state={HRIS_REFERENCE_CONFIGURATION_RUNTIME_STATE}
      sx={{ minWidth: 0, maxWidth: '100%' }}
    >
      <InlineFeedback
        severity="info"
        title={t('pages.hcm.settings-reference.availabilityTitle', {
          defaultValue: 'Reference-configuration lifecycle is unavailable',
        })}
      >
        {t('pages.hcm.settings-reference.availabilityDescription', {
          defaultValue:
            'The Control route is mounted, but the SYS owner lifecycle is feature-off. No configuration data is loaded and no lifecycle command is available.',
        })}
      </InlineFeedback>

      <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
        <Stack gap={1.25} alignItems="flex-start" minWidth={0}>
          <Chip
            size="small"
            color="default"
            variant="outlined"
            label={t('pages.hcm.settings-reference.runtimeState', {
              defaultValue: 'Feature state: OFF',
            })}
          />
          <Typography component="h2" variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>
            {t('pages.hcm.settings-reference.boundaryTitle', {
              defaultValue: 'Separate from workforce reference data',
            })}
          </Typography>
          <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t('pages.hcm.settings-reference.boundaryDescription', {
              defaultValue:
                'This workspace is reserved for versioned HRIS configuration. Workforce reference data remains available only at /hr/data/reference.',
            })}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
