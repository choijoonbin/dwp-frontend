import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BellRing, BookOpen, CalendarDays, Newspaper } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ActionButton,
  ErrorState,
  GuidedEmptyState,
  LoadingState,
} from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

import type {
  CommunicationItem,
  HomeOverview,
  HomeWidgetHeight,
  HomeWidgetSize,
} from '@dwp-frontend/shared-utils';

type FlowUpdatesProps = {
  overview?: HomeOverview;
  loading: boolean;
  fetching: boolean;
  requestFailed: boolean;
  compact?: boolean;
  wide?: boolean;
  size?: HomeWidgetSize;
  height?: HomeWidgetHeight;
  itemLimit?: number;
  onRetry: () => void;
};

const categoryTone: Readonly<Record<string, string>> = {
  COMPANY: '#315FD5',
  INNOVATION: '#6C4AC7',
  CULTURE: '#B94658',
  SECURITY: '#0A7C84',
  LEADERSHIP: '#9B6111',
  GROWTH: '#18794E',
};

export function orderedFlowStories(overview?: HomeOverview): CommunicationItem[] {
  const feed =
    overview?.communications.status === 'AVAILABLE' ? overview.communications.data : undefined;
  const unique = new Map<number, CommunicationItem>();
  for (const story of [...(feed?.actionableItems ?? []), feed?.featured, ...(feed?.items ?? [])]) {
    // The first source is deliberate: actionable records carry the decision
    // state used on Home and must not be replaced by a generic feed duplicate.
    if (story && !unique.has(story.communicationId)) unique.set(story.communicationId, story);
  }
  return [...unique.values()]
    .filter((story) => !story.readerState.dismissed)
    .sort((left, right) => {
      const required = Number(isRequired(right)) - Number(isRequired(left));
      if (required) return required;
      const critical = Number(right.severity === 'CRITICAL') - Number(left.severity === 'CRITICAL');
      if (critical) return critical;
      const acknowledgementDeadline =
        Date.parse(left.acknowledgementDueAt ?? '9999-12-31T23:59:59Z') -
        Date.parse(right.acknowledgementDueAt ?? '9999-12-31T23:59:59Z');
      if (acknowledgementDeadline) return acknowledgementDeadline;
      const pinned = Number(right.pinned) - Number(left.pinned);
      if (pinned) return pinned;
      return Date.parse(right.publishedAt ?? '') - Date.parse(left.publishedAt ?? '');
    });
}

function isRequired(story: CommunicationItem): boolean {
  if (story.acknowledgementRequired) return !story.readerState.acknowledged;
  return story.severity === 'CRITICAL' && story.readerState.unread;
}

export function hasFlowRequiredNotice(overview?: HomeOverview): boolean {
  const summary =
    overview?.communications.status === 'AVAILABLE'
      ? overview.communications.data?.summary
      : undefined;
  const authoritativeCount = Math.max(summary?.actionable ?? 0, summary?.required ?? 0);
  return authoritativeCount > 0 || orderedFlowStories(overview).some(isRequired);
}

export function hasFlowGeneralUpdates(overview?: HomeOverview): boolean {
  return orderedFlowStories(overview).some((story) => !isRequired(story));
}

export function visibleFlowUnreadCount(
  stories: readonly CommunicationItem[],
  itemLimit: number
): number {
  return stories.slice(0, Math.max(0, itemLimit)).filter((story) => story.readerState.unread)
    .length;
}

export function flowUpdatesResponsiveItemLimit(
  containerWidth: number | undefined,
  height: HomeWidgetHeight,
  itemLimit: number
): number {
  const requestedLimit = Math.max(0, Math.floor(itemLimit));
  if (containerWidth === undefined || containerWidth >= 720) return requestedLimit;
  if (height === 'short') return Math.min(containerWidth < 420 ? 1 : 2, requestedLimit);
  return Math.min(containerWidth < 420 ? 2 : 3, requestedLimit);
}

export function flowUpdatesVisibleStories(
  stories: readonly CommunicationItem[],
  itemLimit: number
): {
  visible: CommunicationItem[];
  featured: CommunicationItem | undefined;
  secondary: CommunicationItem[];
  unreadCount: number;
  overflowCount: number;
} {
  const limit = Math.max(0, Math.floor(itemLimit));
  const visible = stories.slice(0, limit);
  const [featured, ...secondary] = visible;
  return {
    visible,
    featured,
    secondary,
    unreadCount: visible.filter((story) => story.readerState.unread).length,
    overflowCount: Math.max(0, stories.length - visible.length),
  };
}

function StoryMeta({ story }: { story: CommunicationItem }) {
  const { t } = useTranslation(['home', 'communications']);
  return (
    <Stack
      data-story-meta
      direction="row"
      alignItems="center"
      gap={1}
      flexWrap="wrap"
      color="text.secondary"
    >
      <Typography data-story-meta-publisher variant="caption" fontWeight={650}>
        {story.publisherName}
      </Typography>
      {story.publishedAt && (
        <Stack data-story-meta-date direction="row" alignItems="center" gap={0.4}>
          <CalendarDays size={13} aria-hidden="true" />
          <Typography variant="caption">
            {formatDate(story.publishedAt, { dateStyle: 'medium' })}
          </Typography>
        </Stack>
      )}
      <Stack data-story-meta-read direction="row" alignItems="center" gap={0.4}>
        <BookOpen size={13} aria-hidden="true" />
        <Typography variant="caption">
          {t('flow.updates.readTime', { count: story.readingMinutes, ns: 'home' })}
        </Typography>
      </Stack>
    </Stack>
  );
}

export function FlowRequiredNotice({
  overview,
  editing = false,
  unavailable = false,
  fetching = false,
  onRetry,
}: Pick<FlowUpdatesProps, 'overview' | 'onRetry'> & {
  editing?: boolean;
  unavailable?: boolean;
  fetching?: boolean;
}) {
  const { t } = useTranslation('home');
  const requiredStories = useMemo(
    () => orderedFlowStories(overview).filter(isRequired),
    [overview]
  );
  const [story] = requiredStories;
  const summary =
    overview?.communications.status === 'AVAILABLE'
      ? overview.communications.data?.summary
      : undefined;
  const summaryRequiredCount = summary?.required ?? 0;
  const summaryActionableCount = summary?.actionable;
  const summaryCriticalUnreadCount = summary?.criticalUnread ?? 0;
  const sampledAcknowledgementCount = requiredStories.filter(
    (candidate) => candidate.acknowledgementRequired && !candidate.readerState.acknowledged
  ).length;
  const sampledCriticalOnlyCount = requiredStories.filter(
    (candidate) =>
      candidate.severity === 'CRITICAL' &&
      candidate.readerState.unread &&
      !(candidate.acknowledgementRequired && !candidate.readerState.acknowledged)
  ).length;
  const sampledActionableCount = sampledAcknowledgementCount + sampledCriticalOnlyCount;
  const requiredCount =
    typeof summaryActionableCount === 'number'
      ? Math.max(summaryActionableCount, summaryRequiredCount, sampledActionableCount)
      : Math.max(summaryRequiredCount, sampledAcknowledgementCount) + sampledCriticalOnlyCount;
  if (!story && unavailable) {
    return (
      <Box
        component="section"
        role="alert"
        data-flow-section="required-notice"
        data-flow-notice-tone="unavailable"
        data-home-governance="ORGANIZATION"
        sx={(theme) => ({
          minHeight: 56,
          px: { xs: 2, md: 2.5 },
          py: 1,
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: 1.25,
          bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === 'dark' ? 0.14 : 0.065),
          border: 1,
          borderColor: alpha(theme.palette.warning.main, 0.32),
          borderRadius: 'var(--home-radius-item)',
          '@media (forced-colors: active)': { bgcolor: 'Canvas', borderColor: 'CanvasText' },
        })}
      >
        <Box sx={{ display: 'inline-flex', color: 'warning.main' }}>
          <BellRing size={19} aria-hidden="true" />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="warning.main" fontWeight={750}>
            {t('flow.updates.requiredUnavailable')}
            {editing && ` · ${t('flow.updates.organizationFixed')}`}
          </Typography>
          <Typography component="p" variant="subtitle2">
            {t('flow.updates.requiredUnavailableDescription')}
          </Typography>
        </Box>
        <ActionButton
          intent="quiet"
          size="small"
          onClick={onRetry}
          loading={fetching}
          loadingLabel={t('page.retry')}
          sx={{ minWidth: 44, minHeight: 44 }}
        >
          {t('page.retry')}
        </ActionButton>
      </Box>
    );
  }
  if (!story && requiredCount === 0) return null;

  const authoritativeCriticalOnlyCount =
    typeof summaryActionableCount === 'number'
      ? Math.max(0, summaryActionableCount - summaryRequiredCount)
      : 0;
  const hasCriticalOnly = authoritativeCriticalOnlyCount > 0 || sampledCriticalOnlyCount > 0;
  const destination = !story
    ? hasCriticalOnly
      ? '/communications/for-you'
      : '/communications/required'
    : hasCriticalOnly
      ? requiredCount === 1
        ? `/communications/for-you/${story.communicationId}`
        : '/communications/for-you'
      : requiredCount > 1
        ? '/communications/required'
        : `/communications/required/${story.communicationId}`;
  const critical =
    summaryCriticalUnreadCount > 0 ||
    requiredStories.some((candidate) => candidate.severity === 'CRITICAL');
  const completeness = !story
    ? 'summary-only'
    : requiredCount > requiredStories.length
      ? 'partial'
      : 'detailed';

  return (
    <Box
      component={Link}
      to={destination}
      data-flow-section="required-notice"
      data-flow-notice-tone={critical ? 'critical' : 'required'}
      data-flow-notice-completeness={completeness}
      data-home-governance="ORGANIZATION"
      sx={(theme) => ({
        minHeight: 56,
        px: { xs: 2, md: 2.5 },
        py: 1,
        display: 'grid',
        gridTemplateColumns: { xs: 'auto minmax(0, 1fr)', sm: 'auto minmax(0, 1fr) auto' },
        alignItems: 'center',
        gap: 1.25,
        color: 'text.primary',
        bgcolor: alpha(
          critical ? theme.palette.error.main : theme.palette.warning.main,
          theme.palette.mode === 'dark' ? 0.14 : 0.065
        ),
        border: 1,
        borderColor: alpha(critical ? theme.palette.error.main : theme.palette.warning.main, 0.32),
        borderRadius: 'var(--home-radius-item)',
        textDecoration: 'none',
        '&:hover': {
          bgcolor: alpha(
            critical ? theme.palette.error.main : theme.palette.warning.main,
            theme.palette.mode === 'dark' ? 0.2 : 0.11
          ),
        },
        '&:focus-visible': {
          outline: '3px solid var(--dwp-focus-ring, currentColor)',
          outlineOffset: 2,
        },
        '@media (forced-colors: active)': {
          bgcolor: 'Canvas',
          borderColor: 'CanvasText',
        },
      })}
    >
      <Box sx={{ display: 'inline-flex', color: critical ? 'error.main' : 'warning.main' }}>
        <BellRing size={19} aria-hidden="true" />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="caption"
          color={critical ? 'error.main' : 'warning.main'}
          fontWeight={750}
        >
          {critical
            ? requiredCount > 1
              ? t('flow.updates.urgentCount', { count: requiredCount })
              : t('flow.updates.urgent')
            : requiredCount > 1
              ? t('flow.updates.requiredCount', { count: requiredCount })
              : t('flow.updates.required')}
          {editing && ` · ${t('flow.updates.organizationFixed')}`}
        </Typography>
        <Typography
          component="p"
          variant="subtitle2"
          sx={{
            display: '-webkit-box',
            overflow: 'hidden',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: { xs: 2, sm: 1 },
          }}
        >
          {story?.title ?? t('flow.updates.requiredPendingDescription')}
        </Typography>
      </Box>
      <Stack
        direction="row"
        alignItems="center"
        gap={0.5}
        color="primary.main"
        sx={{ display: { xs: 'none', sm: 'flex' }, fontWeight: 700 }}
      >
        <Typography variant="body2">{t('flow.updates.review')}</Typography>
        <ArrowRight size={15} aria-hidden="true" />
      </Stack>
    </Box>
  );
}

export function FlowUpdates({
  overview,
  loading,
  fetching,
  requestFailed,
  compact = false,
  wide = false,
  size = 'full',
  height = 'short',
  itemLimit = 3,
  onRetry,
}: FlowUpdatesProps) {
  const { t } = useTranslation(['home', 'communications']);
  const rootRef = useRef<HTMLElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>();
  const section = overview?.communications;
  const unavailable = requestFailed || section?.status === 'UNAVAILABLE';
  const forbidden = section?.status === 'FORBIDDEN';
  const stories = useMemo(() => orderedFlowStories(overview), [overview]);
  const generalStories = stories.filter((story) => !isRequired(story));
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const updateWidth = () => setContainerWidth(root.getBoundingClientRect().width);
    const observer = new ResizeObserver(updateWidth);
    observer.observe(root);
    updateWidth();
    return () => observer.disconnect();
  }, []);
  const responsiveItemLimit = flowUpdatesResponsiveItemLimit(containerWidth, height, itemLimit);
  const { visible, featured, secondary, unreadCount, overflowCount } = flowUpdatesVisibleStories(
    generalStories,
    responsiveItemLimit
  );
  const editorial = wide && !compact && (size === 'large' || size === 'full');
  const bodyHeight = 136;

  const accent = featured
    ? (categoryTone[featured.categoryKey] ?? categoryTone.COMPANY)
    : '#315FD5';

  return (
    <Box
      ref={rootRef}
      component="section"
      aria-labelledby="flow-updates-heading"
      data-flow-section="updates"
      data-flow-updates-wide={editorial ? 'true' : 'false'}
      data-flow-updates-layout="container-responsive"
      data-flow-updates-size={size}
      data-flow-updates-height={height}
      data-flow-updates-visible-limit={responsiveItemLimit}
      data-flow-updates-visible-count={visible.length}
      data-flow-updates-overflow-count={overflowCount}
      sx={{
        minWidth: 0,
        height: 'auto',
        pl: 2,
        pr: { xs: 7, sm: 9 },
        py: 2,
        display: 'flex',
        flexDirection: 'column',
        containerName: 'flow-updates',
        containerType: 'inline-size',
        overflow: 'visible',
        border: 1,
        borderColor: 'divider',
        borderRadius: 'var(--flow-surface-radius)',
        bgcolor: 'var(--home-surface)',
        '& [data-news-secondary-list] [data-story-meta-date], & [data-news-secondary-list] [data-story-meta-read]':
          {
            display: 'none',
          },
        '@container flow-updates (min-width: 720px)': {
          '& [data-news-secondary-list] [data-story-meta-date], & [data-news-secondary-list] [data-story-meta-read]':
            {
              display: 'flex',
            },
        },
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={1}
        flexWrap="wrap"
      >
        <Box sx={{ minWidth: 0, flex: '1 1 210px' }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <Newspaper size={19} aria-hidden="true" />
            <Typography id="flow-updates-heading" component="h2" variant="h6" fontWeight={750}>
              {t('flow.updates.title', { ns: 'home' })}
            </Typography>
            {unreadCount > 0 && (
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={t('flow.updates.unread', { count: unreadCount, ns: 'home' })}
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            {t('flow.updates.description', { ns: 'home' })}
          </Typography>
        </Box>
        <ActionButton
          component={Link}
          to="/communications/for-you"
          intent="quiet"
          size="small"
          endIcon={<ArrowRight size={15} aria-hidden="true" />}
          sx={{ minHeight: 44, flex: '0 0 auto', ml: 'auto' }}
        >
          {t('flow.viewAll', { ns: 'home' })}
        </ActionButton>
      </Stack>

      {loading && (
        <LoadingState label={t('flow.updates.loading', { ns: 'home' })} variant="skeleton" />
      )}
      {!loading && unavailable && (
        <ErrorState
          title={t('flow.updates.loadError', { ns: 'home' })}
          retryLabel={requestFailed ? undefined : t('page.retry', { ns: 'home' })}
          onRetry={requestFailed ? undefined : onRetry}
          retrying={fetching}
          size="compact"
        />
      )}
      {!loading && !unavailable && forbidden && (
        <GuidedEmptyState
          kind="permission"
          title={t('widgets.common.restrictedTitle', { ns: 'home' })}
          description={t('widgets.common.restrictedDescription', { ns: 'home' })}
          size="compact"
        />
      )}
      {!loading && !unavailable && !forbidden && visible.length === 0 && (
        <GuidedEmptyState
          kind="empty"
          title={t('flow.updates.empty', { ns: 'home' })}
          description={t('flow.updates.emptyDescription', { ns: 'home' })}
          size="compact"
        />
      )}
      {!loading && !unavailable && !forbidden && featured && (
        <Box
          sx={{
            mt: compact ? 2 : 1.25,
            minHeight: compact ? 0 : bodyHeight,
            height: 'auto',
            flex: '0 0 auto',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr)',
            alignItems: 'start',
            gap: 1,
            '@container flow-updates (min-width: 720px)': secondary.length
              ? {
                  gridTemplateColumns: 'minmax(0, 7fr) minmax(240px, 5fr)',
                  gap: 1.5,
                }
              : undefined,
            '@container flow-updates (min-width: 960px)': secondary.length
              ? {
                  gridTemplateColumns: 'minmax(0, 2fr) minmax(260px, 1fr)',
                }
              : undefined,
          }}
        >
          <Box
            component={Link}
            to={`/communications/for-you/${featured.communicationId}`}
            data-news-featured
            sx={{
              minWidth: 0,
              minHeight: compact ? 200 : bodyHeight,
              height: '100%',
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr)',
              alignItems: 'stretch',
              overflow: 'hidden',
              color: 'text.primary',
              bgcolor: 'var(--home-surface-subtle)',
              border: 0,
              borderRadius: 'var(--home-radius-item)',
              textDecoration: 'none',
              '&:hover': { bgcolor: 'action.hover' },
              '&:focus-visible': {
                outline: '3px solid var(--dwp-focus-ring, currentColor)',
                outlineOffset: 2,
              },
              '@container flow-updates (min-width: 420px)': featured.coverImageUrl
                ? {
                    gridTemplateColumns: 'minmax(120px, 40%) minmax(180px, 1fr)',
                  }
                : undefined,
              '@container flow-updates (min-width: 720px)': featured.coverImageUrl
                ? {
                    gridTemplateColumns:
                      height === 'short'
                        ? 'minmax(180px, 234px) minmax(220px, 1fr)'
                        : 'minmax(200px, 356px) minmax(220px, 1fr)',
                  }
                : undefined,
            }}
          >
            {featured.coverImageUrl && (
              <Box
                aria-hidden="true"
                data-news-featured-media
                sx={{
                  width: 1,
                  minHeight: 0,
                  height: compact ? 'auto' : 1,
                  aspectRatio: '16 / 9',
                  bgcolor: alpha(accent, 0.08),
                  backgroundImage: `url("${featured.coverImageUrl.replaceAll('"', '%22')}")`,
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: 'cover',
                  alignSelf: 'start',
                  '@container flow-updates (min-width: 420px)': {
                    aspectRatio: compact ? '4 / 3' : 'auto',
                  },
                  '@media (forced-colors: active)': { backgroundImage: 'none' },
                }}
              />
            )}
            <Box
              data-news-featured-copy
              sx={{
                minWidth: 0,
                maxWidth: editorial ? '72ch' : 'none',
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                '@container flow-updates (min-width: 720px)': {
                  p: editorial ? 2.5 : 2,
                },
              }}
            >
              <Typography
                variant="overline"
                sx={(theme) => ({
                  color: theme.palette.mode === 'dark' ? theme.palette.text.primary : accent,
                  fontWeight: 750,
                })}
              >
                {t(`categories.${featured.categoryKey}`, {
                  ns: 'communications',
                  defaultValue: featured.categoryKey,
                })}
              </Typography>
              <Typography
                component="h3"
                variant="h6"
                fontWeight={700}
                sx={{
                  mt: 0.35,
                  fontSize: '0.925rem',
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 2,
                  overflow: 'hidden',
                  '@container flow-updates (min-width: 720px)': {
                    mt: 0.5,
                    fontSize: '1.1rem',
                  },
                }}
              >
                {featured.title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.75,
                  display: 'none',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  '@container flow-updates (min-width: 720px)': {
                    display: '-webkit-box',
                  },
                }}
              >
                {featured.summary}
              </Typography>
              <Box
                sx={{
                  display: 'none',
                  mt: 1,
                  '@container flow-updates (min-width: 720px)': {
                    display: 'block',
                  },
                }}
              >
                <StoryMeta story={featured} />
              </Box>
            </Box>
          </Box>

          {secondary.length > 0 && (
            <Stack
              component="ol"
              data-news-secondary-list
              sx={{
                p: 0,
                m: 0,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
                listStyle: 'none',
              }}
            >
              {secondary.map((story, index) => (
                <Box
                  component="li"
                  key={story.communicationId}
                  data-news-secondary-index={index + 1}
                >
                  <Box
                    component={Link}
                    to={`/communications/for-you/${story.communicationId}`}
                    data-news-secondary-card
                    sx={{
                      minHeight: 62,
                      p: 1.25,
                      display: 'flex',
                      flexDirection: 'column',
                      color: 'text.primary',
                      bgcolor: 'transparent',
                      border: 0,
                      borderBlockStart: index > 0 ? 1 : 0,
                      borderColor: 'divider',
                      borderRadius: 0,
                      textDecoration: 'none',
                      '&:hover': { bgcolor: 'action.hover' },
                      '&:focus-visible': {
                        outline: '3px solid var(--dwp-focus-ring, currentColor)',
                        outlineOffset: 2,
                      },
                      '@container flow-updates (min-width: 720px)': {
                        minHeight: 68,
                      },
                    }}
                  >
                    <Typography variant="caption" color="primary.main" fontWeight={700}>
                      {t(`categories.${story.categoryKey}`, {
                        ns: 'communications',
                        defaultValue: story.categoryKey,
                      })}
                    </Typography>
                    <Typography
                      component="h3"
                      variant="subtitle2"
                      fontWeight={700}
                      sx={{
                        mt: 0.35,
                        display: '-webkit-box',
                        overflow: 'hidden',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 1,
                        '@container flow-updates (min-width: 720px)': {
                          WebkitLineClamp: height === 'short' ? 1 : 2,
                        },
                      }}
                    >
                      {story.title}
                    </Typography>
                    <Box sx={{ mt: 0.75, display: height === 'short' ? 'none' : 'block' }}>
                      <StoryMeta story={story} />
                    </Box>
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}
