import { useTranslation } from 'react-i18next';
import { BadgeCheck, CircleAlert, History, RefreshCw, TrendingUp } from 'lucide-react';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type {
  OrganizationScenarioDecisionPack,
  OrganizationScenarioValidationRun,
} from '@dwp-frontend/shared-utils';

type Props = {
  decision?: OrganizationScenarioDecisionPack;
  history: OrganizationScenarioValidationRun[];
  loading: boolean;
  validating: boolean;
  canValidate: boolean;
  onValidate: () => void;
};

export function OrganizationScenarioDecisionPackView({
  decision,
  history,
  loading,
  validating,
  canValidate,
  onValidate,
}: Props) {
  const { t } = useTranslation('workforce');
  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" gap={1} sx={{ minHeight: 150 }}>
        <CircularProgress size={24} />
        <Typography variant="caption" color="text.secondary">
          {t('orgChart.scenarios.decision.loading')}
        </Typography>
      </Stack>
    );
  }
  if (!decision) return null;

  const decisionColor =
    decision.decisionState === 'READY'
      ? '#16815F'
      : decision.decisionState === 'BLOCKED'
        ? '#C2412D'
        : '#B7791F';
  const impacts = [
    {
      label: t('orgChart.scenarios.decision.metrics.headcount'),
      value: signed(decision.delta.headcount),
    },
    {
      label: t('orgChart.scenarios.decision.metrics.fte'),
      value: signed(decision.delta.plannedFte, 1),
    },
    {
      label: t('orgChart.scenarios.decision.metrics.cost'),
      value: formatNumber(decision.delta.workforceCost, {
        style:
          decision.delta.costCurrency && decision.delta.costCurrency !== 'MIXED'
            ? 'currency'
            : 'decimal',
        currency:
          decision.delta.costCurrency && decision.delta.costCurrency !== 'MIXED'
            ? decision.delta.costCurrency
            : undefined,
        notation: 'compact',
        maximumFractionDigits: 1,
        signDisplay: 'always',
      }),
    },
    {
      label: t('orgChart.scenarios.decision.metrics.layers'),
      value: signed(decision.delta.maximumLayers),
    },
    {
      label: t('orgChart.scenarios.decision.metrics.health'),
      value: signed(decision.delta.organizationHealthScore),
    },
  ];

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ px: 2, py: 1.75, bgcolor: '#111A24', color: '#F8FAFC' }}
      >
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box sx={{ position: 'relative', width: 54, height: 54 }}>
            <CircularProgress
              variant="determinate"
              value={decision.readinessScore}
              size={54}
              thickness={4.5}
              sx={{ color: decisionColor }}
            />
            <Typography
              variant="caption"
              fontWeight={800}
              sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}
            >
              {decision.readinessScore}
            </Typography>
          </Box>
          <Box>
            <Typography variant="overline" sx={{ color: '#9FB0C3' }}>
              {t('orgChart.scenarios.decision.eyebrow')}
            </Typography>
            <Typography variant="subtitle1" fontWeight={760}>
              {t(`orgChart.scenarios.decision.states.${decision.decisionState}`)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#B9C5D1' }}>
              {t('orgChart.scenarios.decision.summary', {
                blockers: decision.blockingIssueCount,
                warnings: decision.warningCount,
              })}
            </Typography>
          </Box>
        </Stack>
        <Button
          size="small"
          variant="outlined"
          startIcon={validating ? <CircularProgress size={13} /> : <RefreshCw size={14} />}
          disabled={!canValidate || validating}
          onClick={onValidate}
          sx={{ color: '#F8FAFC', borderColor: '#60758B', '&:hover': { borderColor: '#AFC1D4' } }}
        >
          {t('orgChart.scenarios.decision.validate')}
        </Button>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(5, 1fr)' } }}>
        {impacts.map((impact, index) => (
          <Box
            key={impact.label}
            sx={{
              px: 1.4,
              py: 1.2,
              borderRight: 1,
              borderBottom: 1,
              borderColor: 'divider',
              gridColumn: { xs: index === impacts.length - 1 ? '1 / -1' : 'auto', sm: 'auto' },
            }}
          >
            <Typography variant="caption" color="text.secondary" display="block">
              {impact.label}
            </Typography>
            <Typography variant="subtitle2" fontWeight={760}>
              {impact.value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ px: 1.5 }}>
        {decision.checks.map((check) => {
          const CheckIcon =
            check.outcome === 'PASS'
              ? BadgeCheck
              : check.outcome === 'BLOCK'
                ? CircleAlert
                : TrendingUp;
          const color =
            check.outcome === 'PASS'
              ? 'success.main'
              : check.outcome === 'BLOCK'
                ? 'error.main'
                : 'warning.main';
          return (
            <Stack
              key={check.checkCode}
              direction="row"
              alignItems="center"
              gap={1}
              sx={{ minHeight: 46, py: 0.75, borderBottom: 1, borderColor: 'divider' }}
            >
              <Box sx={{ color, display: 'grid' }}>
                <CheckIcon size={16} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={650}>
                  {t(`orgChart.scenarios.decision.checks.${check.checkCode}.title`)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(`orgChart.scenarios.decision.checks.${check.checkCode}.description`, {
                    ...check.evidence,
                  })}
                </Typography>
              </Box>
              <Chip
                size="small"
                variant="outlined"
                color={
                  check.outcome === 'PASS'
                    ? 'success'
                    : check.outcome === 'BLOCK'
                      ? 'error'
                      : 'warning'
                }
                label={t(`orgChart.scenarios.decision.outcomes.${check.outcome}`)}
              />
            </Stack>
          );
        })}
      </Box>

      <Box sx={{ borderTop: 1, borderColor: 'divider', px: 1.5, py: 1.25 }}>
        <Stack direction="row" alignItems="center" gap={0.75} sx={{ mb: 0.75 }}>
          <History size={15} />
          <Typography variant="subtitle2">
            {t('orgChart.scenarios.decision.history.title')}
          </Typography>
        </Stack>
        {history.length ? (
          <Stack gap={0.5}>
            {history.slice(0, 5).map((run) => (
              <Stack
                key={run.validationRunId}
                direction="row"
                alignItems="center"
                gap={1}
                sx={{ minHeight: 34 }}
              >
                <Box
                  aria-hidden
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor:
                      run.decisionState === 'READY'
                        ? 'success.main'
                        : run.decisionState === 'BLOCKED'
                          ? 'error.main'
                          : 'warning.main',
                  }}
                />
                <Typography variant="caption" fontWeight={700} sx={{ minWidth: 70 }}>
                  {t(`orgChart.scenarios.decision.triggers.${run.triggerType}`)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                  {formatDate(run.evaluatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
                </Typography>
                <Typography variant="caption" fontWeight={750}>
                  {run.readinessScore}
                </Typography>
                <Chip
                  size="small"
                  variant="outlined"
                  color={
                    run.decisionState === 'READY'
                      ? 'success'
                      : run.decisionState === 'BLOCKED'
                        ? 'error'
                        : 'warning'
                  }
                  label={t(`orgChart.scenarios.decision.states.${run.decisionState}`)}
                />
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {t('orgChart.scenarios.decision.history.empty')}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function signed(value: number, fractionDigits = 0): string {
  return formatNumber(value, {
    signDisplay: 'always',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
