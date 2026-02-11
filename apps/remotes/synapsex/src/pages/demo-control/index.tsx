import { useState } from 'react';

import { Iconify } from '@dwp-frontend/design-system';
import {
  generateViolation,
  useToastStore,
} from '@dwp-frontend/shared-utils';
import { useTranslation } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';
// ----------------------------------------------------------------------
// Scenario config (scenarioKey must match backend)
// ----------------------------------------------------------------------

const SCENARIOS = [
  {
    scenarioKey: 'weekend-meal',
    nameKey: 'demoControl.scenarioWeekendMeal.name',
    descriptionKey: 'demoControl.scenarioWeekendMeal.description',
    buttonKey: 'demoControl.scenarioWeekendMeal.button',
    icon: 'solar:calendar-mark-bold',
  },
  {
    scenarioKey: 'per-capita-limit',
    nameKey: 'demoControl.scenarioPerCapita.name',
    descriptionKey: 'demoControl.scenarioPerCapita.description',
    buttonKey: 'demoControl.scenarioPerCapita.button',
    icon: 'solar:users-group-rounded-bold',
  },
  {
    scenarioKey: 'late-night',
    nameKey: 'demoControl.scenarioLateNight.name',
    descriptionKey: 'demoControl.scenarioLateNight.description',
    buttonKey: 'demoControl.scenarioLateNight.button',
    icon: 'solar:moon-bold',
  },
] as const;

// ----------------------------------------------------------------------

export const DemoControlPage = () => {
  const { t } = useTranslation('common');
  const toastActions = useToastStore((s) => s.actions);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const handleGenerate = async (scenarioKey: string) => {
    setLoadingKey(scenarioKey);
    try {
      await generateViolation({ scenarioKey });
      toastActions.show(t('demoControl.toastSuccess'), 'success');
    } catch {
      toastActions.show(
        t('error.errorState.unknownError') || 'An error occurred.',
        'error'
      );
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)' }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, py: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Iconify icon="solar:database-bold" width={24} sx={{ color: 'primary.main' }} />
          <Typography variant="h5" fontWeight={600}>
            {t('demoControl.title')}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('demoControl.subtitle')}
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 3 }}>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={2}>
          {SCENARIOS.map((scenario) => {
            const isLoading = loadingKey === scenario.scenarioKey;
            return (
              <Card
                key={scenario.scenarioKey}
                sx={{
                  width: { xs: '100%', sm: 320 },
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ mb: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1.5,
                        bgcolor: 'primary.lighter',
                        color: 'primary.main',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Iconify icon={scenario.icon} width={22} />
                    </Box>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {t(scenario.nameKey)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(scenario.descriptionKey)}
                      </Typography>
                    </Box>
                  </Stack>
                  <Button
                    fullWidth
                    variant="contained"
                    disabled={isLoading}
                    startIcon={
                      isLoading ? (
                        <Iconify icon="solar:refresh-bold" width={18} />
                      ) : (
                        <Iconify icon="solar:add-circle-bold" width={18} />
                      )
                    }
                    onClick={() => handleGenerate(scenario.scenarioKey)}
                    sx={{ mt: 1 }}
                  >
                    {isLoading ? t('demoControl.generating') : t(scenario.buttonKey)}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
};
