import { useTranslation } from 'react-i18next';
import { formatDate, formatNumber, resolveSupportedLocale } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { alpha, useTheme } from '@mui/material/styles';

import { approvalAdminTrendView } from './approval-admin-trend-model';
import { ApprovalSurface, approvalTone } from './approval-ui';

import type { ApprovalAdminPulse } from '@dwp-frontend/shared-utils';

const CHART_WIDTH = 720;
const CHART_TOP = 12;
const CHART_BASELINE = 128;
const LABEL_BUCKETS = [0, 4, 8, 11] as const;

export function ApprovalAdminTrend({ trend }: { trend: ApprovalAdminPulse['trend'] }) {
  const { t, i18n } = useTranslation('approvals');
  const theme = useTheme();
  const view = approvalAdminTrendView(trend);
  if (!view) return null;
  const locale = resolveSupportedLocale(i18n.resolvedLanguage, i18n.language);
  const xFor = (index: number) => (index / (view.trend.buckets.length - 1)) * CHART_WIDTH;
  const yFor = (value: number) =>
    CHART_TOP + (1 - value / view.maximumInFlight) * (CHART_BASELINE - CHART_TOP);
  const points = view.trend.buckets.map((bucket, index) => ({
    bucket,
    x: xFor(index),
    y: yFor(bucket.inFlightRequests),
  }));
  const linePoints = points.map(({ x, y }) => `${x},${y}`).join(' ');
  const areaPoints = `0,${CHART_BASELINE} ${linePoints} ${CHART_WIDTH},${CHART_BASELINE}`;
  const compliance =
    view.slaCompliancePercent === undefined
      ? t('admin.overview.trend.complianceUnavailable')
      : t('admin.overview.trend.compliance', {
          value: formatNumber(view.slaCompliancePercent, { maximumFractionDigits: 1 }, locale),
        });

  return (
    <ApprovalSurface
      title={t('admin.overview.trend.title')}
      meta={t('admin.overview.trend.meta', {
        hours: view.trend.windowHours,
        bucketHours: view.trend.bucketHours,
      })}
    >
      <Stack gap={1.5} sx={{ p: 2 }} data-testid="approval-admin-trend">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          gap={0.5}
        >
          <Box sx={{ typography: 'body2', color: 'text.secondary' }}>
            {t('admin.overview.trend.actualSource')}
          </Box>
          <Box
            sx={{
              typography: 'subtitle2',
              color:
                view.slaCompliancePercent === undefined
                  ? 'text.secondary'
                  : theme.palette.mode === 'dark'
                    ? theme.palette.success.light
                    : approvalTone.teal,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {compliance}
          </Box>
        </Stack>

        <Box
          role="img"
          aria-label={t('admin.overview.trend.chartLabel', {
            maximum: view.maximumInFlight,
            submittedRequests: view.totals.submittedRequests,
            completedRequests: view.totals.completedRequests,
            slaBreaches: view.totals.slaBreaches,
          })}
          sx={{
            minWidth: 0,
            overflow: 'hidden',
            bgcolor: alpha(approvalTone.primary, 0.045),
            border: 1,
            borderColor: alpha(approvalTone.primary, 0.1),
            px: { xs: 1, sm: 1.5 },
            pt: 1.25,
          }}
        >
          <Box
            component="svg"
            viewBox={`0 0 ${CHART_WIDTH} 136`}
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
            sx={{ display: 'block', width: 1, height: { xs: 160, sm: 180 } }}
          >
            {[CHART_TOP, (CHART_TOP + CHART_BASELINE) / 2, CHART_BASELINE].map((y) => (
              <line
                key={y}
                x1="0"
                x2={CHART_WIDTH}
                y1={y}
                y2={y}
                stroke={alpha(approvalTone.primary, 0.12)}
                strokeWidth="1"
                strokeDasharray="4 5"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            <polygon points={areaPoints} fill={alpha(approvalTone.primary, 0.13)} />
            <polyline
              points={linePoints}
              fill="none"
              stroke={approvalTone.primary}
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {points.map(({ bucket, x, y }, index) => (
              <g key={bucket.startsAt}>
                <circle
                  cx={x}
                  cy={y}
                  r={index === points.length - 1 ? 5 : 3.5}
                  fill={
                    index === points.length - 1 ? approvalTone.red : theme.palette.background.paper
                  }
                  stroke={
                    index === points.length - 1
                      ? theme.palette.background.paper
                      : approvalTone.primary
                  }
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
          </Box>
          <Box
            aria-hidden="true"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4,minmax(0,1fr))',
              gap: 0.5,
              pb: 1,
              typography: 'caption',
              color: 'text.secondary',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {LABEL_BUCKETS.map((index, labelIndex) => (
              <Box
                key={index}
                sx={{
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                  textAlign: labelIndex === 0 ? 'left' : labelIndex === 3 ? 'right' : 'center',
                  color:
                    labelIndex === 3
                      ? theme.palette.mode === 'dark'
                        ? theme.palette.error.light
                        : approvalTone.red
                      : 'inherit',
                }}
              >
                {formatDate(
                  Date.parse(view.trend.buckets[index]!.startsAt),
                  { month: 'numeric', day: 'numeric', hour: '2-digit' },
                  locale
                )}
              </Box>
            ))}
          </Box>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2,minmax(0,1fr))',
              sm: 'repeat(4,minmax(0,1fr))',
            },
            gap: 1,
          }}
        >
          {(
            [
              ['inFlightRequests', view.trend.buckets.at(-1)?.inFlightRequests ?? 0],
              ['submittedRequests', view.totals.submittedRequests],
              ['completedRequests', view.totals.completedRequests],
              ['slaBreaches', view.totals.slaBreaches],
            ] as const
          ).map(([key, value]) => (
            <Box
              key={key}
              sx={{ minWidth: 0, borderLeft: 3, borderColor: approvalTone.primary, pl: 1 }}
            >
              <Box sx={{ typography: 'subtitle1', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </Box>
              <Box
                sx={{ typography: 'caption', color: 'text.secondary', overflowWrap: 'anywhere' }}
              >
                {t(`admin.overview.trend.series.${key}`)}
              </Box>
            </Box>
          ))}
        </Box>
      </Stack>
    </ApprovalSurface>
  );
}
