import { useTranslation } from 'react-i18next';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type { HomeContributionBucketState, NormalizedHomeContribution } from '../contributions';

type ContextualVisualProps = Readonly<{
  sectionKey: 'response' | 'request';
  items: readonly NormalizedHomeContribution[];
  state?: HomeContributionBucketState;
}>;

export type ResponsePriorityKey = 'critical' | 'high' | 'standard';

export type ResponsePrioritySummary = Readonly<{
  total: number;
  counts: Readonly<Record<ResponsePriorityKey, number>>;
}>;

export function summarizeResponsePriorities(
  items: readonly NormalizedHomeContribution[]
): ResponsePrioritySummary {
  const counts: Record<ResponsePriorityKey, number> = { critical: 0, high: 0, standard: 0 };
  for (const item of items) {
    const count = Math.max(1, item.count);
    const priority: ResponsePriorityKey =
      item.priority === 'CRITICAL' ? 'critical' : item.priority === 'HIGH' ? 'high' : 'standard';
    counts[priority] += count;
  }
  return {
    total: counts.critical + counts.high + counts.standard,
    counts,
  };
}

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

function ResponsePrioritySummary({
  items,
  state,
}: {
  items: readonly NormalizedHomeContribution[];
  state?: HomeContributionBucketState;
}) {
  const { t } = useTranslation('home');
  const summary = summarizeResponsePriorities(items);
  const segments = [
    {
      key: 'critical' as const,
      count: summary.counts.critical,
      label: t('flow.purpose.response.priority.critical'),
      color: 'error.main',
    },
    {
      key: 'high' as const,
      count: summary.counts.high,
      label: t('flow.purpose.response.priority.high'),
      color: 'warning.main',
    },
    {
      key: 'standard' as const,
      count: summary.counts.standard,
      label: t('flow.purpose.response.priority.standard'),
      color: 'info.main',
    },
  ].filter((segment) => segment.count > 0);
  const segmentSummary = segments
    .map((segment) =>
      t('flow.purpose.response.priorityCount', {
        label: segment.label,
        count: segment.count,
      })
    )
    .join(', ');
  const partial = state === 'PARTIAL' || items.some((item) => item.freshness.state === 'STALE');
  const totalLabel = t(
    partial ? 'flow.purpose.response.availableTotal' : 'flow.purpose.response.waitingTotal',
    { count: summary.total }
  );
  const singlePriority = segments.length === 1;

  return (
    <Box
      data-home-response-distribution
      data-home-response-priority-summary
      data-home-response-total={summary.total}
      role="group"
      aria-label={t('flow.purpose.response.prioritySummary', {
        segments: segmentSummary,
        total: totalLabel,
      })}
    >
      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={700}
          sx={{ fontSize: 10.5 }}
        >
          {t('flow.purpose.response.priorityLabel')}
        </Typography>
        <Typography
          data-home-response-total-label
          variant="caption"
          color={partial ? 'warning.main' : 'text.secondary'}
          fontWeight={700}
          sx={{ ml: 'auto', fontSize: 10.5 }}
        >
          {totalLabel}
        </Typography>
      </Stack>

      {!singlePriority && (
        <Box
          data-home-response-priority-track
          aria-hidden="true"
          sx={{
            display: 'flex',
            width: 1,
            height: 7,
            mt: 0.55,
            overflow: 'hidden',
            borderRadius: 99,
            bgcolor: 'action.hover',
            border: 1,
            borderColor: 'divider',
            '@media (forced-colors: active)': { borderColor: 'CanvasText' },
          }}
        >
          {segments.map((segment) => (
            <Box
              key={segment.key}
              sx={{
                width: `${(segment.count / summary.total) * 100}%`,
                minWidth: 4,
                bgcolor: segment.color,
                opacity: 0.72,
                '@media (forced-colors: active)': {
                  opacity: 1,
                  bgcolor: 'CanvasText',
                  borderInlineEnd: '1px solid Canvas',
                },
              }}
            />
          ))}
        </Box>
      )}

      <Stack
        direction="row"
        alignItems="center"
        gap={1.25}
        flexWrap="wrap"
        sx={{ mt: singlePriority ? 0.5 : 0.6 }}
      >
        {segments.map((segment) => (
          <Stack
            key={segment.key}
            data-home-response-priority={segment.key}
            direction="row"
            alignItems="center"
            gap={0.45}
            sx={
              singlePriority
                ? {
                    minHeight: 24,
                    px: 0.75,
                    borderRadius: 99,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    '@media (forced-colors: active)': { borderColor: 'CanvasText' },
                  }
                : undefined
            }
          >
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
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={650}
              sx={{ fontSize: 10.5 }}
            >
              {t('flow.purpose.response.priorityCount', {
                label: segment.label,
                count: segment.count,
              })}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export function HomePurposeContextualVisual({ sectionKey, items, state }: ContextualVisualProps) {
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
        <ResponsePrioritySummary items={items} state={state} />
      )}
    </Box>
  );
}
