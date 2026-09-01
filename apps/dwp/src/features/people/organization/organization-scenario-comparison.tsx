import { useTranslation } from 'react-i18next';
import { GitCompareArrows } from 'lucide-react';
import { formatNumber } from '@dwp-frontend/shared-i18n';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import type {
  OrganizationScenario,
  OrganizationScenarioDecisionMetrics,
  OrganizationScenarioDecisionPack,
} from '@dwp-frontend/shared-utils';

type Props = {
  scenarios: OrganizationScenario[];
  selected: OrganizationScenario;
  selectedDecision?: OrganizationScenarioDecisionPack;
  comparisonScenario?: OrganizationScenario;
  comparisonDecision?: OrganizationScenarioDecisionPack;
  comparisonScenarioId: string;
  loading: boolean;
  onComparisonChange: (scenarioId: string) => void;
};

type MetricDefinition = {
  key: keyof OrganizationScenarioDecisionMetrics;
  labelKey: string;
  format: 'integer' | 'decimal' | 'money';
};

const METRICS: MetricDefinition[] = [
  { key: 'headcount', labelKey: 'headcount', format: 'integer' },
  { key: 'plannedFte', labelKey: 'fte', format: 'decimal' },
  { key: 'workforceCost', labelKey: 'cost', format: 'money' },
  { key: 'averageManagerSpan', labelKey: 'span', format: 'decimal' },
  { key: 'maximumLayers', labelKey: 'layers', format: 'integer' },
  { key: 'organizationHealthScore', labelKey: 'health', format: 'integer' },
  { key: 'dataQualityScore', labelKey: 'quality', format: 'integer' },
];

export function OrganizationScenarioComparison({
  scenarios,
  selected,
  selectedDecision,
  comparisonScenario,
  comparisonDecision,
  comparisonScenarioId,
  loading,
  onComparisonChange,
}: Props) {
  const { t } = useTranslation('workforce');
  const alternatives = scenarios.filter((scenario) => scenario.scenarioId !== selected.scenarioId);
  const comparisonBasisMatches =
    !selectedDecision ||
    !comparisonDecision ||
    (selectedDecision.baselineDate === comparisonDecision.baselineDate &&
      selectedDecision.baselineFingerprint === comparisonDecision.baselineFingerprint);

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        gap={1.5}
        sx={{ px: 1.75, py: 1.5, bgcolor: 'action.hover' }}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <GitCompareArrows size={17} />
          <Box>
            <Typography variant="subtitle2">{t('orgChart.scenarios.compare.title')}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('orgChart.scenarios.compare.help')}
            </Typography>
          </Box>
        </Stack>
        <TextField
          select
          size="small"
          value={comparisonScenarioId}
          onChange={(event) => onComparisonChange(event.target.value)}
          label={t('orgChart.scenarios.compare.select')}
          disabled={!alternatives.length}
          sx={{ minWidth: { sm: 230 } }}
        >
          <MenuItem value="">{t('orgChart.scenarios.compare.none')}</MenuItem>
          {alternatives.map((scenario) => (
            <MenuItem key={scenario.scenarioId} value={scenario.scenarioId}>
              {scenario.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {comparisonScenarioId && loading && (
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          gap={1}
          role="status"
          sx={{ py: 4 }}
        >
          <CircularProgress size={18} aria-hidden="true" />
          <Typography variant="caption" color="text.secondary">
            {t('orgChart.scenarios.compare.loading')}
          </Typography>
        </Stack>
      )}

      {comparisonScenario && selectedDecision && comparisonDecision && !loading && (
        <Box>
          {!comparisonBasisMatches && (
            <Alert severity="warning" sx={{ borderRadius: 0 }}>
              {t('orgChart.scenarios.compare.baselineMismatch')}
            </Alert>
          )}
          <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
            <MobileComparison
              selected={selected}
              selectedDecision={selectedDecision}
              comparisonScenario={comparisonScenario}
              comparisonDecision={comparisonDecision}
              comparisonBasisMatches={comparisonBasisMatches}
            />
          </Box>
          <Box sx={{ display: { xs: 'none', sm: 'block' }, overflowX: 'auto' }}>
            <Box sx={{ minWidth: 610 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(145px, 1fr) repeat(3, minmax(135px, 1fr))',
                  borderTop: 1,
                  borderColor: 'divider',
                }}
              >
                <ComparisonHeader label={t('orgChart.scenarios.compare.metric')} />
                <ScenarioHeader scenario={selected} decision={selectedDecision} />
                <ScenarioHeader scenario={comparisonScenario} decision={comparisonDecision} />
                <ComparisonHeader label={t('orgChart.scenarios.compare.difference')} />
                {METRICS.map((metric) => {
                  const selectedValue = numericMetric(selectedDecision.proposed, metric.key);
                  const comparisonValue = numericMetric(comparisonDecision.proposed, metric.key);
                  const selectedCurrency = selectedDecision.proposed.costCurrency;
                  const comparisonCurrency = comparisonDecision.proposed.costCurrency;
                  const comparableDifference =
                    comparisonBasisMatches &&
                    (metric.key !== 'workforceCost' ||
                      (selectedCurrency === comparisonCurrency && comparisonCurrency !== 'MIXED'));
                  return (
                    <MetricRow
                      key={metric.key}
                      label={t(`orgChart.scenarios.compare.metrics.${metric.labelKey}`)}
                      selected={formatMetric(selectedValue, metric.format, selectedCurrency)}
                      comparison={formatMetric(comparisonValue, metric.format, comparisonCurrency)}
                      difference={
                        comparableDifference
                          ? formatMetric(
                              comparisonValue - selectedValue,
                              metric.format,
                              comparisonCurrency,
                              true
                            )
                          : t('orgChart.scenarios.compare.notComparable')
                      }
                    />
                  );
                })}
              </Box>
            </Box>
          </Box>
        </Box>
      )}

      {!comparisonScenarioId && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', px: 1.75, py: 1.25 }}
        >
          {alternatives.length
            ? t('orgChart.scenarios.compare.empty')
            : t('orgChart.scenarios.compare.noAlternatives')}
        </Typography>
      )}
    </Box>
  );
}

function MobileComparison({
  selected,
  selectedDecision,
  comparisonScenario,
  comparisonDecision,
  comparisonBasisMatches,
}: {
  selected: OrganizationScenario;
  selectedDecision: OrganizationScenarioDecisionPack;
  comparisonScenario: OrganizationScenario;
  comparisonDecision: OrganizationScenarioDecisionPack;
  comparisonBasisMatches: boolean;
}) {
  const { t } = useTranslation('workforce');

  return (
    <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
          gap: 1,
          px: 1.5,
          py: 1.25,
          bgcolor: 'background.paper',
        }}
      >
        <MobileScenarioHeader scenario={selected} decision={selectedDecision} />
        <MobileScenarioHeader scenario={comparisonScenario} decision={comparisonDecision} />
        <Typography variant="caption" fontWeight={750} sx={{ alignSelf: 'start' }}>
          {t('orgChart.scenarios.compare.difference')}
        </Typography>
      </Box>

      {METRICS.map((metric) => {
        const selectedValue = numericMetric(selectedDecision.proposed, metric.key);
        const comparisonValue = numericMetric(comparisonDecision.proposed, metric.key);
        const selectedCurrency = selectedDecision.proposed.costCurrency;
        const comparisonCurrency = comparisonDecision.proposed.costCurrency;
        const comparableDifference =
          comparisonBasisMatches &&
          (metric.key !== 'workforceCost' ||
            (selectedCurrency === comparisonCurrency && comparisonCurrency !== 'MIXED'));

        return (
          <Box key={metric.key} sx={{ px: 1.5, py: 1.1, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
              {t(`orgChart.scenarios.compare.metrics.${metric.labelKey}`)}
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) auto',
                gap: 1,
                mt: 0.4,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <Typography variant="body2" fontWeight={680}>
                {formatMetric(selectedValue, metric.format, selectedCurrency)}
              </Typography>
              <Typography variant="body2" fontWeight={680}>
                {formatMetric(comparisonValue, metric.format, comparisonCurrency)}
              </Typography>
              <Typography variant="body2" fontWeight={760} textAlign="right">
                {comparableDifference
                  ? formatMetric(
                      comparisonValue - selectedValue,
                      metric.format,
                      comparisonCurrency,
                      true
                    )
                  : t('orgChart.scenarios.compare.notComparable')}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function MobileScenarioHeader({
  scenario,
  decision,
}: {
  scenario: OrganizationScenario;
  decision: OrganizationScenarioDecisionPack;
}) {
  const { t } = useTranslation('workforce');
  const color =
    decision.decisionState === 'READY'
      ? 'success.main'
      : decision.decisionState === 'BLOCKED'
        ? 'error.main'
        : 'warning.dark';

  return (
    <Stack gap={0.25} sx={{ minWidth: 0 }}>
      <Typography variant="caption" fontWeight={750} sx={{ overflowWrap: 'anywhere' }}>
        {scenario.name}
      </Typography>
      <Typography variant="caption" color={color} fontWeight={700}>
        {t(`orgChart.scenarios.decision.states.${decision.decisionState}`)} ·{' '}
        {decision.readinessScore}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {scenario.effectiveDate}
      </Typography>
    </Stack>
  );
}

function ScenarioHeader({
  scenario,
  decision,
}: {
  scenario: OrganizationScenario;
  decision: OrganizationScenarioDecisionPack;
}) {
  const { t } = useTranslation('workforce');
  const color =
    decision.decisionState === 'READY'
      ? 'success'
      : decision.decisionState === 'BLOCKED'
        ? 'error'
        : 'warning';
  return (
    <Stack gap={0.5} sx={{ minWidth: 0, px: 1.25, py: 1.1, borderLeft: 1, borderColor: 'divider' }}>
      <Typography variant="caption" fontWeight={750} noWrap title={scenario.name}>
        {scenario.name}
      </Typography>
      <Stack direction="row" alignItems="center" gap={0.75}>
        <Chip
          size="small"
          color={color}
          variant="outlined"
          label={t(`orgChart.scenarios.decision.states.${decision.decisionState}`)}
        />
        <Typography variant="caption" fontWeight={800}>
          {decision.readinessScore}
        </Typography>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        {scenario.effectiveDate}
      </Typography>
    </Stack>
  );
}

function ComparisonHeader({ label }: { label: string }) {
  return (
    <Typography variant="caption" fontWeight={750} sx={{ px: 1.25, py: 1.1 }}>
      {label}
    </Typography>
  );
}

function MetricRow({
  label,
  selected,
  comparison,
  difference,
}: {
  label: string;
  selected: string;
  comparison: string;
  difference: string;
}) {
  return (
    <>
      <Typography variant="caption" color="text.secondary" sx={metricCellSx(false)}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={680} sx={metricCellSx(true)}>
        {selected}
      </Typography>
      <Typography variant="body2" fontWeight={680} sx={metricCellSx(true)}>
        {comparison}
      </Typography>
      <Typography variant="body2" fontWeight={760} sx={metricCellSx(true)}>
        {difference}
      </Typography>
    </>
  );
}

function metricCellSx(withLeftBorder: boolean) {
  return {
    px: 1.25,
    py: 1,
    borderTop: 1,
    borderLeft: withLeftBorder ? 1 : 0,
    borderColor: 'divider',
    fontVariantNumeric: 'tabular-nums',
  } as const;
}

function numericMetric(
  metrics: OrganizationScenarioDecisionMetrics,
  key: keyof OrganizationScenarioDecisionMetrics
): number {
  const value = metrics[key];
  return typeof value === 'number' ? value : 0;
}

function formatMetric(
  value: number,
  format: MetricDefinition['format'],
  currency?: string | null,
  signed = false
): string {
  if (format === 'money') {
    return formatNumber(value, {
      style: currency && currency !== 'MIXED' ? 'currency' : 'decimal',
      currency: currency && currency !== 'MIXED' ? currency : undefined,
      notation: 'compact',
      maximumFractionDigits: 1,
      signDisplay: signed ? 'always' : 'auto',
    });
  }
  return formatNumber(value, {
    minimumFractionDigits: format === 'decimal' ? 1 : 0,
    maximumFractionDigits: format === 'decimal' ? 1 : 0,
    signDisplay: signed ? 'always' : 'auto',
  });
}
