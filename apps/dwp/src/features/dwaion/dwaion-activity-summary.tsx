import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Clock3,
  ListChecks,
} from 'lucide-react';
import { ActionButton, SignalMetric } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { DWAION_ACTIVITY_WINDOW_LIMIT } from './dwaion-activity-model';

import type { DwaionActivityFilter, DwaionActivityWindowSummary } from './dwaion-activity-model';

export function DwaionActivitySummary({
  metrics,
  filter,
  onFilter,
}: {
  metrics: DwaionActivityWindowSummary;
  filter: DwaionActivityFilter;
  onFilter: (filter: DwaionActivityFilter) => void;
}) {
  const { t } = useTranslation('work');
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const shortHeight = useMediaQuery('(max-height: 640px)');
  const collapsible = compact && shortHeight;
  const [expanded, setExpanded] = useState(false);
  const summaryPanelId = useId();
  const windowNoticeId = useId();
  const signals = [
    { key: 'total', filter: 'ALL', value: metrics.total, icon: ListChecks, tone: 'primary' },
    { key: 'running', filter: 'RUNNING', value: metrics.running, icon: Clock3, tone: 'info' },
    {
      key: 'completed',
      filter: 'COMPLETED',
      value: metrics.completed,
      icon: CheckCircle2,
      tone: 'success',
    },
    {
      key: 'attention',
      filter: 'ATTENTION',
      value: metrics.attention,
      icon: CircleAlert,
      tone: metrics.attention ? 'warning' : 'neutral',
    },
  ] as const;

  return (
    <Box
      component="section"
      aria-label={t('dwaionActivity.summaryLabel')}
      sx={{ mt: collapsible ? 1.5 : 2.5 }}
    >
      {collapsible && (
        <ActionButton
          intent="secondary"
          fullWidth
          aria-label={[
            `${t('dwaionActivity.summaryLabel')}: ${t('dwaionActivity.compactSummary', metrics)}`,
            ...(metrics.sample > 0
              ? [
                  t('dwaionActivity.observability.sample.summaryExcluded', {
                    count: metrics.sample,
                  }),
                ]
              : []),
          ].join(' · ')}
          aria-expanded={expanded}
          aria-controls={summaryPanelId}
          aria-describedby={windowNoticeId}
          endIcon={
            expanded ? (
              <ChevronUp size={17} aria-hidden="true" />
            ) : (
              <ChevronDown size={17} aria-hidden="true" />
            )
          }
          onClick={() => setExpanded((value) => !value)}
          sx={{ minHeight: 44, justifyContent: 'space-between' }}
        >
          {t('dwaionActivity.compactSummary', metrics)}
        </ActionButton>
      )}
      <Box
        id={summaryPanelId}
        sx={{
          display: collapsible && !expanded ? 'none' : 'grid',
          mt: collapsible && expanded ? 1 : 0,
          gridTemplateColumns: {
            xs: 'repeat(4, minmax(0, 1fr))',
            md: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(4, minmax(0, 1fr))',
          },
          gap: { xs: 0.5, md: 1.5 },
        }}
      >
        {signals.map(({ key, value, icon: Icon, tone, filter: signalFilter }) => {
          const label = t(`dwaionActivity.metrics.${key}`);
          const detail = t(`dwaionActivity.metrics.${key}Detail`);
          if (compact) {
            return (
              <ActionButton
                key={key}
                intent="quiet"
                aria-label={`${label}: ${value} · ${t(`dwaionActivity.mobileMetrics.${key}`)} · ${detail}`}
                aria-pressed={filter === signalFilter}
                onClick={() => onFilter(signalFilter)}
                sx={{
                  minWidth: 44,
                  minHeight: 76,
                  px: 0.5,
                  py: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 0.5,
                  color: 'text.primary',
                  bgcolor: 'var(--dwp-product-soft)',
                  border: 1,
                  borderColor: filter === signalFilter ? 'primary.main' : 'transparent',
                }}
              >
                <Typography component="span" variant="caption" sx={{ overflowWrap: 'anywhere' }}>
                  {t(`dwaionActivity.mobileMetrics.${key}`)}
                </Typography>
                <Typography
                  component="span"
                  variant="h5"
                  sx={{
                    fontVariantNumeric: 'tabular-nums',
                    color:
                      tone === 'neutral'
                        ? 'text.primary'
                        : theme.palette[tone][theme.palette.mode === 'dark' ? 'light' : 'dark'],
                  }}
                >
                  {value}
                </Typography>
              </ActionButton>
            );
          }
          return (
            <Box
              key={key}
              sx={{
                minWidth: 0,
                '& > button': {
                  borderColor: filter === signalFilter ? 'primary.main' : 'divider',
                  bgcolor: filter === signalFilter ? 'var(--dwp-product-soft)' : 'background.paper',
                },
              }}
            >
              <SignalMetric
                label={label}
                value={String(value)}
                detail={detail}
                icon={<Icon size={18} aria-hidden="true" />}
                tone={tone}
                progress={metrics.total ? (value / metrics.total) * 100 : 0}
                actionLabel={`${label}: ${value} · ${detail}`}
                onClick={() => onFilter(signalFilter)}
              />
            </Box>
          );
        })}
      </Box>
      <Typography
        id={windowNoticeId}
        variant="caption"
        color="text.secondary"
        component="p"
        sx={{ mt: 1, display: collapsible && !expanded ? 'none' : 'block' }}
      >
        {t(compact ? 'dwaionActivity.mobileWindowNotice' : 'dwaionActivity.windowNotice', {
          count: DWAION_ACTIVITY_WINDOW_LIMIT,
        })}
      </Typography>
      {metrics.sample > 0 && (
        <Stack
          direction="row"
          gap={0.75}
          alignItems="center"
          flexWrap="wrap"
          role="status"
          data-testid="dwaion-sample-summary"
          sx={{ mt: 0.75, display: collapsible && !expanded ? 'none' : 'flex' }}
        >
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label={t('dwaionActivity.observability.sample.title')}
            sx={{ color: 'text.primary' }}
          />
          <Typography variant="caption" color="text.secondary">
            {t('dwaionActivity.observability.sample.summaryExcluded', {
              count: metrics.sample,
            })}
          </Typography>
        </Stack>
      )}
    </Box>
  );
}
