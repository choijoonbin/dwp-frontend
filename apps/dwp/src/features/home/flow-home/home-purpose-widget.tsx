import { useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, RefreshCw, ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionButton, ContentDialog } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import { resolveHomePriorityTone } from '../../../components/home-surface-tokens';

import type { LucideIcon } from 'lucide-react';
import type { HomeContributionBucketState, NormalizedHomeContribution } from '../contributions';
import type { HomeWidgetHeight } from '@dwp-frontend/shared-utils';

type HomePurposeWidgetProps = Readonly<{
  sectionKey: 'action' | 'timeline' | 'response' | 'request' | 'pulse';
  icon: LucideIcon;
  items: readonly NormalizedHomeContribution[];
  loading: boolean;
  fetching?: boolean;
  state?: HomeContributionBucketState;
  maxItems?: number;
  allRoute?: string;
  compact?: boolean;
  footprintHeight?: HomeWidgetHeight;
  featuredFirst?: boolean;
  wideFeatured?: boolean;
  timeline?: boolean;
  onRetry?: () => void;
}>;

export function homeContributionDomAttributes(): Readonly<Record<string, string>> {
  // Presence is useful for layout/E2E selectors, but business identifiers,
  // dedupe semantics, titles and source references must never enter DOM metadata.
  return { 'data-home-contribution': 'present' };
}

function prioritySignal(item: NormalizedHomeContribution) {
  const status = item.status.toLocaleLowerCase();
  if (item.priority === 'CRITICAL' || /overdue|blocked|failed|risk|urgent/u.test(status)) {
    return 'critical' as const;
  }
  if (item.priority === 'HIGH' || /attention|needs|check.in/u.test(status)) {
    return 'high' as const;
  }
  return item.priority === 'LOW' ? ('low' as const) : ('medium' as const);
}

function toneColor(item: NormalizedHomeContribution): string {
  const tone = resolveHomePriorityTone(prioritySignal(item));
  return tone === 'error' ? 'error.main' : tone === 'warning' ? 'warning.main' : 'text.secondary';
}

function ContributionMeta({
  item,
  timeline,
}: {
  item: NormalizedHomeContribution;
  timeline: boolean;
}) {
  const { t } = useTranslation('home');
  const ownerLabel = t(`flow.apps.${item.owner.appKey}`, {
    defaultValue: item.owner.appLabel ?? item.owner.appKey,
  });
  const statusKey = item.status.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, '_');
  const statusLabel = t(`flow.purpose.status.${statusKey}`, {
    defaultValue: item.status.replaceAll('_', ' ').toLocaleLowerCase(),
  });
  return (
    <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap" color="text.secondary">
      {ownerLabel && (
        <Typography variant="caption" fontWeight={650}>
          {ownerLabel}
        </Typography>
      )}
      <Typography variant="caption" color={toneColor(item)} fontWeight={750}>
        {statusLabel}
      </Typography>
      <Typography variant="caption">
        {t(`flow.purpose.scope.${item.scope.toLowerCase()}`)}
      </Typography>
      {item.dueAt && (
        <Stack direction="row" alignItems="center" gap={0.35}>
          <Clock3 size={12} aria-hidden="true" />
          <Typography variant="caption">
            {formatDate(item.dueAt, timeline ? { timeStyle: 'short' } : { dateStyle: 'short' })}
          </Typography>
        </Stack>
      )}
      {item.freshness.state === 'STALE' && (
        <Typography variant="caption" color="warning.main" fontWeight={700}>
          {t('flow.purpose.stale')}
        </Typography>
      )}
    </Stack>
  );
}

function ContributionRow({
  item,
  index,
  featured,
  timeline,
}: {
  item: NormalizedHomeContribution;
  index: number;
  featured: boolean;
  timeline: boolean;
}) {
  const { t } = useTranslation('home');
  const interactive = Boolean(item.route);
  const content = (
    <>
      {timeline && (
        <Box
          aria-hidden="true"
          sx={{
            width: 38,
            flex: '0 0 38px',
            pt: 0.15,
            textAlign: 'end',
            color: 'text.secondary',
            fontSize: 12,
            fontWeight: 750,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {item.dueAt ? formatDate(item.dueAt, { timeStyle: 'short' }) : t('flow.purpose.allDay')}
        </Box>
      )}
      <Box
        aria-hidden="true"
        sx={(theme) => ({
          mt: 0.55,
          width: 8,
          height: 8,
          flex: '0 0 8px',
          borderRadius: '50%',
          bgcolor: toneColor(item),
          boxShadow: `0 0 0 3px ${alpha(theme.palette.background.paper, 0.92)}`,
        })}
      />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" alignItems="start" justifyContent="space-between" gap={1}>
          <Typography
            component="h3"
            variant="subtitle2"
            fontWeight={featured ? 750 : 700}
            sx={{ minWidth: 0, wordBreak: 'keep-all', overflowWrap: 'break-word' }}
          >
            {item.title}
          </Typography>
          {item.count > 1 && (
            <Chip
              size="small"
              label={t('flow.purpose.count', { count: item.count })}
              sx={{ height: 22, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
            />
          )}
        </Stack>
        {item.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.25,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.description}
          </Typography>
        )}
        <Box sx={{ mt: 0.25 }}>
          <ContributionMeta item={item} timeline={timeline} />
        </Box>
      </Box>
      {interactive && (
        <ArrowRight size={16} aria-hidden="true" style={{ flex: '0 0 auto', marginTop: 4 }} />
      )}
    </>
  );

  return (
    <Box
      component={interactive ? Link : 'div'}
      to={interactive ? item.route : undefined}
      {...homeContributionDomAttributes()}
      sx={(theme) => ({
        minWidth: 0,
        minHeight: featured ? 64 : 52,
        px: featured ? 1 : 0.25,
        py: featured ? 0.75 : 0.65,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1,
        color: 'text.primary',
        textDecoration: 'none',
        bgcolor: featured
          ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.045)
          : 'transparent',
        borderRadius: featured ? 'var(--home-radius-item)' : 0,
        borderBlockStart: index > 0 && !featured ? 1 : 0,
        borderColor: 'divider',
        '&:hover': interactive ? { bgcolor: 'action.hover' } : undefined,
        '&:focus-visible': interactive
          ? { outline: '3px solid var(--dwp-focus-ring, currentColor)', outlineOffset: 2 }
          : undefined,
        '@media (forced-colors: active)': {
          bgcolor: 'Canvas',
          borderColor: 'CanvasText',
        },
      })}
    >
      {content}
    </Box>
  );
}

function PurposeLoading({ rows }: { rows: number }) {
  return (
    <Stack gap={1} aria-hidden="true" sx={{ pt: 0.5 }}>
      {Array.from({ length: rows }, (_, index) => (
        <Box key={index} sx={{ py: 0.75 }}>
          <Skeleton variant="text" width={index === 0 ? '62%' : '48%'} height={22} />
          <Skeleton variant="text" width={index === 0 ? '88%' : '70%'} height={18} />
        </Box>
      ))}
    </Stack>
  );
}

export function homePurposeVisibleLimit(
  maxItems: number,
  footprintHeight?: HomeWidgetHeight
): number {
  const footprintLimit = footprintHeight === 'short' ? 1 : footprintHeight === 'standard' ? 2 : 3;
  return Math.min(3, Math.max(1, maxItems), footprintHeight ? footprintLimit : 3);
}

export function HomePurposeWidget({
  sectionKey,
  icon: Icon,
  items,
  loading,
  fetching = false,
  state,
  maxItems = 3,
  allRoute,
  compact = false,
  footprintHeight,
  featuredFirst = false,
  wideFeatured = false,
  timeline = false,
  onRetry,
}: HomePurposeWidgetProps) {
  const { t } = useTranslation(['home', 'common']);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const resolvedState = state ?? (items.length > 0 ? 'AVAILABLE' : 'EMPTY');
  const degraded = resolvedState === 'PARTIAL' || resolvedState === 'UNAVAILABLE';
  const restricted = resolvedState === 'RESTRICTED';
  const visibleLimit = homePurposeVisibleLimit(maxItems, footprintHeight);
  const visible = items.slice(0, visibleLimit);
  const overflow = Math.max(0, items.length - visible.length);
  const overflowItems = items.slice(visible.length);
  const wideFeaturedLayout = wideFeatured && featuredFirst && visible.length > 1;
  return (
    <Box
      component="section"
      data-flow-section={`purpose-${sectionKey}`}
      data-home-footprint-height={footprintHeight}
      data-home-content-state={loading ? 'loading' : resolvedState.toLocaleLowerCase('en-US')}
      aria-busy={loading || undefined}
      sx={{
        minWidth: 0,
        px: 2,
        py: compact ? 1.35 : 1.5,
        display: 'flex',
        flexDirection: 'column',
        '@media (max-width: 599.95px)': {
          // Keep every row action clear of the fixed 48px DWAI launcher.
          pr: 7,
        },
      }}
    >
      {loading && (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: 'absolute',
            width: 1,
            height: 1,
            p: 0,
            m: -1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          {t('flow.purpose.loading')}
        </Box>
      )}
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5}>
        <Stack direction="row" alignItems="flex-start" gap={1} sx={{ minWidth: 0 }}>
          <Box sx={{ mt: 0.15, color: sectionKey === 'action' ? 'warning.main' : 'text.primary' }}>
            <Icon size={20} aria-hidden="true" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h2" variant="subtitle1" fontWeight={750}>
              {t(`flow.purpose.${sectionKey}.title`)}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.1,
                display: '-webkit-box',
                WebkitLineClamp: compact || footprintHeight === 'short' ? 1 : 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {t(`flow.purpose.${sectionKey}.description`)}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.5}>
          {degraded && visible.length === 0 && (
            <Chip
              size="small"
              icon={<ShieldAlert size={13} aria-hidden="true" />}
              label={t('flow.purpose.partial')}
              sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
            />
          )}
          {allRoute && (
            <ActionButton
              component={Link}
              to={allRoute}
              intent="quiet"
              size="small"
              endIcon={<ArrowRight size={15} aria-hidden="true" />}
              sx={{ minHeight: 44, whiteSpace: 'nowrap' }}
            >
              {t('flow.viewAll')}
              {overflow > 0 && (
                <Box
                  component="span"
                  aria-hidden="true"
                  sx={{
                    ml: 0.5,
                    color: 'text.secondary',
                    fontSize: 11,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  +{overflow}
                </Box>
              )}
            </ActionButton>
          )}
          {!allRoute && overflow > 0 && (
            <ActionButton
              intent="quiet"
              size="small"
              aria-label={t('flow.purpose.more', { count: overflow, ns: 'home' })}
              aria-haspopup="dialog"
              aria-expanded={overflowOpen || undefined}
              onClick={() => setOverflowOpen(true)}
              sx={{
                minWidth: 44,
                minHeight: 44,
                px: 1.25,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 999,
                bgcolor: 'action.hover',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              +{overflow}
            </ActionButton>
          )}
        </Stack>
      </Stack>

      <Box sx={{ mt: compact ? 0.65 : 0.75, flex: '1 1 auto', display: 'flex' }}>
        {loading && items.length === 0 ? (
          <PurposeLoading rows={visibleLimit} />
        ) : visible.length > 0 ? (
          <Box
            role="list"
            aria-label={t(`flow.purpose.${sectionKey}.listLabel`)}
            data-home-purpose-list={wideFeaturedLayout ? 'featured-queue' : 'stack'}
            sx={{
              width: 1,
              height: visible.length === 1 ? 1 : 'auto',
              ...(visible.length === 1
                ? {
                    '& > [role="listitem"]': { height: 1 },
                    '& > [role="listitem"] > [data-home-contribution]': {
                      height: 1,
                      alignItems: 'center',
                    },
                  }
                : {}),
              ...(wideFeaturedLayout
                ? {
                    '@media (min-width: 1600px)': {
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, 0.85fr)',
                      alignItems: 'stretch',
                      gap: 1.25,
                    },
                  }
                : {}),
            }}
          >
            {wideFeaturedLayout ? (
              <>
                <Box
                  role="listitem"
                  data-home-purpose-featured
                  sx={{
                    minWidth: 0,
                    '@media (min-width: 1600px)': {
                      '& > [data-home-contribution]': { height: '100%', alignItems: 'center' },
                    },
                  }}
                >
                  <ContributionRow item={visible[0]!} index={0} featured timeline={timeline} />
                </Box>
                <Box
                  role="presentation"
                  data-home-purpose-compact-queue
                  sx={{
                    minWidth: 0,
                    '@media (min-width: 1600px)': {
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                    },
                  }}
                >
                  {visible.slice(1).map((item, index) => (
                    <Box role="listitem" key={`${item.providerKey}:${item.id}`}>
                      <ContributionRow
                        item={item}
                        index={index}
                        featured={false}
                        timeline={timeline}
                      />
                    </Box>
                  ))}
                </Box>
              </>
            ) : (
              visible.map((item, index) => (
                <Box role="listitem" key={`${item.providerKey}:${item.id}`}>
                  <ContributionRow
                    item={item}
                    index={index}
                    featured={visible.length === 1 || (featuredFirst && index === 0)}
                    timeline={timeline}
                  />
                </Box>
              ))
            )}
          </Box>
        ) : (
          <Box
            data-home-purpose-status
            sx={(theme) => ({
              minHeight: 88,
              width: 1,
              p: 1.25,
              display: 'grid',
              gridTemplateColumns: {
                xs: 'auto minmax(0, 1fr)',
                sm: 'auto minmax(0, 1fr) auto',
              },
              alignItems: 'center',
              columnGap: 1.25,
              rowGap: 0.75,
              color: 'text.secondary',
              bgcolor: alpha(
                degraded || restricted ? theme.palette.warning.main : theme.palette.success.main,
                theme.palette.mode === 'dark' ? 0.1 : 0.045
              ),
              border: '1px solid',
              borderColor: alpha(
                degraded || restricted ? theme.palette.warning.main : theme.palette.success.main,
                0.18
              ),
              borderRadius: 'var(--home-radius-item)',
              '@media (forced-colors: active)': {
                bgcolor: 'Canvas',
                borderColor: 'CanvasText',
              },
            })}
          >
            {degraded || restricted ? (
              <ShieldAlert size={22} color="var(--mui-palette-warning-main)" aria-hidden="true" />
            ) : (
              <CheckCircle2 size={22} color="var(--mui-palette-success-main)" aria-hidden="true" />
            )}
            <Box>
              <Typography variant="subtitle2" color="text.primary" fontWeight={700}>
                {t(
                  restricted
                    ? 'flow.purpose.restrictedEmpty'
                    : degraded
                      ? 'flow.purpose.partialEmpty'
                      : `flow.purpose.${sectionKey}.empty`
                )}
              </Typography>
              <Typography variant="body2">
                {t(
                  restricted
                    ? 'flow.purpose.restrictedEmptyDescription'
                    : degraded
                      ? 'flow.purpose.partialEmptyDescription'
                      : `flow.purpose.${sectionKey}.emptyDescription`
                )}
              </Typography>
            </Box>
            {degraded && onRetry && (
              <ActionButton
                data-home-purpose-retry
                intent="quiet"
                size="small"
                startIcon={<RefreshCw size={14} aria-hidden="true" />}
                onClick={onRetry}
                loading={fetching}
                sx={{
                  minHeight: 44,
                  whiteSpace: 'nowrap',
                  justifySelf: 'end',
                  gridColumn: { xs: '2', sm: 'auto' },
                }}
              >
                {t('page.retry')}
              </ActionButton>
            )}
          </Box>
        )}
      </Box>
      <ContentDialog
        open={overflowOpen && overflowItems.length > 0}
        title={t('flow.purpose.more', { count: overflowItems.length, ns: 'home' })}
        description={t(`flow.purpose.${sectionKey}.description`, { ns: 'home' })}
        closeLabel={t('actions.close', { ns: 'common' })}
        onClose={() => setOverflowOpen(false)}
        maxWidth="sm"
        contentDividers
        contentSx={{ py: 1.5 }}
      >
        <Box
          role="list"
          aria-label={t(`flow.purpose.${sectionKey}.listLabel`, { ns: 'home' })}
          sx={{ display: 'grid' }}
        >
          {overflowItems.map((item, index) => (
            <Box role="listitem" key={`${item.providerKey}:${item.id}`}>
              <ContributionRow item={item} index={index} featured={false} timeline={timeline} />
            </Box>
          ))}
        </Box>
      </ContentDialog>
    </Box>
  );
}
