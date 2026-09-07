import { useTranslation } from 'react-i18next';
import { CalendarRange, Inbox } from 'lucide-react';
import { formatNumber } from '@dwp-frontend/shared-i18n';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { alpha, lighten } from '@mui/material/styles';

import { HOME_STATUS_TOKENS, HOME_WORKSCAPE_TOKENS } from '../../../components/home-surface-tokens';

const statusSurface = lighten(foundationTokens.color.data.violet, 0.4);
const foreground = HOME_WORKSCAPE_TOKENS.light.on;

export type FlowHomeContextMetrics = Readonly<{
  action: number;
  timeline: number;
  response: number;
}>;

export function FlowHomeStatusChip({ metrics }: { metrics: FlowHomeContextMetrics }) {
  const { t } = useTranslation('home');
  const items = [
    { key: 'action', value: metrics.action, icon: null, href: '#flow-purpose-action' },
    {
      key: 'timeline',
      value: metrics.timeline,
      icon: CalendarRange,
      href: '#flow-purpose-timeline',
    },
    { key: 'response', value: metrics.response, icon: Inbox, href: '#flow-purpose-response' },
  ] as const;

  return (
    <Box
      component="ul"
      data-flow-context-metrics
      data-flow-context-metrics-appearance="compact-chip"
      aria-label={t('flow.context.metrics.label')}
      sx={{
        p: '3px',
        m: 0,
        listStyle: 'none',
        minWidth: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: '2px',
        width: 1,
        border: 0,
        borderRadius: 'var(--home-radius-item)',
        bgcolor: alpha(statusSurface, 0.16),
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        '@media (prefers-reduced-transparency: reduce)': {
          bgcolor: foundationTokens.color.data.violet,
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
        },
        '@media (forced-colors: active)': {
          bgcolor: 'Canvas',
          outline: '1px solid CanvasText',
        },
      }}
    >
      {items.map(({ key, value, icon: Icon, href }) => {
        const action = key === 'action';
        const needsAction = action && value > 0;
        return (
          <Box
            component="li"
            key={key}
            data-flow-context-metric={key}
            data-flow-context-metric-emphasis={needsAction ? 'true' : undefined}
            sx={{ minWidth: 0 }}
          >
            <ButtonBase
              component="a"
              href={href}
              aria-label={`${t(`flow.context.metrics.${key}`)} ${t('flow.purpose.count', { count: value })}`}
              sx={{
                width: 1,
                minWidth: 44,
                minHeight: 44,
                height: 1,
                px: 0.75,
                py: 0.5,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 0.65,
                border: 0,
                borderRadius: 'var(--home-radius-item)',
                color: foreground,
                bgcolor: action ? alpha(foreground, 0.14) : 'transparent',
                '&:hover': { bgcolor: alpha(foreground, 0.22) },
                '&:focus-visible': {
                  outline: '2px solid',
                  outlineColor: foreground,
                  outlineOffset: -2,
                },
                '@media (max-width:359.95px)': { px: 0.4, gap: 0.45 },
                '@media (forced-colors: active)': {
                  bgcolor: 'Canvas',
                  color: 'CanvasText',
                  '&:focus-visible': { outlineColor: 'Highlight' },
                },
              }}
            >
              {Icon ? (
                <Box
                  component="span"
                  data-flow-context-metric-icon
                  sx={{
                    display: 'inline-flex',
                    flexShrink: 0,
                    color: HOME_WORKSCAPE_TOKENS.light.onMuted,
                    '@media (forced-colors: active)': { color: 'CanvasText' },
                  }}
                >
                  <Icon size={13} strokeWidth={1.8} aria-hidden="true" />
                </Box>
              ) : (
                <Box
                  data-flow-context-action-dot
                  aria-hidden="true"
                  sx={{
                    width: 5,
                    height: 5,
                    flexShrink: 0,
                    borderRadius: '50%',
                    bgcolor: needsAction
                      ? HOME_STATUS_TOKENS.dark.error
                      : HOME_WORKSCAPE_TOKENS.light.onMuted,
                    '@media (forced-colors: active)': { bgcolor: 'CanvasText' },
                  }}
                />
              )}
              <Typography
                component="span"
                variant="caption"
                sx={{
                  minWidth: 0,
                  fontWeight: action ? 'fontWeightBold' : 'fontWeightMedium',
                  lineHeight: 'caption.lineHeight',
                  overflowWrap: 'anywhere',
                  textAlign: 'center',
                }}
              >
                <Box component="span" sx={{ '@media (max-width:479.95px)': { display: 'none' } }}>
                  {t(`flow.context.metrics.${key}`)}
                </Box>
                <Box
                  component="span"
                  sx={{ display: 'none', '@media (max-width:479.95px)': { display: 'inline' } }}
                >
                  {t(`flow.context.metricsShort.${key}`)}
                </Box>
              </Typography>
              <Typography
                component="span"
                variant="caption"
                data-flow-context-metric-count={key}
                data-flow-context-count-treatment={needsAction ? 'action-badge' : 'inline'}
                sx={{
                  minWidth: needsAction ? 16 : 'auto',
                  minHeight: needsAction ? 16 : 'auto',
                  px: needsAction ? 0.45 : 0,
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: needsAction ? 'var(--home-radius-item)' : 0,
                  color: foreground,
                  bgcolor: needsAction ? HOME_STATUS_TOKENS.light.error : 'transparent',
                  fontWeight: 'fontWeightBold',
                  lineHeight: 'caption.lineHeight',
                  fontVariantNumeric: 'tabular-nums',
                  '@media (forced-colors: active)': {
                    color: needsAction ? 'HighlightText' : 'CanvasText',
                    bgcolor: needsAction ? 'Highlight' : 'Canvas',
                  },
                }}
              >
                {formatNumber(value)}
              </Typography>
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}
