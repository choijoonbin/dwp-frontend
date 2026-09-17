import { useTranslation } from 'react-i18next';
import { CheckCircle2, CircleAlert, Clock3, ListChecks } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

import { DWAION_ACTIVITY_PAGE_LIMIT } from './dwaion-activity-model';

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
      sx={{
        mt: 1,
        p: { xs: 0.75, sm: 0.9 },
        borderRadius: (theme) => Number(theme.shape.borderRadius) * 1.5 + 'px',
        bgcolor: 'background.paper',
        boxShadow: (theme) => `0 1px 5px ${alpha(theme.palette.text.primary, 0.05)}`,
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          borderRadius: (theme) => Number(theme.shape.borderRadius) * 1 + 'px',
          overflow: 'hidden',
          bgcolor: 'var(--dwp-product-soft)',
        }}
      >
        {signals.map(({ key, value, tone, filter: signalFilter }, index) => {
          const label = t(`dwaionActivity.metrics.${key}`);
          const detail = t(`dwaionActivity.metrics.${key}Detail`);
          const valueColor =
            tone === 'neutral'
              ? theme.palette.text.primary
              : theme.palette[tone][theme.palette.mode === 'dark' ? 'light' : 'dark'];
          return (
            <ActionButton
              key={key}
              intent="quiet"
              aria-label={`${label}: ${value} · ${t(`dwaionActivity.mobileMetrics.${key}`)} · ${detail}`}
              aria-pressed={filter === signalFilter}
              onClick={() => onFilter(signalFilter)}
              sx={{
                minWidth: 0,
                minHeight: { xs: 58, sm: 62 },
                px: { xs: 0.35, sm: 1 },
                py: 0.75,
                border: 0,
                borderRadius: 0,
                borderInlineEnd: index < signals.length - 1 ? 1 : 0,
                borderColor: 'divider',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 0.2,
                color: 'text.primary',
                bgcolor: filter === signalFilter ? 'background.paper' : 'transparent',
                boxShadow: (theme) =>
                  filter === signalFilter ? `inset 0 -3px 0 ${theme.palette.primary.main}` : 'none',
                '&:hover': { bgcolor: 'background.paper' },
              }}
            >
              <Typography
                component="span"
                variant="caption"
                color="text.secondary"
                sx={{
                  maxWidth: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <Box component="span" sx={{ display: { xs: 'inline', md: 'none' } }}>
                  {t(`dwaionActivity.mobileMetrics.${key}`)}
                </Box>
                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                  {label}
                </Box>
              </Typography>
              <Typography
                component="span"
                variant="h6"
                fontWeight="fontWeightBold"
                sx={{
                  fontVariantNumeric: 'tabular-nums',
                  color: valueColor,
                  lineHeight: 'button.lineHeight',
                }}
              >
                {value}
              </Typography>
              <Box
                component="span"
                sx={{
                  position: 'absolute',
                  width: '1px',
                  height: '1px',
                  overflow: 'hidden',
                  clip: 'rect(0 0 0 0)',
                }}
              >
                {detail}
              </Box>
            </ActionButton>
          );
        })}
      </Box>

      <Typography
        variant="caption"
        color="text.secondary"
        component="p"
        sx={{ mt: 0.55, display: { xs: 'none', lg: 'block' }, lineHeight: 'button.lineHeight' }}
      >
        {t('dwaionActivity.windowNotice', { count: DWAION_ACTIVITY_PAGE_LIMIT })}
      </Typography>
      {metrics.sample > 0 && (
        <Stack
          direction="row"
          gap={0.75}
          alignItems="center"
          flexWrap="wrap"
          role="status"
          data-testid="dwaion-sample-summary"
          sx={{ mt: 0.75 }}
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
