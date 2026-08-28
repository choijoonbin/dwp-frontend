import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { NormalizedHomeContribution } from '../contributions';

type ContextualVisualProps = Readonly<{
  sectionKey: 'response' | 'request';
  items: readonly NormalizedHomeContribution[];
}>;

function requestStage(status: string): 0 | 1 | 2 {
  const normalized = status.toLocaleLowerCase('en-US');
  if (/approved|completed|resolved|closed/u.test(normalized)) return 2;
  if (/submitted|draft|new/u.test(normalized)) return 0;
  return 1;
}

function RequestJourney({ item }: { item: NormalizedHomeContribution }) {
  const { t } = useTranslation('home');
  const activeStage = requestStage(item.status);
  const stages = ['submitted', 'review', 'complete'] as const;
  return (
    <Box
      component="ol"
      data-home-request-journey
      aria-label={t('flow.purpose.request.emptyJourneyLabel')}
      sx={{
        p: 0,
        m: 0,
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        listStyle: 'none',
      }}
    >
      {stages.map((stage, index) => {
        const reached = index <= activeStage;
        return (
          <Box
            component="li"
            key={stage}
            aria-current={index === activeStage ? 'step' : undefined}
            sx={{
              position: 'relative',
              minWidth: 0,
              display: 'grid',
              justifyItems: 'center',
              gap: 0.35,
              '&::after':
                index < stages.length - 1
                  ? {
                      content: '""',
                      position: 'absolute',
                      top: 6,
                      insetInlineStart: 'calc(50% + 8px)',
                      width: 'calc(100% - 16px)',
                      height: 2,
                      borderRadius: 99,
                      bgcolor: index < activeStage ? 'primary.main' : 'divider',
                    }
                  : undefined,
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                zIndex: 1,
                width: 14,
                height: 14,
                borderRadius: '50%',
                bgcolor: reached ? 'primary.main' : 'background.paper',
                border: 2,
                borderColor: reached ? 'primary.main' : 'divider',
                boxShadow: index === activeStage ? '0 0 0 4px rgba(37,99,235,0.12)' : 'none',
              }}
            />
            <Typography
              variant="caption"
              color={reached ? 'text.primary' : 'text.secondary'}
              fontWeight={index === activeStage ? 750 : 600}
              noWrap
              sx={{ maxWidth: 1, fontSize: 10.5 }}
            >
              {t(`flow.purpose.request.emptyJourney.${stage}`)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function ResponseDistribution({ items }: { items: readonly NormalizedHomeContribution[] }) {
  const { t } = useTranslation('home');
  const counts = items.reduce(
    (result, item) => {
      const count = Math.max(1, item.count);
      if (item.priority === 'CRITICAL' || item.priority === 'HIGH') result.urgent += count;
      else if (item.priority === 'MEDIUM') result.actionable += count;
      else result.pending += count;
      return result;
    },
    { urgent: 0, actionable: 0, pending: 0 }
  );
  const total = Math.max(1, counts.urgent + counts.actionable + counts.pending);
  const segments = [
    {
      key: 'urgent',
      count: counts.urgent,
      label: t('flow.purpose.status.urgent'),
      color: 'error.main',
    },
    {
      key: 'actionable',
      count: counts.actionable,
      label: t('flow.purpose.status.actionable'),
      color: 'warning.main',
    },
    {
      key: 'pending',
      count: counts.pending,
      label: t('flow.purpose.status.pending'),
      color: 'info.main',
    },
  ].filter((segment) => segment.count > 0);
  const segmentSummary = segments.map((segment) => `${segment.label} ${segment.count}`).join(', ');
  const totalLabel = t('flow.purpose.response.distributionTotal', { count: total });

  return (
    <Box
      data-home-response-distribution
      data-home-response-total={total}
      role="img"
      aria-label={t('flow.purpose.response.distributionLabel', {
        segments: segmentSummary,
        count: total,
      })}
    >
      <Box
        aria-hidden="true"
        sx={{
          display: 'flex',
          width: 1,
          height: 5,
          overflow: 'hidden',
          borderRadius: 99,
          bgcolor: 'action.hover',
        }}
      >
        {segments.map((segment) => (
          <Box
            key={segment.key}
            sx={{
              width: `${(segment.count / total) * 100}%`,
              minWidth: 4,
              bgcolor: segment.color,
              opacity: 0.68,
              '@media (forced-colors: active)': { opacity: 1 },
            }}
          />
        ))}
      </Box>
      <Stack direction="row" alignItems="center" gap={1.25} flexWrap="wrap" sx={{ mt: 0.65 }}>
        {segments.map((segment) => (
          <Stack key={segment.key} direction="row" alignItems="center" gap={0.45}>
            <Box
              aria-hidden="true"
              sx={(theme) => ({
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: segment.color,
                boxShadow: `0 0 0 3px ${alpha(theme.palette.background.paper, 0.9)}`,
              })}
            />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>
              {segment.label} {segment.count}
            </Typography>
          </Stack>
        ))}
        <Typography
          data-home-response-total-label
          variant="caption"
          color="text.secondary"
          fontWeight={700}
          sx={{ ml: 'auto', fontSize: 10.5 }}
        >
          {totalLabel}
        </Typography>
      </Stack>
    </Box>
  );
}

export function HomePurposeContextualVisual({ sectionKey, items }: ContextualVisualProps) {
  if (items.length === 0) return null;
  return (
    <Box
      data-home-purpose-contextual-visual={sectionKey}
      sx={{
        mt: 0.75,
        px: 0.75,
        py: 0.65,
        borderRadius: 'var(--home-radius-item)',
        bgcolor: 'var(--home-surface-subtle)',
        border: 1,
        borderColor: 'divider',
        '@media (forced-colors: active)': { bgcolor: 'Canvas', borderColor: 'CanvasText' },
      }}
    >
      {sectionKey === 'request' ? (
        <RequestJourney item={items[0]!} />
      ) : (
        <ResponseDistribution items={items} />
      )}
    </Box>
  );
}
