import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Iconify } from '@dwp-frontend/design-system';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import {
  type ScenarioType,
  type DemoIntensity,
  type DemoScenarioType,
  type ViolationIntensity,
  useToastStore,
  generateViolation,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Radio from '@mui/material/Radio';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';

// ----------------------------------------------------------------------
// Scenario config: UI 시나리오 → BE generate-violation scenarioType
// ----------------------------------------------------------------------

const SCENARIO_TO_BE: Record<DemoScenarioType, ScenarioType> = {
  split_payment: 'LATE_NIGHT',
  weekend_use: 'WEEKEND_MEAL',
  limit_excess: 'OVER_LIMIT',
  LATE_NIGHT: 'LATE_NIGHT',
  WEEKEND_MEAL: 'WEEKEND_MEAL',
  OVER_LIMIT: 'OVER_LIMIT',
  NORMAL: 'WEEKEND_MEAL',
};

const SCENARIOS: {
  scenarioKey: string;
  scenario_type: DemoScenarioType;
  nameKey: string;
  descriptionKey: string;
  buttonKey: string;
  icon: string;
}[] = [
  {
    scenarioKey: 'split_payment',
    scenario_type: 'split_payment',
    nameKey: 'demoControl.scenarioSplitPayment.name',
    descriptionKey: 'demoControl.scenarioSplitPayment.description',
    buttonKey: 'demoControl.scenarioSplitPayment.button',
    icon: 'solar:card-transfer-bold',
  },
  {
    scenarioKey: 'weekend_use',
    scenario_type: 'weekend_use',
    nameKey: 'demoControl.scenarioWeekendUse.name',
    descriptionKey: 'demoControl.scenarioWeekendUse.description',
    buttonKey: 'demoControl.scenarioWeekendUse.button',
    icon: 'solar:calendar-mark-bold',
  },
  {
    scenarioKey: 'limit_excess',
    scenario_type: 'limit_excess',
    nameKey: 'demoControl.scenarioLimitExcess.name',
    descriptionKey: 'demoControl.scenarioLimitExcess.description',
    buttonKey: 'demoControl.scenarioLimitExcess.button',
    icon: 'solar:users-group-rounded-bold',
  },
];

const INTENSITY_OPTIONS: { value: DemoIntensity; labelKey: string; tooltipKey: string }[] = [
  { value: 'NORMAL', labelKey: 'demoControl.intensityNormal', tooltipKey: 'demoControl.intensityTooltipNormal' },
  { value: 'WARNING', labelKey: 'demoControl.intensityWarning', tooltipKey: 'demoControl.intensityTooltipWarning' },
  { value: 'VIOLATION', labelKey: 'demoControl.intensityViolation', tooltipKey: 'demoControl.intensityTooltipViolation' },
];

const DEFAULT_TOTAL_COUNT = 5;
const DEFAULT_INTENSITY: DemoIntensity = 'VIOLATION';

type CardState = {
  total_count: number;
  intensity: DemoIntensity;
};

const getDefaultCardState = (): CardState => ({
  total_count: DEFAULT_TOTAL_COUNT,
  intensity: DEFAULT_INTENSITY,
});

// ----------------------------------------------------------------------

export const DemoControlPage = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toastActions = useToastStore((s) => s.actions);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [cardState, setCardState] = useState<Record<string, CardState>>(() =>
    SCENARIOS.reduce(
      (acc, s) => {
        acc[s.scenarioKey] = getDefaultCardState();
        return acc;
      },
      {} as Record<string, CardState>
    )
  );

  const updateCardState = useCallback((scenarioKey: string, patch: Partial<CardState>) => {
    setCardState((prev) => ({
      ...prev,
      [scenarioKey]: { ...getDefaultCardState(), ...prev[scenarioKey], ...patch },
    }));
  }, []);

  const handleGenerate = async (scenarioKey: string, scenario_type: DemoScenarioType) => {
    const state = cardState[scenarioKey] ?? getDefaultCardState();

    setLoadingKey(scenarioKey);
    try {
      const intensityMap: Record<DemoIntensity, ViolationIntensity> = {
        NORMAL: 'NORMAL',
        WARNING: 'VIOLATION',
        VIOLATION: 'VIOLATION',
      };
      await generateViolation({
        scenarioType: SCENARIO_TO_BE[scenario_type],
        count: state.total_count,
        intensity: intensityMap[state.intensity],
      });
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      toastActions.show(t('demoControl.toastSuccess'), 'success');
      navigate('/synapse/workbench');
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
            const state = cardState[scenario.scenarioKey] ?? getDefaultCardState();

            return (
              <Card
                key={scenario.scenarioKey}
                sx={{
                  width: { xs: '100%', sm: 340 },
                  border: 1,
                  borderColor: 'divider',
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ mb: 2 }}>
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

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    {t('demoControl.totalCountLabel')} (1~10)
                  </Typography>
                  <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                    <Slider
                      value={state.total_count}
                      onChange={(_, value) =>
                        updateCardState(scenario.scenarioKey, { total_count: value as number })
                      }
                      min={1}
                      max={10}
                      step={1}
                      marks
                      valueLabelDisplay="auto"
                      sx={{ flexGrow: 1 }}
                    />
                    <Typography variant="body2" fontWeight={600} sx={{ minWidth: 24 }}>
                      {state.total_count}
                    </Typography>
                  </Stack>

                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    {t('demoControl.intensityLabel')}
                  </Typography>
                  <FormControl component="fieldset" sx={{ mb: 2 }}>
                    <RadioGroup
                      value={state.intensity}
                      onChange={(e) =>
                        updateCardState(scenario.scenarioKey, {
                          intensity: e.target.value as DemoIntensity,
                        })
                      }
                    >
                      {INTENSITY_OPTIONS.map((opt) => (
                        <Tooltip key={opt.value} title={t(opt.tooltipKey)} placement="top">
                          <FormControlLabel
                            value={opt.value}
                            control={<Radio size="small" />}
                            label={t(opt.labelKey)}
                            sx={{ mr: 1 }}
                          />
                        </Tooltip>
                      ))}
                    </RadioGroup>
                  </FormControl>

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
                    onClick={() => handleGenerate(scenario.scenarioKey, scenario.scenario_type)}
                  >
                    {isLoading ? t('demoControl.loadingWallet') : t(scenario.buttonKey)}
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
