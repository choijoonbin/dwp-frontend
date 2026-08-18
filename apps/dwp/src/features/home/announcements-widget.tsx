import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Clock3, Newspaper, Pause, Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ActionIconButton, ErrorState, GuidedEmptyState } from '@dwp-frontend/design-system';
import { formatDate } from '@dwp-frontend/shared-i18n';

import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

import type { CommunicationItem } from '@dwp-frontend/shared-utils';
import { SectionHeading } from '../../components/workspace-ui';
import type { HomeOverviewWidgetProps } from './home-widgets';

const categoryAccent: Record<string, string> = {
  COMPANY: '#315FD5',
  INNOVATION: '#6C4AC7',
  CULTURE: '#D64F5F',
  SECURITY: '#0A7C84',
  LEADERSHIP: '#A45A06',
  GROWTH: '#18794E',
};

const categoryFallbackImage: Record<string, string> = {
  COMPANY: '/media/communications/community-day.jpg',
  INNOVATION: '/media/communications/innovation-lab.jpg',
  CULTURE: '/media/communications/community-day.jpg',
  SECURITY: '/media/communications/security-readiness.jpg',
  LEADERSHIP: '/media/communications/community-day.jpg',
  GROWTH: '/media/communications/innovation-lab.jpg',
};

const NEWS_ROTATION_INTERVAL_MS = 3000;
const NEWS_FADE_DURATION_MS = 420;

function storyImageUrl(story: CommunicationItem): string {
  return (
    story.coverImageUrl || categoryFallbackImage[story.categoryKey] || categoryFallbackImage.COMPANY
  );
}

function recentStories(
  featured: CommunicationItem | null | undefined,
  items: readonly CommunicationItem[] = []
): CommunicationItem[] {
  const unique = new Map<number, CommunicationItem>();
  for (const story of [featured, ...items]) {
    if (story) unique.set(story.communicationId, story);
  }
  return [...unique.values()]
    .sort((left, right) => {
      const leftTime = Date.parse(left.publishedAt ?? '') || 0;
      const rightTime = Date.parse(right.publishedAt ?? '') || 0;
      return rightTime - leftTime || right.communicationId - left.communicationId;
    })
    .slice(0, 5);
}

function AnnouncementStory({
  story,
  accent,
  outgoing = false,
  animate = false,
  reduceMotion,
}: {
  story: CommunicationItem;
  accent: string;
  outgoing?: boolean;
  animate?: boolean;
  reduceMotion: boolean;
}) {
  const { t } = useTranslation('communications');

  return (
    <Box
      component={Link}
      to={`/communications/for-you/${story.communicationId}`}
      data-news-story-id={story.communicationId}
      data-news-layer={outgoing ? 'outgoing' : 'active'}
      aria-hidden={outgoing || undefined}
      aria-live="off"
      tabIndex={outgoing ? -1 : undefined}
      sx={{
        position: outgoing ? 'absolute' : 'relative',
        inset: outgoing ? 0 : undefined,
        zIndex: outgoing ? 1 : 2,
        minHeight: 166,
        height: 1,
        display: 'grid',
        gridTemplateColumns: 'minmax(96px, 38%) minmax(0, 1fr)',
        color: 'text.primary',
        bgcolor: 'background.paper',
        textDecoration: 'none',
        pointerEvents: outgoing ? 'none' : 'auto',
        animation:
          reduceMotion || !animate
            ? 'none'
            : outgoing
              ? `dwp-news-fade-out ${NEWS_FADE_DURATION_MS}ms cubic-bezier(0.4, 0, 1, 1) both`
              : `dwp-news-fade-in ${NEWS_FADE_DURATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
        willChange: animate && !reduceMotion ? 'opacity' : 'auto',
        transition: 'background-color 150ms ease',
        '&:hover': { bgcolor: 'action.hover' },
        '&:focus-visible': {
          outline: '3px solid',
          outlineColor: 'primary.main',
          outlineOffset: -3,
        },
        '@keyframes dwp-news-fade-in': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        '@keyframes dwp-news-fade-out': {
          from: { opacity: 1 },
          to: { opacity: 0 },
        },
      }}
    >
      <Box
        component="img"
        src={storyImageUrl(story)}
        alt=""
        sx={{ width: 1, height: 1, minHeight: 166, objectFit: 'cover', bgcolor: accent }}
      />
      <Box
        sx={{
          minWidth: 0,
          p: { xs: 1.5, sm: 2 },
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Typography
          variant="overline"
          sx={{
            width: 'fit-content',
            px: 0.75,
            py: 0.125,
            color: accent,
            bgcolor: alpha(accent, 0.1),
            borderRadius: 0.5,
            fontWeight: 700,
          }}
        >
          {t(`categories.${story.categoryKey}`, { defaultValue: story.categoryKey })}
        </Typography>
        <Typography
          component="h3"
          sx={{
            mt: 0.75,
            fontSize: { xs: 15, sm: 17 },
            fontWeight: 650,
            lineHeight: { xs: '20px', sm: '23px' },
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {story.title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 0.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {story.summary}
        </Typography>
        <Stack
          direction="row"
          alignItems="center"
          gap={0.75}
          color="text.secondary"
          sx={{ mt: 'auto', minWidth: 0 }}
        >
          <Typography variant="caption" noWrap sx={{ maxWidth: 112 }}>
            {story.publisherName}
          </Typography>
          {story.publishedAt && (
            <Stack
              direction="row"
              alignItems="center"
              gap={0.35}
              sx={{ display: { xs: 'none', sm: 'flex' } }}
            >
              <CalendarDays size={12} aria-hidden="true" />
              <Typography variant="caption" noWrap>
                {formatDate(story.publishedAt, { dateStyle: 'medium' })}
              </Typography>
            </Stack>
          )}
          <Stack direction="row" alignItems="center" gap={0.35}>
            <Clock3 size={12} aria-hidden="true" />
            <Typography variant="caption" noWrap>
              {t('story.readTime', { count: story.readingMinutes })}
            </Typography>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}

export function AnnouncementsWidget({
  overview,
  loading,
  fetching,
  requestFailed,
  onRetry,
}: HomeOverviewWidgetProps) {
  const { t } = useTranslation('communications');
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [activeIndex, setActiveIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [autoPaused, setAutoPaused] = useState(false);
  const activeIndexRef = useRef(0);
  const transitionTimerRef = useRef<number | null>(null);
  const section = overview?.communications;
  const feed = section?.data;
  const stories = useMemo(() => recentStories(feed?.featured, feed?.items), [feed]);
  const story = stories[activeIndex];
  const outgoingStory = outgoingIndex === null ? undefined : stories[outgoingIndex];
  const unavailable = requestFailed || section?.status === 'UNAVAILABLE';
  const forbidden = section?.status === 'FORBIDDEN';
  const accent = story
    ? (categoryAccent[story.categoryKey] ?? categoryAccent.COMPANY)
    : categoryAccent.COMPANY;

  const showStory = useCallback(
    (requestedIndex: number) => {
      if (!stories.length) return;
      const nextIndex = ((requestedIndex % stories.length) + stories.length) % stories.length;
      const currentIndex = activeIndexRef.current;
      if (nextIndex === currentIndex) return;

      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }

      activeIndexRef.current = nextIndex;
      if (reduceMotion) {
        setOutgoingIndex(null);
        setTransitioning(false);
        setActiveIndex(nextIndex);
        return;
      }

      setOutgoingIndex(currentIndex);
      setActiveIndex(nextIndex);
      setTransitioning(true);
      transitionTimerRef.current = window.setTimeout(() => {
        setOutgoingIndex(null);
        setTransitioning(false);
        transitionTimerRef.current = null;
      }, NEWS_FADE_DURATION_MS);
    },
    [reduceMotion, stories.length]
  );

  useEffect(() => {
    if (activeIndexRef.current < stories.length) return;
    activeIndexRef.current = 0;
    setActiveIndex(0);
    setOutgoingIndex(null);
    setTransitioning(false);
  }, [stories.length]);

  useEffect(() => {
    for (const item of stories) {
      const image = new window.Image();
      image.decoding = 'async';
      image.src = storyImageUrl(item);
    }
  }, [stories]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    },
    []
  );

  useEffect(() => {
    if (stories.length < 2 || reduceMotion || interactionPaused || autoPaused) return undefined;
    const timer = window.setInterval(() => {
      showStory(activeIndexRef.current + 1);
    }, NEWS_ROTATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoPaused, interactionPaused, reduceMotion, showStory, stories.length]);

  return (
    <Box
      component="section"
      aria-labelledby="announcements-heading"
      data-testid="home-news-carousel"
      data-news-transitioning={transitioning ? 'true' : 'false'}
      onMouseEnter={() => setInteractionPaused(true)}
      onMouseLeave={() => setInteractionPaused(false)}
      onFocusCapture={() => setInteractionPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setInteractionPaused(false);
        }
      }}
      sx={{ minWidth: 0, height: 1, display: 'flex', flexDirection: 'column' }}
    >
      <Box sx={{ mb: 2 }}>
        <SectionHeading
          id="announcements-heading"
          icon={Newspaper}
          title={t('home.title')}
          divider
          meta={
            (feed?.summary.total ?? 0) > 0
              ? t('home.totalCount', { count: feed?.summary.total ?? 0 })
              : undefined
          }
        />
      </Box>

      <Box
        sx={{
          minHeight: 216,
          flex: 1,
          display: 'grid',
          gridTemplateRows: 'minmax(0, 1fr) auto',
          bgcolor: 'background.paper',
          border: 1,
          borderColor: accent,
          borderRadius: 0.5,
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
          transition: reduceMotion ? 'none' : `border-color ${NEWS_FADE_DURATION_MS}ms ease`,
        }}
      >
        {loading ? (
          <Box
            aria-busy="true"
            sx={{ display: 'grid', gridTemplateColumns: '38% 1fr', minHeight: 166 }}
          >
            <Skeleton variant="rectangular" height="100%" />
            <Box sx={{ p: 2 }}>
              <Skeleton variant="text" width="38%" />
              <Skeleton variant="text" width="88%" />
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="72%" />
            </Box>
          </Box>
        ) : unavailable ? (
          <Box sx={{ minHeight: 166, display: 'grid', placeItems: 'center' }}>
            <ErrorState
              title={t('home.loadError')}
              retryLabel={t('home.retry')}
              onRetry={onRetry}
              retrying={fetching}
              size="compact"
            />
          </Box>
        ) : forbidden ? (
          <Box sx={{ minHeight: 166, display: 'grid', placeItems: 'center' }}>
            <GuidedEmptyState
              kind="permission"
              title={t('home.restrictedTitle')}
              description={t('home.restrictedDescription')}
              size="compact"
            />
          </Box>
        ) : story ? (
          <Box sx={{ position: 'relative', minHeight: 166, overflow: 'hidden' }}>
            {outgoingStory && (
              <AnnouncementStory
                key={`outgoing-${outgoingStory.communicationId}`}
                story={outgoingStory}
                accent={categoryAccent[outgoingStory.categoryKey] ?? categoryAccent.COMPANY}
                outgoing
                animate={transitioning}
                reduceMotion={reduceMotion}
              />
            )}
            <AnnouncementStory
              key={`active-${story.communicationId}`}
              story={story}
              accent={accent}
              animate={transitioning}
              reduceMotion={reduceMotion}
            />
          </Box>
        ) : (
          <Box sx={{ minHeight: 166, px: 2, display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {t('home.empty')}
            </Typography>
          </Box>
        )}

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          gap={1}
          sx={{ minHeight: 48, px: 1.5, borderTop: 1, borderColor: 'divider' }}
        >
          <Stack direction="row" alignItems="center" gap={0.25} minWidth={0}>
            {stories.length > 1 && (
              <>
                {stories.map((item, index) => (
                  <Box
                    key={item.communicationId}
                    component="button"
                    type="button"
                    aria-label={t('home.showStory', { index: index + 1 })}
                    aria-current={index === activeIndex ? 'true' : undefined}
                    onClick={() => showStory(index)}
                    sx={{
                      width: 20,
                      height: 28,
                      p: 0,
                      border: 0,
                      bgcolor: 'transparent',
                      display: 'grid',
                      placeItems: 'center',
                      cursor: 'pointer',
                      '&::before': {
                        content: '""',
                        width: index === activeIndex ? 14 : 6,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: index === activeIndex ? 'primary.main' : 'divider',
                        transition: reduceMotion ? 'none' : 'width 180ms ease',
                      },
                    }}
                  />
                ))}
                {!reduceMotion && (
                  <ActionIconButton
                    size="small"
                    label={t(autoPaused ? 'home.resumeRotation' : 'home.pauseRotation')}
                    onClick={() => setAutoPaused((current) => !current)}
                    sx={{ ml: 0.25 }}
                  >
                    {autoPaused ? <Play size={15} /> : <Pause size={15} />}
                  </ActionIconButton>
                )}
              </>
            )}
          </Stack>
          <Typography
            component={Link}
            to="/communications/for-you"
            variant="body2"
            color="primary.main"
            fontWeight={700}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {t('home.viewAll')}
            <ArrowRight size={15} aria-hidden="true" />
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}
