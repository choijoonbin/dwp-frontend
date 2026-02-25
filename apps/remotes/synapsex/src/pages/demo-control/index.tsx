/**
 * 통합 시나리오 생성기 — API 기반 단일 폼
 * GET /api/synapse/demo/scenario-types 로 시나리오 목록 조회 후
 * POST /api/synapse/demo/generate-violation 로 생성 요청
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Iconify } from '@dwp-frontend/design-system';
import { useTranslation } from '@dwp-frontend/shared-i18n';
import { useQuery , useQueryClient } from '@tanstack/react-query';
import {
  useToastStore,
  getScenarioTypes,
  generateViolation,
  type ViolationIntensity,
  type ScenarioTypeOptionDto,
} from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Radio from '@mui/material/Radio';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import RadioGroup from '@mui/material/RadioGroup';
import CardContent from '@mui/material/CardContent';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import FormControlLabel from '@mui/material/FormControlLabel';
import CircularProgress from '@mui/material/CircularProgress';

const SCENARIO_TYPES_QUERY_KEY = ['synapse', 'demo', 'scenario-types'];

const DEFAULT_COUNT = 1;
const COUNT_MIN = 1;
const COUNT_MAX = 50;
const DEFAULT_INTENSITY: ViolationIntensity = 'VIOLATION';
const DEFAULT_AMOUNT_MIN = 10000;
const DEFAULT_AMOUNT_MAX = 100000;

type FormState = {
  scenarioType: string;
  count: number;
  intensity: ViolationIntensity;
  amountRangeMin: number;
  amountRangeMax: number;
};

const getDefaultFormState = (): FormState => ({
  scenarioType: '',
  count: DEFAULT_COUNT,
  intensity: DEFAULT_INTENSITY,
  amountRangeMin: DEFAULT_AMOUNT_MIN,
  amountRangeMax: DEFAULT_AMOUNT_MAX,
});

export const DemoControlPage = () => {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toastActions = useToastStore((s) => s.actions);
  const [formState, setFormState] = useState<FormState>(getDefaultFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: scenarioTypes = [], isLoading: isLoadingTypes } = useQuery({
    queryKey: SCENARIO_TYPES_QUERY_KEY,
    queryFn: async () => {
      const res = await getScenarioTypes();
      return (res.data ?? []) as ScenarioTypeOptionDto[];
    },
  });

  const updateForm = useCallback((patch: Partial<FormState>) => {
    setFormState((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSubmit = useCallback(async () => {
    const scenarioType = formState.scenarioType.trim();
    if (!scenarioType) {
      toastActions.show(t('demoControl.selectScenarioHint'), 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      await generateViolation({
        scenarioType,
        count: Math.min(COUNT_MAX, Math.max(COUNT_MIN, formState.count)),
        intensity: formState.intensity,
        amountRangeMin: formState.amountRangeMin,
        amountRangeMax: formState.amountRangeMax,
      });
      queryClient.invalidateQueries({ queryKey: ['synapse', 'cases'] });
      toastActions.show(t('demoControl.toastSuccess'), 'success');
      navigate('/synapse/workbench');
    } catch {
      toastActions.show(
        t('error.errorState.unknownError') ?? 'An error occurred.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [formState, queryClient, toastActions, t, navigate]);

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
        <Card sx={{ maxWidth: 560, border: 1, borderColor: 'divider' }}>
          <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
            <Stack spacing={3}>
              <TextField
                select
                fullWidth
                size="small"
                required
                id="demo-scenario-select"
                label={t('demoControl.scenarioSelectLabel')}
                value={formState.scenarioType}
                onChange={(e) => updateForm({ scenarioType: e.target.value })}
                disabled={isLoadingTypes}
                InputProps={{
                  startAdornment: isLoadingTypes ? (
                    <InputAdornment position="start">
                      <CircularProgress size={20} />
                    </InputAdornment>
                  ) : undefined,
                }}
              >
                <MenuItem value="">
                  <em>{t('demoControl.scenarioSelectPlaceholder')}</em>
                </MenuItem>
                {scenarioTypes.map((opt) => (
                  <MenuItem key={opt.code} value={opt.code}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {t('demoControl.totalCountLabel')}
                </Typography>
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Slider
                    value={formState.count}
                    onChange={(_, value) => updateForm({ count: value as number })}
                    min={COUNT_MIN}
                    max={COUNT_MAX}
                    step={1}
                    marks
                    valueLabelDisplay="auto"
                    sx={{ flexGrow: 1 }}
                  />
                  <Typography variant="body2" fontWeight={600} sx={{ minWidth: 24 }}>
                    {formState.count}
                  </Typography>
                </Stack>
              </Box>

              <FormControl component="fieldset">
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {t('demoControl.intensityLabel')}
                </Typography>
                <RadioGroup
                  row
                  value={formState.intensity}
                  onChange={(e) =>
                    updateForm({ intensity: e.target.value as ViolationIntensity })
                  }
                >
                  <FormControlLabel value="VIOLATION" control={<Radio size="small" />} label={t('demoControl.intensityViolation')} />
                  <FormControlLabel value="NORMAL" control={<Radio size="small" />} label={t('demoControl.intensityNormal')} />
                </RadioGroup>
              </FormControl>

              <Stack direction="row" spacing={2} alignItems="flex-start">
                <TextField
                  label={t('demoControl.amountRangeMin')}
                  type="number"
                  size="small"
                  value={formState.amountRangeMin}
                  onChange={(e) =>
                    updateForm({ amountRangeMin: Number(e.target.value) || 0 })
                  }
                  inputProps={{ min: 0 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">KRW</InputAdornment> }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label={t('demoControl.amountRangeMax')}
                  type="number"
                  size="small"
                  value={formState.amountRangeMax}
                  onChange={(e) =>
                    updateForm({ amountRangeMax: Number(e.target.value) || 0 })
                  }
                  inputProps={{ min: 0 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">KRW</InputAdornment> }}
                  sx={{ flex: 1 }}
                />
              </Stack>

              <Button
                fullWidth
                variant="contained"
                size="medium"
                disabled={isSubmitting || !formState.scenarioType || isLoadingTypes}
                startIcon={
                  isSubmitting ? (
                    <Iconify icon="solar:refresh-bold" width={18} />
                  ) : (
                    <Iconify icon="solar:add-circle-bold" width={18} />
                  )
                }
                onClick={handleSubmit}
              >
                {isSubmitting ? t('demoControl.loadingWallet') : t('demoControl.generateButton')}
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};
