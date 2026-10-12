import { useTranslation } from 'react-i18next';
import { InlineFeedback } from '@dwp-frontend/design-system';

import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export const HRIS_EMPLOYEE_CHANGE_RUNTIME_STATE = 'OFF' as const;

/**
 * Control-owned route adapter for the HRM employee-change request lifecycle.
 *
 * No owner query or command is exposed while the feature is default-off. HRM adds the
 * request/submit/decision/apply experience behind this exact boundary in its module slice.
 */
export function HrisEmployeeChangeWorkspace() {
  const { t } = useTranslation('hcm');

  return (
    <Stack
      gap={2}
      data-testid="hris-employee-change-workspace"
      data-runtime-state={HRIS_EMPLOYEE_CHANGE_RUNTIME_STATE}
      data-surface-family="employee-change"
      sx={{ minWidth: 0, maxWidth: '100%' }}
    >
      <InlineFeedback
        severity="info"
        title={t('pages.hcm.employee-change-requests.availabilityTitle', {
          defaultValue: 'Employee-change lifecycle is unavailable',
        })}
      >
        {t('pages.hcm.employee-change-requests.availabilityDescription', {
          defaultValue:
            'The Control route is mounted, but the HRM owner lifecycle is feature-off. No employee-change data is loaded and no request command is available.',
        })}
      </InlineFeedback>

      <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
        <Stack gap={1.25} alignItems="flex-start" minWidth={0}>
          <Chip
            size="small"
            color="default"
            variant="outlined"
            label={t('pages.hcm.employee-change-requests.runtimeState', {
              defaultValue: 'Feature state: OFF',
            })}
          />
          <Typography component="h2" variant="subtitle1" sx={{ overflowWrap: 'anywhere' }}>
            {t('pages.hcm.employee-change-requests.boundaryTitle', {
              defaultValue: 'Dedicated employee-change request family',
            })}
          </Typography>
          <Typography color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
            {t('pages.hcm.employee-change-requests.boundaryDescription', {
              defaultValue:
                'People 360 remains at /hr/operations/people and assignment proposals remain at /hr/operations/assignments. Neither surface is reused for this lifecycle.',
            })}
          </Typography>
        </Stack>
      </Paper>
    </Stack>
  );
}
