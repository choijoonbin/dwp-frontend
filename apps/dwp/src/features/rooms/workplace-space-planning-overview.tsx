import {
  Activity,
  Accessibility,
  BarChart3,
  DatabaseZap,
  Gauge,
  Leaf,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ActionButton, InlineFeedback } from '@dwp-frontend/design-system';
import { formatDate, type SupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { workplaceMemberCard, workplaceMemberSoftSurface } from './workplace-member-surfaces';
import { isWorkplacePlanningForecastRenderable } from './workplace-space-planning-model';

import type {
  WorkplacePlanningForecast,
  WorkplacePlanningOverview,
  WorkplacePlanningSourceStatus,
} from '@dwp-frontend/shared-utils/api/workplace-planning-contract';
import type { ReactNode } from 'react';

function instant(value: string | null, locale: SupportedLocale, timeZone: string) {
  if (!value) return '—';
  return formatDate(value, { dateStyle: 'medium', timeStyle: 'short', timeZone }, locale);
}

function sourceTone(source: WorkplacePlanningSourceStatus) {
  if (source.availability === 'AVAILABLE' && source.freshness === 'FRESH') return 'success';
  if (source.availability === 'COMPUTE_FAILED' || source.availability === 'UNAVAILABLE') {
    return 'error';
  }
  return 'warning';
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <Box sx={(theme) => ({ ...workplaceMemberSoftSurface(theme), p: 1.5, minWidth: 0 })}>
      <Stack direction="row" gap={0.75} alignItems="center" color="text.secondary">
        {icon}
        <Typography variant="caption">{label}</Typography>
      </Stack>
      <Typography
        variant="h5"
        component="p"
        fontWeight={800}
        mt={0.5}
        sx={{ overflowWrap: 'anywhere' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function SourceCard({
  source,
  locale,
  timeZone,
}: {
  source: WorkplacePlanningSourceStatus;
  locale: SupportedLocale;
  timeZone: string;
}) {
  const { t } = useTranslation('rooms');
  const tone = sourceTone(source);
  return (
    <Box
      data-testid={`space-planning-source-${source.series}`}
      sx={(theme) => ({
        border: '1px solid',
        borderColor: alpha(theme.palette[tone].main, 0.28),
        borderRadius: 2,
        p: 1.25,
        minWidth: 0,
      })}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Typography variant="subtitle2" fontWeight={750}>
          {t(`workplace.spacePlanning.series.${source.series}`)}
        </Typography>
        <Chip
          size="small"
          color={tone}
          variant="outlined"
          label={t(`workplace.spacePlanning.availability.${source.availability}`)}
        />
      </Stack>
      <Stack direction="row" justifyContent="space-between" gap={1} mt={1}>
        <Typography variant="caption" color="text.secondary">
          {t('workplace.spacePlanning.sources.coverage')}
        </Typography>
        <Typography variant="caption" fontWeight={700}>
          {source.coveragePercent.toFixed(1)}%
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        color={tone}
        value={source.coveragePercent}
        aria-label={t('workplace.spacePlanning.sources.coverage')}
        sx={{ mt: 0.5, height: 5, borderRadius: 99 }}
      />
      <Stack gap={0.35} mt={1}>
        <Typography variant="caption" color="text.secondary">
          {t('workplace.spacePlanning.sources.freshness')} ·{' '}
          <Box component="span" color={`${tone}.main`} fontWeight={700}>
            {t(`workplace.spacePlanning.freshness.${source.freshness}`)}
          </Box>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('workplace.spacePlanning.sources.sourceAt', {
            value: instant(source.sourceAt, locale, timeZone),
          })}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {t('workplace.spacePlanning.sources.receivedAt', {
            value: instant(source.receivedAt, locale, timeZone),
          })}
        </Typography>
        {source.evidenceReference ? (
          <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>
            {t('workplace.spacePlanning.sources.evidence', {
              value: source.evidenceReference,
            })}
          </Typography>
        ) : null}
        {source.exclusions.length ? (
          <Typography variant="caption" color="warning.main" sx={{ overflowWrap: 'anywhere' }}>
            {t('workplace.spacePlanning.sources.exclusions', {
              value: source.exclusions.join(', '),
            })}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}

function ForecastChart({
  forecast,
  locale,
  timeZone,
}: {
  forecast: WorkplacePlanningForecast;
  locale: SupportedLocale;
  timeZone: string;
}) {
  const { t } = useTranslation('rooms');
  const maximum = Math.max(...forecast.points.map((point) => point.upperBound), 1);
  return (
    <Box
      data-testid="space-planning-forecast-chart"
      role="list"
      aria-label={t('workplace.spacePlanning.forecast.chartLabel')}
      sx={{ display: 'grid', gap: 1, mt: 1.5 }}
    >
      {forecast.points.slice(0, 14).map((point) => (
        <ForecastRow
          key={point.bucketStart}
          point={point}
          maximum={maximum}
          locale={locale}
          timeZone={timeZone}
        />
      ))}
    </Box>
  );
}

function ForecastRow({
  point,
  maximum,
  locale,
  timeZone,
}: {
  point: WorkplacePlanningForecast['points'][number];
  maximum: number;
  locale: SupportedLocale;
  timeZone: string;
}) {
  const { t } = useTranslation('rooms');
  const rangeStart = (point.lowerBound / maximum) * 100;
  const rangeWidth = Math.max(((point.upperBound - point.lowerBound) / maximum) * 100, 1);
  const expected = (point.expectedDemand / maximum) * 100;
  return (
    <Box
      role="listitem"
      aria-label={t('workplace.spacePlanning.forecast.pointLabel', {
        time: formatDate(point.bucketStart, { dateStyle: 'medium', timeZone }, locale),
        expected: point.expectedDemand,
        lower: point.lowerBound,
        upper: point.upperBound,
        unit: point.unit,
      })}
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'minmax(0, 1fr) auto',
          sm: 'minmax(80px, 0.55fr) minmax(120px, 2fr) auto',
        },
        gap: 1,
        alignItems: 'center',
        minWidth: 0,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' } }}
      >
        {formatDate(point.bucketStart, { month: 'short', day: 'numeric', timeZone }, locale)}
      </Typography>
      <Box sx={{ height: 12, bgcolor: 'action.hover', borderRadius: 99, position: 'relative' }}>
        <Box
          sx={{
            position: 'absolute',
            left: `${rangeStart}%`,
            width: `${rangeWidth}%`,
            height: '100%',
            bgcolor: 'var(--dwp-product-soft)',
            borderRadius: 99,
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            left: `calc(${expected}% - 2px)`,
            top: -2,
            width: 4,
            height: 16,
            bgcolor: 'var(--dwp-product-accent)',
            borderRadius: 99,
          }}
        />
      </Box>
      <Typography variant="caption" fontWeight={700} sx={{ whiteSpace: 'nowrap' }}>
        {point.expectedDemand} {point.unit} · {point.lowerBound}–{point.upperBound}
      </Typography>
    </Box>
  );
}

function ForecastPanel({
  forecast,
  locale,
  timeZone,
}: {
  forecast: WorkplacePlanningForecast;
  locale: SupportedLocale;
  timeZone: string;
}) {
  const { t } = useTranslation('rooms');
  const renderable = isWorkplacePlanningForecastRenderable(forecast);
  return (
    <Box
      component="section"
      aria-labelledby="space-planning-forecast-title"
      sx={workplaceMemberCard}
    >
      <Box p={{ xs: 1.5, md: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
          <Box>
            <Typography
              id="space-planning-forecast-title"
              component="h2"
              variant="h6"
              fontWeight={780}
            >
              {t('workplace.spacePlanning.forecast.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('workplace.spacePlanning.forecast.description')}
            </Typography>
          </Box>
          <Chip
            size="small"
            color={renderable ? 'success' : 'warning'}
            label={t(`workplace.spacePlanning.forecast.states.${forecast.state}`)}
          />
        </Stack>
        {renderable ? (
          <>
            <Box
              data-testid="space-planning-recommendation-metrics"
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                gap: 1,
                mt: 2,
              }}
            >
              <Metric
                icon={<Activity size={15} />}
                label={t('workplace.spacePlanning.forecast.peakDemand')}
                value={forecast.recommendationMetrics!.peakDemand}
              />
              <Metric
                icon={<Gauge size={15} />}
                label={t('workplace.spacePlanning.forecast.lowDemand')}
                value={forecast.recommendationMetrics!.lowUtilizationDemand}
              />
              <Metric
                icon={<BarChart3 size={15} />}
                label={t('workplace.spacePlanning.forecast.confidence')}
                value={`${forecast.recommendationMetrics!.confidencePercent.toFixed(1)}%`}
              />
            </Box>
            <ForecastChart forecast={forecast} locale={locale} timeZone={timeZone} />
            <Typography variant="caption" color="text.secondary" display="block" mt={1.5}>
              {t('workplace.spacePlanning.forecast.calculation', {
                value: forecast.recommendationMetrics!.calculationVersion,
              })}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              {t('workplace.spacePlanning.forecast.asOf', {
                value: instant(forecast.evaluatedAt, locale, timeZone),
                timeZone,
              })}
            </Typography>
          </>
        ) : (
          <InlineFeedback severity={forecast.state === 'COMPUTE_FAILED' ? 'error' : 'warning'}>
            <Stack gap={0.5} data-testid="space-planning-forecast-suppressed">
              <Typography variant="body2" fontWeight={700}>
                {t('workplace.spacePlanning.forecast.suppressed')}
              </Typography>
              <Typography variant="body2">
                {forecast.limitations.length
                  ? forecast.limitations.join(' · ')
                  : t('workplace.spacePlanning.forecast.noReason')}
              </Typography>
            </Stack>
          </InlineFeedback>
        )}
      </Box>
    </Box>
  );
}

export function WorkplaceSpacePlanningOverview({
  overview,
  locale,
  timeZone,
  refreshing,
  onRefresh,
}: {
  overview: WorkplacePlanningOverview;
  locale: SupportedLocale;
  timeZone: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { t } = useTranslation('rooms');
  return (
    <Stack gap={2} data-testid="space-planning-overview" data-time-zone={timeZone}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
          gap: 1,
        }}
      >
        <Metric
          icon={<UsersRound size={15} />}
          label={t('workplace.spacePlanning.current.capacity')}
          value={overview.current.capacity}
        />
        <Metric
          icon={<BarChart3 size={15} />}
          label={t('workplace.spacePlanning.current.rooms')}
          value={overview.current.roomCapacity}
        />
        <Metric
          icon={<Accessibility size={15} />}
          label={t('workplace.spacePlanning.current.accessible')}
          value={overview.current.accessibleResourceCount}
        />
        <Metric
          icon={<DatabaseZap size={15} />}
          label={t('workplace.spacePlanning.current.resources')}
          value={overview.current.resourceCount}
        />
      </Box>
      <Typography variant="caption" color="text.secondary">
        {t('workplace.spacePlanning.current.catalogAsOf', {
          value: instant(overview.current.catalogAsOf, locale, timeZone),
          timeZone,
        })}
      </Typography>
      <ForecastPanel forecast={overview.forecast} locale={locale} timeZone={timeZone} />
      <Box
        component="section"
        aria-labelledby="space-planning-source-title"
        sx={workplaceMemberCard}
      >
        <Box p={{ xs: 1.5, md: 2 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            gap={1}
            mb={1.5}
          >
            <Box>
              <Typography
                id="space-planning-source-title"
                component="h2"
                variant="h6"
                fontWeight={780}
              >
                {t('workplace.spacePlanning.sources.title')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {t('workplace.spacePlanning.sources.generated', {
                  value: instant(overview.generatedAt, locale, timeZone),
                })}
                {' · '}
                {t('workplace.spacePlanning.scope.timeZone', { value: timeZone })}
              </Typography>
            </Box>
            <ActionButton
              intent="quiet"
              size="small"
              startIcon={<RefreshCw size={15} />}
              disabled={refreshing}
              onClick={onRefresh}
            >
              {t('workplace.spacePlanning.sources.refresh')}
            </ActionButton>
          </Stack>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(3, minmax(0, 1fr))',
              },
              gap: 1,
            }}
          >
            {overview.sources.map((source) => (
              <SourceCard key={source.series} source={source} locale={locale} timeZone={timeZone} />
            ))}
          </Box>
        </Box>
      </Box>
      {overview.emission ? (
        <Box
          component="section"
          aria-labelledby="space-planning-emission-title"
          sx={workplaceMemberCard}
        >
          <Box p={{ xs: 1.5, md: 2 }}>
            <Stack direction="row" gap={1} alignItems="center">
              <Leaf size={19} color="var(--dwp-product-accent)" aria-hidden="true" />
              <Box>
                <Typography
                  id="space-planning-emission-title"
                  component="h2"
                  variant="h6"
                  fontWeight={780}
                >
                  {t('workplace.spacePlanning.emission.title')}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(`workplace.spacePlanning.emission.kinds.${overview.emission.evidenceKind}`)} ·{' '}
                  {overview.emission.factorVersion} · {overview.emission.regionCode}
                </Typography>
              </Box>
            </Stack>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
                gap: 1,
                mt: 1.5,
              }}
            >
              <Metric
                icon={<Activity size={15} />}
                label={t('workplace.spacePlanning.emission.energy')}
                value={`${overview.emission.energyValue} ${overview.emission.energyUnit}`}
              />
              <Metric
                icon={<Leaf size={15} />}
                label={t('workplace.spacePlanning.emission.co2e')}
                value={`${overview.emission.co2eValue} ${overview.emission.co2eUnit}`}
              />
              <Metric
                icon={<DatabaseZap size={15} />}
                label={t('workplace.spacePlanning.emission.sourceAt')}
                value={instant(overview.emission.sourceAt, locale, timeZone)}
              />
              <Metric
                icon={<DatabaseZap size={15} />}
                label={t('workplace.spacePlanning.emission.evidence')}
                value={overview.emission.evidenceReference}
              />
            </Box>
          </Box>
        </Box>
      ) : (
        <InlineFeedback severity="info" icon={<Leaf size={17} />}>
          {t('workplace.spacePlanning.emission.unavailable')}
        </InlineFeedback>
      )}
    </Stack>
  );
}
