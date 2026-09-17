import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  BellOff,
  ChartNoAxesCombined,
  ChevronRight,
  EyeOff,
  FileWarning,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRoundCheck,
} from 'lucide-react';

import { ActionButton } from '@dwp-frontend/design-system/components/actions/action-button';
import { InlineFeedback } from '@dwp-frontend/design-system/components/inline-feedback/inline-feedback';
import { FormField } from '@dwp-frontend/design-system/components/forms/form-field';
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '@dwp-frontend/design-system/components/states/state-panels';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n/lib/formatters';
import { resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import {
  formatNotificationNoiseDatum,
  resolveNotificationNoiseDatum,
  sortNotificationNoisyTypes,
  validNotificationNoisePrivacyPolicy,
} from './notification-noise-quality-model';

import type { ReactNode } from 'react';
import type {
  NotificationFourEyesPolicy,
  NotificationNoiseDatum,
  NotificationNoiseFinding,
  NotificationNoiseFilters,
  NotificationNoiseMetric,
  NotificationNoiseMetricKey,
  NotificationNoiseMetricUnit,
  NotificationNoiseMetrics,
  NotificationNoisePrivacyPolicy,
  NotificationNoiseQualityState,
  NotificationNoiseRisk,
  NotificationNoiseSeverity,
  NotificationNoiseTimeRange,
  NotificationNoiseTrendPoint,
  NotificationNoisyType,
} from './notification-noise-quality-model';

const METRIC_ORDER: readonly NotificationNoiseMetricKey[] = [
  'MUTED_RATE',
  'DEDUPLICATION_RATE',
  'ACTION_CONVERSION',
  'FATIGUE_COHORT',
];

const TIME_RANGES: ReadonlyArray<[NotificationNoiseTimeRange, string]> = [
  ['LAST_24_HOURS', '24h'],
  ['LAST_7_DAYS', '7d'],
  ['LAST_30_DAYS', '30d'],
];
const SEVERITIES: readonly NotificationNoiseSeverity[] = ['CRITICAL', 'WARNING', 'INFO'];
const RISKS: readonly NotificationNoiseRisk[] = [
  'HIGH_MUTE_RATE',
  'LOW_ACTION_CONVERSION',
  'DEDUPLICATION_OPPORTUNITY',
];

function findingColor(
  severity: NotificationNoiseFinding['severity']
): 'default' | 'warning' | 'error' {
  if (severity === 'CRITICAL') return 'error';
  if (severity === 'WARNING') return 'warning';
  return 'default';
}

function trendRate(value: number | null, locale: 'en' | 'ko') {
  return value == null ? '-' : `${formatNumber(value * 100, { maximumFractionDigits: 1 }, locale)}%`;
}

function DatumValue({
  datum,
  unit,
  privacyPolicy,
  locale,
  compact = false,
}: {
  datum: NotificationNoiseDatum;
  unit: NotificationNoiseMetricUnit;
  privacyPolicy?: NotificationNoisePrivacyPolicy | null;
  locale: string;
  compact?: boolean;
}) {
  const { t } = useTranslation('notifications');
  const resolved = resolveNotificationNoiseDatum(datum, privacyPolicy, unit);
  if (resolved.visible) {
    const value = formatNotificationNoiseDatum(datum, unit, privacyPolicy, locale);
    return (
      <Typography
        component="span"
        variant={compact ? 'body2' : 'h6'}
        fontWeight="fontWeightBold"
        sx={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value ?? String(resolved.value)}
      </Typography>
    );
  }
  const label =
    resolved.reason === 'PRIVACY'
      ? t('noiseQuality.datum.withheld')
      : resolved.reason === 'ERROR'
        ? t('noiseQuality.datum.unavailable')
        : t('noiseQuality.datum.noData');
  const detail =
    resolved.reason === 'PRIVACY'
      ? (privacyPolicy?.explanation ?? t('noiseQuality.datum.privacyUnavailable'))
      : (datum.note ?? t('noiseQuality.datum.missing'));
  return (
    <Tooltip title={detail}>
      <Stack component="span" direction="row" gap={0.5} alignItems="center" color="text.secondary">
        {resolved.reason === 'PRIVACY' ? (
          <EyeOff size={14} aria-hidden />
        ) : (
          <FileWarning size={14} aria-hidden />
        )}
        <Typography component="span" variant="caption">
          {label}
        </Typography>
      </Stack>
    </Tooltip>
  );
}

function NoiseMetricCell({
  metric,
  privacyPolicy,
  locale,
}: {
  metric: NotificationNoiseMetric;
  privacyPolicy?: NotificationNoisePrivacyPolicy | null;
  locale: string;
}) {
  const visibility = resolveNotificationNoiseDatum(metric.datum, privacyPolicy, metric.unit);
  return (
    <Box
      component="article"
      data-noise-metric={metric.key}
      data-value-visibility={visibility.visible ? 'visible' : visibility.reason.toLowerCase()}
      sx={{
        minWidth: 0,
        minHeight: 112,
        p: 1.5,
        borderRight: 1,
        borderColor: 'divider',
        '&:last-of-type': { borderRight: 0 },
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {metric.label}
      </Typography>
      <Box sx={{ mt: 0.75, minHeight: 30, display: 'flex', alignItems: 'center' }}>
        <DatumValue
          datum={metric.datum}
          unit={metric.unit}
          privacyPolicy={privacyPolicy}
          locale={locale}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
        {metric.description}
      </Typography>
    </Box>
  );
}

function NoiseInvestigationFilters({
  filters,
  onChange,
}: {
  filters: NotificationNoiseFilters;
  onChange: (filters: NotificationNoiseFilters) => void;
}) {
  const { t } = useTranslation('notifications');
  const resettable = Boolean(filters.search || filters.severity || filters.risk);
  return (
    <Box sx={{ px: { xs: 1.25, sm: 1.5 }, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction={{ xs: 'column', lg: 'row' }} gap={1} alignItems={{ lg: 'center' }}>
        <FormField
          value={filters.search}
          onChange={(event) => onChange({ ...filters, search: event.target.value.slice(0, 120) })}
          placeholder={t('admin.contracts.searchPlaceholder')}
          inputProps={{ maxLength: 120 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} aria-hidden />
                </InputAdornment>
              ),
            },
          }}
          sx={{ flex: { xs: '0 0 auto', lg: '1 1 260px' }, width: { xs: '100%', lg: 'auto' }, minWidth: 0 }}
        />
        <Stack direction="row" gap={0.5} flexWrap="wrap" aria-label={t('noiseQuality.title')}>
          {TIME_RANGES.map(([range, label]) => (
            <ActionButton
              key={range}
              intent={filters.range === range ? 'primary' : 'quiet'}
              size="small"
              aria-pressed={filters.range === range}
              onClick={() => onChange({ ...filters, range })}
            >
              {label}
            </ActionButton>
          ))}
        </Stack>
      </Stack>
      <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap" sx={{ mt: 1 }}>
        {SEVERITIES.map((severity) => (
          <Chip
            key={severity}
            size="small"
            clickable
            variant={filters.severity === severity ? 'filled' : 'outlined'}
            color={findingColor(severity)}
            aria-pressed={filters.severity === severity}
            label={t(`admin.severity.${severity}`)}
            onClick={() =>
              onChange({
                ...filters,
                severity: filters.severity === severity ? null : severity,
              })
            }
          />
        ))}
        {RISKS.map((risk) => (
          <Chip
            key={risk}
            size="small"
            clickable
            variant={filters.risk === risk ? 'filled' : 'outlined'}
            aria-pressed={filters.risk === risk}
            label={t(`noiseQuality.findings.${risk}.label`)}
            onClick={() => onChange({ ...filters, risk: filters.risk === risk ? null : risk })}
          />
        ))}
        {resettable && (
          <ActionButton
            intent="quiet"
            size="small"
            onClick={() => onChange({ ...filters, search: '', severity: null, risk: null })}
          >
            {t('filters.reset')}
          </ActionButton>
        )}
      </Stack>
    </Box>
  );
}

function NoiseTrend({
  points,
  range,
  locale,
}: {
  points: readonly NotificationNoiseTrendPoint[];
  range: NotificationNoiseTimeRange;
  locale: string;
}) {
  const { t } = useTranslation('notifications');
  if (points.length === 0) return null;
  const maximum = Math.max(...points.map((point) => point.volume), 1);
  const supportedLocale = resolveSupportedLocale(locale);
  return (
    <Box sx={{ px: { xs: 1.25, sm: 1.5 }, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
      <Typography component="h3" variant="subtitle2">
        {t('admin.overview.trendTitle')}
      </Typography>
      <Box
        role="img"
        aria-label={t('admin.overview.trendChartLabel')}
        sx={{ mt: 1, display: 'flex', gap: 0.5, alignItems: 'flex-end', minHeight: 78, overflowX: 'auto' }}
      >
        {points.map((point) => (
          <Tooltip
            key={point.bucketStart}
            title={`${formatDate(point.bucketStart, {
              dateStyle: 'medium', ...(range === 'LAST_24_HOURS' ? { timeStyle: 'short' as const } : {}),
            }, supportedLocale)} · ${t('noiseQuality.types.sent')} ${formatNumber(point.volume, {}, supportedLocale)} · ${t('noiseQuality.types.muted')} ${trendRate(point.muteRate, supportedLocale)} · ${t('noiseQuality.types.deduplicated')} ${trendRate(point.deduplicationRate, supportedLocale)} · ${t('noiseQuality.types.actionConversion')} ${trendRate(point.actionConversionRate, supportedLocale)}`}
          >
            <Box sx={{ flex: '1 0 16px', minWidth: 16, textAlign: 'center' }}>
              <Box
                sx={{
                  height: Math.max(6, Math.round((point.volume / maximum) * 54)),
                  bgcolor: point.muteRate != null && point.muteRate >= 0.25 ? 'warning.main' : 'primary.main',
                  borderRadius: foundationTokens.radius.compact,
                }}
              />
            </Box>
          </Tooltip>
        ))}
      </Box>
    </Box>
  );
}

function FindingAction({
  item,
  onOpenFinding,
}: {
  item: NotificationNoisyType;
  onOpenFinding?: (item: NotificationNoisyType, finding: NotificationNoiseFinding) => void;
}) {
  const { t } = useTranslation('notifications');
  if (!item.finding) {
    return (
      <Typography variant="caption" color="text.secondary">
        {t('noiseQuality.finding.none')}
      </Typography>
    );
  }
  return (
    <Stack gap={0.5} alignItems="flex-start">
      <Chip
        size="small"
        variant="outlined"
        color={findingColor(item.finding.severity)}
        label={item.finding.label}
      />
      {onOpenFinding && (
        <ActionButton
          intent="quiet"
          size="small"
          endIcon={<ArrowUpRight size={14} />}
          onClick={() => onOpenFinding(item, item.finding!)}
          sx={{ px: 0.5 }}
        >
          {t(`noiseQuality.targets.${item.finding.target}`)}
        </ActionButton>
      )}
    </Stack>
  );
}

function DesktopNoisyTypes({
  items,
  privacyPolicy,
  locale,
  onInspectType,
  onOpenFinding,
}: {
  items: readonly NotificationNoisyType[];
  privacyPolicy?: NotificationNoisePrivacyPolicy | null;
  locale: string;
  onInspectType?: (item: NotificationNoisyType) => void;
  onOpenFinding?: (item: NotificationNoisyType, finding: NotificationNoiseFinding) => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <Box sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto' }}>
      <Table size="small" aria-label={t('noiseQuality.types.tableLabel')} sx={{ minWidth: 960 }}>
        <TableHead>
          <TableRow>
            <TableCell>{t('noiseQuality.types.appType')}</TableCell>
            <TableCell align="right">{t('noiseQuality.types.sent')}</TableCell>
            <TableCell align="right">{t('noiseQuality.types.muted')}</TableCell>
            <TableCell align="right">{t('noiseQuality.types.deduplicated')}</TableCell>
            <TableCell align="right">{t('noiseQuality.types.actionConversion')}</TableCell>
            <TableCell>{t('noiseQuality.types.owner')}</TableCell>
            <TableCell>{t('noiseQuality.types.finding')}</TableCell>
            {onInspectType && <TableCell padding="checkbox" />}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.typeId} hover>
              <TableCell>
                <Typography variant="subtitle2">{item.typeLabel}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.appLabel}
                </Typography>
              </TableCell>
              <TableCell align="right">
                <DatumValue
                  datum={item.sent}
                  unit="COUNT"
                  privacyPolicy={privacyPolicy}
                  locale={locale}
                  compact
                />
              </TableCell>
              <TableCell align="right">
                <DatumValue
                  datum={item.mutedRate}
                  unit="PERCENT"
                  privacyPolicy={privacyPolicy}
                  locale={locale}
                  compact
                />
              </TableCell>
              <TableCell align="right">
                <DatumValue
                  datum={item.deduplicationRate}
                  unit="PERCENT"
                  privacyPolicy={privacyPolicy}
                  locale={locale}
                  compact
                />
              </TableCell>
              <TableCell align="right">
                <DatumValue
                  datum={item.actionConversion}
                  unit="PERCENT"
                  privacyPolicy={privacyPolicy}
                  locale={locale}
                  compact
                />
              </TableCell>
              <TableCell>
                <Typography variant="body2">
                  {item.ownerLabel ?? t('noiseQuality.types.notProvided')}
                </Typography>
              </TableCell>
              <TableCell>
                <FindingAction item={item} onOpenFinding={onOpenFinding} />
              </TableCell>
              {onInspectType && (
                <TableCell padding="checkbox">
                  <Tooltip title={t('noiseQuality.types.inspect')}>
                    <ActionButton
                      intent="quiet"
                      size="small"
                      aria-label={t('noiseQuality.types.inspectLabel', {
                        app: item.appLabel,
                        type: item.typeLabel,
                      })}
                      onClick={() => onInspectType(item)}
                      sx={{ minWidth: 36, px: 0.5 }}
                    >
                      <ChevronRight size={17} />
                    </ActionButton>
                  </Tooltip>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function MobileMetric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Box minWidth={0}>
      <Typography component="dt" variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Box component="dd" sx={{ m: 0, mt: 0.25 }}>
        {children}
      </Box>
    </Box>
  );
}

function MobileNoisyTypes({
  items,
  privacyPolicy,
  locale,
  onInspectType,
  onOpenFinding,
}: {
  items: readonly NotificationNoisyType[];
  privacyPolicy?: NotificationNoisePrivacyPolicy | null;
  locale: string;
  onInspectType?: (item: NotificationNoisyType) => void;
  onOpenFinding?: (item: NotificationNoisyType, finding: NotificationNoiseFinding) => void;
}) {
  const { t } = useTranslation('notifications');
  return (
    <Box
      component="ul"
      sx={{ display: { xs: 'block', md: 'none' }, p: 0, m: 0, listStyle: 'none' }}
    >
      {items.map((item) => (
        <Box
          component="li"
          key={item.typeId}
          sx={{ px: 1.25, py: 1.5, borderBottom: 1, borderColor: 'divider' }}
        >
          <Stack direction="row" justifyContent="space-between" gap={1} alignItems="flex-start">
            <Box minWidth={0}>
              <Typography component="h4" variant="subtitle2" sx={{ overflowWrap: 'anywhere' }}>
                {item.typeLabel}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {item.appLabel} · {item.ownerLabel ?? t('noiseQuality.types.ownerNotProvided')}
              </Typography>
            </Box>
            {onInspectType && (
              <ActionButton
                intent="quiet"
                size="small"
                aria-label={t('noiseQuality.types.inspectLabel', {
                  app: item.appLabel,
                  type: item.typeLabel,
                })}
                onClick={() => onInspectType(item)}
                sx={{ minWidth: 34, px: 0.5 }}
              >
                <ChevronRight size={17} />
              </ActionButton>
            )}
          </Stack>
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 1,
              m: 0,
              mt: 1.25,
            }}
          >
            <MobileMetric label={t('noiseQuality.types.sent')}>
              <DatumValue
                datum={item.sent}
                unit="COUNT"
                privacyPolicy={privacyPolicy}
                locale={locale}
                compact
              />
            </MobileMetric>
            <MobileMetric label={t('noiseQuality.types.muted')}>
              <DatumValue
                datum={item.mutedRate}
                unit="PERCENT"
                privacyPolicy={privacyPolicy}
                locale={locale}
                compact
              />
            </MobileMetric>
            <MobileMetric label={t('noiseQuality.types.deduplicated')}>
              <DatumValue
                datum={item.deduplicationRate}
                unit="PERCENT"
                privacyPolicy={privacyPolicy}
                locale={locale}
                compact
              />
            </MobileMetric>
            <MobileMetric label={t('noiseQuality.types.actionConversion')}>
              <DatumValue
                datum={item.actionConversion}
                unit="PERCENT"
                privacyPolicy={privacyPolicy}
                locale={locale}
                compact
              />
            </MobileMetric>
          </Box>
          {item.finding && (
            <Box sx={{ mt: 1.25, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
                <Chip
                  size="small"
                  variant="outlined"
                  color={findingColor(item.finding.severity)}
                  label={item.finding.label}
                />
                <Typography variant="caption" color="text.secondary">
                  {item.finding.targetLabel}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>
                {item.finding.summary}
              </Typography>
              {onOpenFinding && (
                <ActionButton
                  intent="quiet"
                  size="small"
                  endIcon={<ArrowUpRight size={14} />}
                  onClick={() => onOpenFinding(item, item.finding!)}
                  sx={{ mt: 0.5, px: 0.5 }}
                >
                  {t('noiseQuality.finding.open', {
                    target: t(`noiseQuality.targets.${item.finding.target}`),
                  })}
                </ActionButton>
              )}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

function FourEyesSummary({
  policy,
  onOpenPolicy,
}: {
  policy: NotificationFourEyesPolicy;
  onOpenPolicy?: () => void;
}) {
  const { t } = useTranslation('notifications');
  const titleId = useId();
  const color =
    policy.state === 'ENFORCED'
      ? 'success'
      : policy.state === 'NOT_CONFIGURED'
        ? 'warning'
        : 'default';
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      sx={{ borderTop: 1, borderColor: 'divider', px: { xs: 1.25, sm: 1.5 }, py: 1.5 }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'flex-start' }}
        gap={1}
      >
        <Stack direction="row" gap={1} alignItems="flex-start">
          <UserRoundCheck size={19} aria-hidden />
          <Box minWidth={0}>
            <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
              <Typography id={titleId} component="h3" variant="subtitle2">
                {t('noiseQuality.fourEyes.title')}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                color={color}
                label={
                  policy.state === 'ENFORCED'
                    ? t('noiseQuality.fourEyes.states.ENFORCED')
                    : policy.state === 'NOT_CONFIGURED'
                      ? t('noiseQuality.fourEyes.states.NOT_CONFIGURED')
                      : t('noiseQuality.fourEyes.states.UNAVAILABLE')
                }
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              {policy.summary}
            </Typography>
          </Box>
        </Stack>
        {onOpenPolicy && policy.canOpenPolicy && (
          <ActionButton
            intent="secondary"
            size="small"
            endIcon={<ArrowUpRight size={15} />}
            onClick={onOpenPolicy}
          >
            {t('noiseQuality.fourEyes.openPolicy')}
          </ActionButton>
        )}
      </Stack>
      <Box
        component="ol"
        sx={{
          p: 0,
          m: 0,
          mt: 1.25,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
          border: 1,
          borderColor: 'divider',
          listStyle: 'none',
        }}
      >
        {[policy.draftLabel, policy.reviewLabel].map((label, index) => (
          <Box
            component="li"
            key={`${index}-${label}`}
            sx={{
              display: 'grid',
              gridTemplateColumns: '24px minmax(0, 1fr)',
              gap: 0.75,
              p: 1,
              borderRight: { sm: index === 0 ? 1 : 0 },
              borderBottom: { xs: index === 0 ? 1 : 0, sm: 0 },
              borderColor: 'divider',
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                width: 22,
                height: 22,
                display: 'grid',
                placeItems: 'center',
                border: 1,
                borderColor: 'divider',
                borderRadius: '50%',
                typography: 'caption',
              }}
            >
              {index + 1}
            </Box>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
        {policy.state === 'UNAVAILABLE'
          ? t('noiseQuality.fourEyes.separationUnavailable')
          : policy.state === 'NOT_CONFIGURED'
            ? t('noiseQuality.fourEyes.separationNotConfigured')
            : policy.reviewerSeparationRequired
              ? t('noiseQuality.fourEyes.separationRequired')
              : t('noiseQuality.fourEyes.separationNotRequired')}
        {policy.updatedAt
          ? t('noiseQuality.fourEyes.updated', {
              date: formatDate(policy.updatedAt, {
                dateStyle: 'medium',
                timeStyle: 'short',
              }),
            })
          : ''}
      </Typography>
    </Box>
  );
}

export type NotificationNoiseQualityPanelProps = {
  metrics?: NotificationNoiseMetrics;
  noisyTypes?: readonly NotificationNoisyType[];
  trend?: readonly NotificationNoiseTrendPoint[];
  filters?: NotificationNoiseFilters;
  state: NotificationNoiseQualityState;
  privacyPolicy?: NotificationNoisePrivacyPolicy | null;
  fourEyesPolicy: NotificationFourEyesPolicy;
  generatedAt?: string;
  locale?: string;
  retrying?: boolean;
  onRetry?: () => void;
  onFiltersChange?: (filters: NotificationNoiseFilters) => void;
  onInspectType?: (item: NotificationNoisyType) => void;
  onOpenFinding?: (item: NotificationNoisyType, finding: NotificationNoiseFinding) => void;
  onOpenPolicy?: () => void;
};

export function NotificationNoiseQualityPanel({
  metrics,
  noisyTypes = [],
  trend = [],
  filters,
  state,
  privacyPolicy,
  fourEyesPolicy,
  generatedAt,
  locale = 'en',
  retrying = false,
  onRetry,
  onFiltersChange,
  onInspectType,
  onOpenFinding,
  onOpenPolicy,
}: NotificationNoiseQualityPanelProps) {
  const { t } = useTranslation('notifications');
  const titleId = useId();
  const orderedTypes = sortNotificationNoisyTypes(noisyTypes);
  const validPrivacyPolicy = validNotificationNoisePrivacyPolicy(privacyPolicy);
  return (
    <Box
      component="section"
      aria-labelledby={titleId}
      data-testid="notification-noise-quality-panel"
      sx={{
        minWidth: 0,
        bgcolor: 'background.paper',
        borderBlock: 1,
        borderColor: 'divider',
        '& .MuiChip-outlinedWarning': {
          color: 'text.primary',
          borderColor: 'warning.dark',
        },
        '& .MuiChip-outlinedInfo': { color: 'text.primary', borderColor: 'info.dark' },
        '@media (prefers-reduced-motion: reduce)': {
          '& *, & *::before, & *::after': { transition: 'none !important' },
        },
        '@media (forced-colors: active)': {
          borderColor: 'CanvasText',
          '& [class*="MuiChip"]': { border: '1px solid CanvasText' },
        },
      }}
    >
      <Box sx={{ px: { xs: 1.25, sm: 1.5 }, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', sm: 'flex-start' }}
          gap={1}
        >
          <Stack direction="row" gap={1} alignItems="flex-start">
            <ChartNoAxesCombined size={20} aria-hidden />
            <Box minWidth={0}>
              <Typography id={titleId} component="h2" variant="h6">
                {t('noiseQuality.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('noiseQuality.description')}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" gap={0.75} alignItems="center" flexWrap="wrap">
            {generatedAt && (
              <Typography variant="caption" color="text.secondary">
                {t('noiseQuality.asOf', {
                  date: formatDate(generatedAt, { dateStyle: 'medium', timeStyle: 'short' }),
                })}
              </Typography>
            )}
            {onRetry && (
              <ActionButton
                intent="quiet"
                size="small"
                startIcon={<RefreshCw size={15} />}
                loading={retrying}
                loadingLabel={t('noiseQuality.refreshing')}
                onClick={onRetry}
              >
                {t('actions.refresh')}
              </ActionButton>
            )}
          </Stack>
        </Stack>
      </Box>

      {filters && onFiltersChange && (
        <NoiseInvestigationFilters filters={filters} onChange={onFiltersChange} />
      )}

      {state.kind === 'PARTIAL' && (
        <InlineFeedback severity="warning" sx={{ m: 1.25 }}>
          {state.message}
        </InlineFeedback>
      )}

      {state.kind === 'LOADING' ? (
        <LoadingState
          label={t('states.loadingAdmin')}
          variant="skeleton"
          skeletonHeights={[112, 220, 100]}
          embedded
        />
      ) : state.kind === 'ERROR' ? (
        <ErrorState
          title={t('states.adminErrorTitle')}
          description={state.message}
          retryLabel={onRetry ? t('actions.retry') : undefined}
          onRetry={onRetry}
          retrying={retrying}
          size="compact"
        />
      ) : state.kind === 'MISSING' ? (
        <EmptyState
          icon={<FileWarning size={28} />}
          title={t('noiseQuality.missingTitle')}
          description={state.message}
          size="compact"
        />
      ) : (
        <>
          {metrics ? (
            <Box
              aria-label={t('noiseQuality.metricsLabel')}
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  lg: 'repeat(4, minmax(0, 1fr))',
                },
                borderBottom: 1,
                borderColor: 'divider',
                '& > article:nth-of-type(2n)': { borderRight: { xs: 0, lg: 1 } },
                '& > article:nth-of-type(n+3)': {
                  borderTop: { xs: 1, lg: 0 },
                  borderColor: 'divider',
                },
                '& > article:last-of-type': { borderRight: 0 },
              }}
            >
              {METRIC_ORDER.map((key) => (
                <NoiseMetricCell
                  key={key}
                  metric={metrics[key]}
                  privacyPolicy={privacyPolicy}
                  locale={locale}
                />
              ))}
            </Box>
          ) : (
            <InlineFeedback severity="warning" sx={{ borderRadius: 0 }}>
              {t('noiseQuality.metricsMissing')}
            </InlineFeedback>
          )}

          <NoiseTrend points={trend} range={filters?.range ?? 'LAST_30_DAYS'} locale={locale} />

          {validPrivacyPolicy ? (
            <Box
              sx={{
                px: { xs: 1.25, sm: 1.5 },
                py: 1,
                display: 'flex',
                gap: 0.75,
                alignItems: 'flex-start',
                borderBottom: 1,
                borderColor: 'divider',
                color: 'text.secondary',
              }}
            >
              <ShieldCheck size={16} aria-hidden />
              <Typography variant="caption">
                {t('noiseQuality.privacy.guard', {
                  count: privacyPolicy.minimumCohortSize,
                  explanation: privacyPolicy.explanation,
                })}
              </Typography>
            </Box>
          ) : (
            <InlineFeedback severity="error" sx={{ borderRadius: 0 }}>
              {t('noiseQuality.privacy.unavailable')}
            </InlineFeedback>
          )}

          <Box component="section" aria-labelledby={`${titleId}-types`}>
            <Box
              sx={{ px: { xs: 1.25, sm: 1.5 }, py: 1.25, borderBottom: 1, borderColor: 'divider' }}
            >
              <Stack direction="row" gap={0.75} alignItems="center">
                <BellOff size={17} aria-hidden />
                <Typography id={`${titleId}-types`} component="h3" variant="subtitle2">
                  {t('noiseQuality.types.title')}
                </Typography>
              </Stack>
            </Box>
            {state.kind === 'EMPTY' || orderedTypes.length === 0 ? (
              <EmptyState
                icon={<ShieldCheck size={28} />}
                title={t('noiseQuality.types.emptyTitle')}
                description={
                  state.kind === 'EMPTY' && state.message
                    ? state.message
                    : t('noiseQuality.types.emptyDescription')
                }
                size="compact"
              />
            ) : (
              <>
                <DesktopNoisyTypes
                  items={orderedTypes}
                  privacyPolicy={privacyPolicy}
                  locale={locale}
                  onInspectType={onInspectType}
                  onOpenFinding={onOpenFinding}
                />
                <MobileNoisyTypes
                  items={orderedTypes}
                  privacyPolicy={privacyPolicy}
                  locale={locale}
                  onInspectType={onInspectType}
                  onOpenFinding={onOpenFinding}
                />
              </>
            )}
          </Box>
        </>
      )}

      <FourEyesSummary policy={fourEyesPolicy} onOpenPolicy={onOpenPolicy} />
    </Box>
  );
}
