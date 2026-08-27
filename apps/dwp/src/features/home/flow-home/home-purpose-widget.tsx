import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
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
import type { FlowSignal } from './flow-home-model';

import { RolePulseInsight } from './home-purpose-role-pulse-insight';
import { HomePurposeContextualVisual } from './home-purpose-contextual-visual';

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
  supportStack?: boolean;
  timeline?: boolean;
  roleSignals?: readonly FlowSignal[];
  headerAccessory?: ReactNode;
  onRetry?: () => void;
}>;

export type HomePurposeContentDensity = 'short' | 'standard' | 'tall';

export type HomePurposeContentPolicy = Readonly<{
  density: HomePurposeContentDensity;
  showSectionDescription: boolean;
  showItemDescription: boolean;
  showOwner: boolean;
  showScope: boolean;
}>;

export function homePurposeContentPolicy(
  footprintHeight?: HomeWidgetHeight,
  supportStack = false
): HomePurposeContentPolicy {
  const density: HomePurposeContentDensity =
    footprintHeight === 'short'
      ? 'short'
      : footprintHeight === 'tall' || footprintHeight === 'expanded'
        ? 'tall'
        : 'standard';
  return {
    density,
    showSectionDescription: density !== 'short' && !supportStack,
    showItemDescription: density === 'tall' && !supportStack,
    showOwner: density !== 'short',
    showScope: density === 'tall' && !supportStack,
  };
}

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
  policy,
}: {
  item: NormalizedHomeContribution;
  timeline: boolean;
  policy: HomePurposeContentPolicy;
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
    <Stack
      direction="row"
      alignItems="center"
      gap={policy.density === 'short' ? 0.5 : 0.75}
      flexWrap={policy.density === 'tall' ? 'wrap' : 'nowrap'}
      color="text.secondary"
      sx={{
        minWidth: 0,
        overflow: 'hidden',
        "[data-workspace-widget-content-state='editing-preview'] &": {
          flexWrap: 'nowrap',
        },
        '& .MuiTypography-root': {
          fontSize: policy.density === 'short' ? 11.5 : 12,
          lineHeight: policy.density === 'tall' ? 1.3 : 1.25,
          whiteSpace: 'nowrap',
        },
      }}
    >
      {policy.showOwner && ownerLabel && (
        <Typography variant="caption" fontWeight={650}>
          {ownerLabel}
        </Typography>
      )}
      <Typography variant="caption" color={toneColor(item)} fontWeight={750}>
        {statusLabel}
      </Typography>
      {policy.showScope && (
        <Typography variant="caption">
          {t(`flow.purpose.scope.${item.scope.toLowerCase()}`)}
        </Typography>
      )}
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
  featuredCue,
  timeline,
  policy,
}: {
  item: NormalizedHomeContribution;
  index: number;
  featured: boolean;
  featuredCue: boolean;
  timeline: boolean;
  policy: HomePurposeContentPolicy;
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
          mt: featuredCue ? 0 : featured ? 0 : 0.55,
          width: featuredCue ? 3 : 8,
          height: featuredCue ? 32 : 8,
          flex: featuredCue ? '0 0 3px' : '0 0 8px',
          borderRadius: 999,
          bgcolor: toneColor(item),
          boxShadow: featuredCue
            ? 'none'
            : `0 0 0 3px ${alpha(theme.palette.background.paper, 0.92)}`,
        })}
      />
      {featuredCue && (
        <Box
          component="span"
          data-home-purpose-rank={index + 1}
          aria-hidden="true"
          sx={{
            width: 24,
            height: 24,
            flex: '0 0 24px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: '8px',
            color: 'text.secondary',
            bgcolor: 'action.hover',
            fontSize: 10.5,
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.02em',
          }}
        >
          {String(index + 1).padStart(2, '0')}
        </Box>
      )}
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Stack direction="row" alignItems="start" justifyContent="space-between" gap={1}>
          <Stack
            direction="row"
            alignItems="baseline"
            gap={0.65}
            sx={{ minWidth: 0, overflow: 'hidden' }}
          >
            <Typography
              component="h3"
              variant="subtitle2"
              fontWeight={featured ? 750 : 700}
              title={item.title}
              sx={{
                minWidth: 0,
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: { xs: featured ? 2 : 1, sm: 1 },
                overflow: 'hidden',
                fontSize:
                  policy.density === 'short' ? 12.5 : policy.density === 'standard' ? 13 : 14,
                lineHeight: policy.density === 'short' ? 1.3 : 1.35,
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
                '@media (max-width: 599.95px)': featured
                  ? {
                      minHeight: '2.6em',
                    }
                  : undefined,
              }}
            >
              {item.title}
            </Typography>
          </Stack>
          {item.count > 1 && (
            <Chip
              size="small"
              label={t('flow.purpose.count', { count: item.count })}
              sx={{ height: 22, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
            />
          )}
        </Stack>
        {policy.showItemDescription && item.description && (
          <Typography
            data-home-contribution-description
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.25,
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontSize: 12.5,
              lineHeight: 1.35,
            }}
          >
            {item.description}
          </Typography>
        )}
        <Box sx={{ mt: 0.25 }}>
          <ContributionMeta item={item} timeline={timeline} policy={policy} />
        </Box>
      </Box>
      {interactive && (
        <ArrowRight
          size={16}
          aria-hidden="true"
          style={{ flex: '0 0 auto', marginTop: featured ? 0 : 4 }}
        />
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
        // The assistant is intentionally a fixed bottom-right affordance on
        // compact screens. Keep only the actionable row out of that hit-test
        // lane; the widget plane and its supporting copy remain full width.
        maxWidth: 'none',
        minHeight: featuredCue
          ? 52
          : policy.density === 'short'
            ? 44
            : policy.density === 'standard'
              ? 44
              : featured
                ? 58
                : 54,
        px: featuredCue ? 0.75 : featured ? (policy.density === 'short' ? 0.5 : 1) : 0.25,
        py: policy.density === 'tall' ? 0.25 : 0,
        display: 'flex',
        // A single contribution can share a row with a denser neighbour.
        // Centre its information instead of leaving it stranded at the top of
        // an intentionally equal-height surface.
        alignItems: featured || featuredCue ? 'center' : 'flex-start',
        gap: 1,
        color: 'text.primary',
        textDecoration: 'none',
        bgcolor:
          featured && !featuredCue
            ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.045)
            : 'transparent',
        borderRadius: featured && !featuredCue ? 'var(--home-radius-item)' : 0,
        borderBlockStart: index > 0 ? 1 : 0,
        borderColor: 'divider',
        "[data-workspace-widget-content-state='editing-preview'] &": {
          minHeight:
            policy.density === 'short'
              ? 32
              : policy.density === 'standard'
                ? 40
                : featured
                  ? 56
                  : 52,
          py: 0,
        },
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

function RoleExceptionSummary({ item }: { item: NormalizedHomeContribution }) {
  const { t } = useTranslation('home');
  const interactive = Boolean(item.route);
  const statusKey = item.status.toLocaleLowerCase('en-US').replace(/[^a-z0-9]+/gu, '_');
  const statusLabel = t(`flow.purpose.status.${statusKey}`, {
    defaultValue: item.status.replaceAll('_', ' ').toLocaleLowerCase(),
  });

  return (
    <Box
      component={interactive ? Link : 'div'}
      to={interactive ? item.route : undefined}
      data-home-role-exception-summary
      {...homeContributionDomAttributes()}
      sx={{
        minWidth: 0,
        minHeight: 44,
        px: 0.5,
        display: 'flex',
        alignItems: 'center',
        gap: 0.65,
        color: 'text.primary',
        textDecoration: 'none',
        borderBlockStart: 1,
        borderColor: 'divider',
        "[data-workspace-widget-content-state='editing-preview'] &": {
          minHeight: 24,
        },
        '&:hover': interactive ? { bgcolor: 'action.hover' } : undefined,
        '&:focus-visible': interactive
          ? { outline: '3px solid var(--dwp-focus-ring, currentColor)', outlineOffset: 1 }
          : undefined,
        '@media (forced-colors: active)': {
          color: 'CanvasText',
          borderColor: 'CanvasText',
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 6,
          height: 6,
          flex: '0 0 6px',
          borderRadius: '50%',
          bgcolor: toneColor(item),
        }}
      />
      <Typography
        variant="caption"
        fontWeight={700}
        title={item.title}
        noWrap
        sx={{ minWidth: 0, flex: 1, fontSize: 11.5 }}
      >
        {item.title}
      </Typography>
      <Typography
        data-home-role-exception-status
        variant="caption"
        color={toneColor(item)}
        fontWeight={750}
        noWrap
        sx={{ fontSize: 10.5 }}
      >
        {statusLabel}
      </Typography>
      {item.count > 1 && (
        <Chip
          size="small"
          label={t('flow.purpose.count', { count: item.count })}
          sx={{ height: 20, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
        />
      )}
      {interactive && <ArrowRight size={14} aria-hidden="true" style={{ flex: '0 0 auto' }} />}
    </Box>
  );
}

function PurposeLoading({ rows, density }: { rows: number; density: HomePurposeContentDensity }) {
  return (
    <Stack gap={density === 'short' ? 0.25 : 0.75} aria-hidden="true" sx={{ pt: 0.25 }}>
      {Array.from({ length: rows }, (_, index) => (
        <Box key={index} sx={{ py: density === 'short' ? 0 : 0.25 }}>
          <Skeleton
            variant="text"
            width={index === 0 ? '62%' : '48%'}
            height={density === 'short' ? 18 : 20}
          />
          <Skeleton
            variant="text"
            width={index === 0 ? '88%' : '70%'}
            height={density === 'short' ? 14 : 16}
          />
        </Box>
      ))}
    </Stack>
  );
}

function RequestEmptyJourney() {
  const { t } = useTranslation('home');
  const stages = ['submitted', 'review', 'complete'] as const;
  return (
    <Stack
      data-home-request-empty-journey
      gap={0.55}
      sx={{
        mt: 1,
        display: { xs: 'none', sm: 'flex' },
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>
        {t('flow.purpose.request.emptyJourneyLabel')}
      </Typography>
      <Box
        component="ol"
        aria-label={t('flow.purpose.request.emptyJourneyLabel')}
        sx={{
          p: 0,
          m: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          listStyle: 'none',
        }}
      >
        {stages.map((stage, index) => (
          <Box
            component="li"
            key={stage}
            sx={{
              position: 'relative',
              minWidth: 0,
              display: 'grid',
              justifyItems: 'center',
              gap: 0.4,
              '&::after':
                index < stages.length - 1
                  ? {
                      content: '""',
                      position: 'absolute',
                      top: 5,
                      insetInlineStart: 'calc(50% + 7px)',
                      width: 'calc(100% - 14px)',
                      borderBlockStart: 1,
                      borderColor: 'divider',
                    }
                  : undefined,
            }}
          >
            <Box
              aria-hidden="true"
              sx={{
                zIndex: 1,
                width: 11,
                height: 11,
                borderRadius: '50%',
                bgcolor: 'action.disabledBackground',
                border: 2,
                borderColor: 'background.paper',
              }}
            />
            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 10.5 }}>
              {t(`flow.purpose.request.emptyJourney.${stage}`)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Stack>
  );
}

export function homePurposeVisibleLimit(
  maxItems: number,
  _footprintHeight?: HomeWidgetHeight,
  _supportStack = false
): number {
  // Height changes information density, not which records exist. Four is the
  // bounded read-mode allowance used by the adaptive wide action/timeline
  // treatment; existing callers still request at most three.
  const requestedLimit = Number.isFinite(maxItems) ? Math.floor(maxItems) : 1;
  return Math.min(4, Math.max(1, requestedLimit));
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
  supportStack = false,
  timeline = false,
  roleSignals = [],
  headerAccessory,
  onRetry,
}: HomePurposeWidgetProps) {
  const { t } = useTranslation(['home', 'common']);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const contentPolicy = homePurposeContentPolicy(footprintHeight);
  const presentationPolicy = homePurposeContentPolicy(footprintHeight, supportStack);
  const resolvedState = state ?? (items.length > 0 ? 'AVAILABLE' : 'EMPTY');
  const degraded = resolvedState === 'PARTIAL' || resolvedState === 'UNAVAILABLE';
  const restricted = resolvedState === 'RESTRICTED';
  const visibleLimit = homePurposeVisibleLimit(maxItems, footprintHeight, supportStack);
  const resolvedVisibleLimit =
    sectionKey === 'pulse' && roleSignals.length > 0 ? Math.min(1, visibleLimit) : visibleLimit;
  const visible = items.slice(0, resolvedVisibleLimit);
  const overflow = Math.max(0, items.length - visible.length);
  const overflowItems = items.slice(visible.length);
  const wideFeaturedLayout = wideFeatured && featuredFirst && visible.length > 1;
  const showRoleInsight = sectionKey === 'pulse' && roleSignals.length > 0;
  const roleVisualOnly = showRoleInsight && items.length === 0;
  const compactRoleException =
    showRoleInsight && contentPolicy.density === 'short' && visible.length > 0;
  const sectionAnchorId = `flow-purpose-${sectionKey}`;
  return (
    <Box
      component="section"
      id={sectionAnchorId}
      aria-labelledby={`${sectionAnchorId}-heading`}
      data-flow-section={`purpose-${sectionKey}`}
      data-home-footprint-height={footprintHeight}
      data-home-content-density={presentationPolicy.density}
      data-home-support-stack={supportStack ? 'true' : undefined}
      data-home-role-visual-only={roleVisualOnly ? 'true' : undefined}
      data-home-role-compact-exception={compactRoleException ? 'true' : undefined}
      data-home-content-state={loading ? 'loading' : resolvedState.toLocaleLowerCase('en-US')}
      aria-busy={loading || undefined}
      sx={{
        minWidth: 0,
        scrollMarginTop: 88,
        px: 2,
        py: supportStack ? 0.5 : contentPolicy.density === 'short' ? 0.75 : compact ? 1.25 : 1,
        display: 'flex',
        flexDirection: 'column',
        "[data-workspace-widget-content-state='editing-preview'] & [data-home-purpose-contextual-visual]":
          {
            display: 'none',
          },
      }}
    >
      {loading && (
        <Box
          role="status"
          aria-live="polite"
          sx={{
            position: 'absolute',
            width: '1px',
            height: '1px',
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
      <Stack
        direction="row"
        alignItems={supportStack ? 'center' : 'flex-start'}
        justifyContent="space-between"
        gap={1.5}
        sx={{ minHeight: supportStack ? 44 : undefined }}
      >
        <Stack direction="row" alignItems="flex-start" gap={1} sx={{ minWidth: 0 }}>
          <Box sx={{ mt: 0.15, color: sectionKey === 'action' ? 'warning.main' : 'text.primary' }}>
            <Icon size={20} aria-hidden="true" />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              id={`${sectionAnchorId}-heading`}
              component="h2"
              variant="subtitle1"
              fontWeight={750}
            >
              {t(`flow.purpose.${sectionKey}.title`)}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                mt: 0.1,
                display: presentationPolicy.showSectionDescription ? '-webkit-box' : 'none',
                WebkitLineClamp: compact || footprintHeight === 'short' ? 1 : 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'keep-all',
                overflowWrap: 'break-word',
              }}
            >
              {t(`flow.purpose.${sectionKey}.description`)}
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" gap={0.5}>
          {headerAccessory}
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
              aria-label={
                overflow > 0
                  ? t('flow.purpose.viewAllWithCount', { count: overflow })
                  : t('flow.viewAll')
              }
              sx={{
                minHeight: 44,
                px: 1,
                whiteSpace: 'nowrap',
                borderColor: 'transparent',
                bgcolor: 'transparent',
              }}
            >
              <Box component="span" sx={{ '@media (max-width:599.95px)': { display: 'none' } }}>
                {overflow > 0
                  ? t('flow.purpose.viewAllWithCount', { count: overflow })
                  : t('flow.viewAll')}
              </Box>
              <Box
                component="span"
                aria-hidden="true"
                sx={{ display: 'none', '@media (max-width:599.95px)': { display: 'inline' } }}
              >
                {overflow > 0 ? `+${overflow}` : t('flow.viewAll')}
              </Box>
            </ActionButton>
          )}
          {!allRoute && overflow > 0 && (
            <ActionButton
              data-home-purpose-overflow-trigger
              intent="quiet"
              size="small"
              aria-label={t('flow.purpose.more', { count: overflow, ns: 'home' })}
              aria-haspopup="dialog"
              aria-expanded={overflowOpen || undefined}
              onClick={() => setOverflowOpen(true)}
              sx={{
                minWidth: 44,
                minHeight: 44,
                px: 1,
                whiteSpace: 'nowrap',
                borderColor: 'transparent',
                bgcolor: 'transparent',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <Box
                component="span"
                sx={{
                  display: supportStack ? 'none' : 'inline',
                  '@media (max-width:599.95px)': { display: 'none' },
                }}
              >
                {t('flow.purpose.more', { count: overflow, ns: 'home' })}
              </Box>
              <Box
                component="span"
                aria-hidden="true"
                sx={{
                  display: supportStack ? 'inline' : 'none',
                  '@media (max-width:599.95px)': { display: 'inline' },
                }}
              >
                <Stack component="span" direction="row" alignItems="center" gap={0.35}>
                  <MoreHorizontal size={14} aria-hidden="true" />+{overflow}
                </Stack>
              </Box>
            </ActionButton>
          )}
        </Stack>
      </Stack>

      {showRoleInsight && (
        <Box
          data-home-role-insight-lane
          sx={{
            mt: supportStack ? 0 : 0.5,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <RolePulseInsight signals={roleSignals} density={contentPolicy.density} />
        </Box>
      )}

      {compactRoleException && visible[0] && (
        <Box
          role="list"
          aria-label={t(`flow.purpose.${sectionKey}.listLabel`)}
          data-home-purpose-list="role-exception-summary"
          sx={{ mt: 0.25, minWidth: 0 }}
        >
          <Box role="listitem">
            <RoleExceptionSummary item={visible[0]} />
          </Box>
        </Box>
      )}

      {(sectionKey === 'request' || sectionKey === 'response') &&
        contentPolicy.density !== 'short' && (
          <HomePurposeContextualVisual sectionKey={sectionKey} items={items} />
        )}

      {!roleVisualOnly && !compactRoleException && (
        <Box
          sx={{
            mt: supportStack ? 0 : contentPolicy.density === 'short' ? 0.35 : compact ? 0.65 : 0.75,
            flex: '1 1 auto',
            display: 'flex',
          }}
        >
          {loading && items.length === 0 ? (
            <PurposeLoading rows={visibleLimit} density={presentationPolicy.density} />
          ) : visible.length > 0 ? (
            <Box
              role="list"
              aria-label={t(`flow.purpose.${sectionKey}.listLabel`)}
              data-home-purpose-list={wideFeaturedLayout ? 'featured-queue' : 'stack'}
              data-home-purpose-timeline={timeline ? 'true' : undefined}
              sx={{
                width: 1,
                height: 1,
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                '&::before': timeline
                  ? {
                      content: '""',
                      position: 'absolute',
                      zIndex: 0,
                      insetBlock: 22,
                      insetInlineStart: 50,
                      width: 2,
                      borderRadius: 99,
                      bgcolor: 'divider',
                    }
                  : undefined,
                '& > [role="listitem"]': {
                  // Match the outer flex row to the rendered contribution's
                  // density floor. A smaller outer row lets tall content paint
                  // over the following record even when the section itself is
                  // content-adaptive.
                  minHeight: featuredFirst ? 52 : contentPolicy.density === 'tall' ? 58 : 44,
                  flex: '1 1 0',
                  position: 'relative',
                  zIndex: 1,
                },
                "[data-workspace-widget-content-state='editing-preview'] & > [role='listitem']": {
                  // Edit mode is an inert preview, so the 44px interactive hit
                  // target is not required. Preserve all three records inside
                  // the semantic short footprint instead of clipping the last.
                  minHeight:
                    contentPolicy.density === 'short'
                      ? 36
                      : contentPolicy.density === 'tall'
                        ? 56
                        : 44,
                },
                '& > [role="listitem"] > [data-home-contribution]': {
                  height: 1,
                  justifyContent: 'center',
                },
              }}
            >
              {visible.map((item, index) => (
                <Box role="listitem" key={`${item.providerKey}:${item.id}`}>
                  <ContributionRow
                    item={item}
                    index={index}
                    featured={visible.length === 1 && !featuredFirst}
                    featuredCue={featuredFirst}
                    timeline={timeline}
                    policy={presentationPolicy}
                  />
                </Box>
              ))}
            </Box>
          ) : (
            <Box
              data-home-purpose-status
              sx={(theme) => ({
                minHeight: supportStack ? 44 : 88,
                width: 1,
                p: supportStack ? 0.75 : 1.25,
                flex: '1 1 auto',
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
                <CheckCircle2
                  size={22}
                  color="var(--mui-palette-success-main)"
                  aria-hidden="true"
                />
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
                {sectionKey === 'request' && !degraded && !restricted && <RequestEmptyJourney />}
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
      )}
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
              <ContributionRow
                item={item}
                index={index}
                featured={false}
                featuredCue={false}
                timeline={timeline}
                policy={homePurposeContentPolicy('tall')}
              />
            </Box>
          ))}
        </Box>
      </ContentDialog>
    </Box>
  );
}
