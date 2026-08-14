import { ArrowRight, CircleAlert, Newspaper } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ErrorState, GuidedEmptyState } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import type { HomeOverviewWidgetProps } from './home-widgets';

const categoryAccent: Record<string, string> = {
  COMPANY: '#315FD5',
  INNOVATION: '#6C4AC7',
  CULTURE: '#D64F5F',
  SECURITY: '#0A7C84',
  LEADERSHIP: '#A45A06',
  GROWTH: '#18794E',
};

export function AnnouncementsWidget({
  overview,
  loading,
  fetching,
  requestFailed,
  onRetry,
}: HomeOverviewWidgetProps) {
  const { t } = useTranslation('communications');
  const section = overview?.communications;
  const feed = section?.data;
  const stories = [feed?.featured, ...(feed?.items ?? [])]
    .filter((item) => Boolean(item))
    .slice(0, 3);
  const unavailable = requestFailed || section?.status === 'UNAVAILABLE';
  const forbidden = section?.status === 'FORBIDDEN';

  return (
    <Box
      component="section"
      aria-labelledby="announcements-heading"
      sx={{ gridColumn: '1 / -1', borderTop: 1, borderBottom: 1, borderColor: 'divider' }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        gap={2}
        sx={{ minHeight: 58, borderBottom: 1, borderColor: 'divider' }}
      >
        <Stack direction="row" alignItems="center" gap={1}>
          <Box
            sx={{
              width: 34,
              height: 34,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1,
              bgcolor: '#EAF0FF',
              color: '#315FD5',
            }}
          >
            <Newspaper size={18} aria-hidden="true" />
          </Box>
          <Box>
            <Typography id="announcements-heading" component="h2" variant="subtitle1">
              {t('home.title')}
            </Typography>
            {(feed?.summary.unread ?? 0) > 0 && (
              <Typography variant="caption" color="text.secondary">
                {t('home.count', { count: feed?.summary.unread ?? 0 })}
              </Typography>
            )}
          </Box>
        </Stack>
        <Typography
          component={Link}
          to="/communications/for-you"
          variant="body2"
          color="primary.main"
          fontWeight={700}
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, textDecoration: 'none' }}
        >
          {t('home.viewAll')}
          <ArrowRight size={15} aria-hidden="true" />
        </Typography>
      </Stack>

      {loading ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
            gap: 2,
            py: 2,
          }}
          aria-busy="true"
        >
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} variant="rounded" height={124} />
          ))}
        </Box>
      ) : unavailable ? (
        <ErrorState
          title={t('home.loadError')}
          retryLabel={t('home.retry')}
          onRetry={onRetry}
          retrying={fetching}
          size="compact"
        />
      ) : forbidden ? (
        <GuidedEmptyState
          kind="permission"
          title={t('home.restrictedTitle')}
          description={t('home.restrictedDescription')}
          size="compact"
        />
      ) : stories.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
          {t('home.empty')}
        </Typography>
      ) : (
        <Box
          component="ul"
          sx={{
            m: 0,
            p: 0,
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {stories.map((story, index) => {
            if (!story) return null;
            const accent = categoryAccent[story.categoryKey] ?? categoryAccent.COMPANY;
            return (
              <Box
                component="li"
                key={story.communicationId}
                sx={{
                  minWidth: 0,
                  borderRight: { md: index < stories.length - 1 ? 1 : 0 },
                  borderBottom: { xs: index < stories.length - 1 ? 1 : 0, md: 0 },
                  borderColor: 'divider',
                }}
              >
                <Box
                  component={Link}
                  to={`/communications/for-you/${story.communicationId}`}
                  sx={{
                    minHeight: 154,
                    p: 2,
                    display: 'grid',
                    gridTemplateColumns: story.coverImageUrl ? '92px minmax(0, 1fr)' : '1fr',
                    alignItems: 'start',
                    gap: 1.5,
                    color: 'text.primary',
                    textDecoration: 'none',
                    borderTop: `3px solid ${accent}`,
                    transition: 'background-color 150ms ease',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  {story.coverImageUrl && (
                    <Box
                      component="img"
                      src={story.coverImageUrl}
                      alt=""
                      loading="lazy"
                      sx={{ width: 92, height: 104, objectFit: 'cover', borderRadius: 1 }}
                    />
                  )}
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                      <Typography variant="overline" sx={{ color: accent }}>
                        {t(`categories.${story.categoryKey}`, { defaultValue: story.categoryKey })}
                      </Typography>
                      {story.acknowledgementRequired && !story.readerState.acknowledged && (
                        <Chip
                          size="small"
                          icon={<CircleAlert size={13} />}
                          label={t('home.required')}
                          color="warning"
                          sx={{ height: 22 }}
                        />
                      )}
                    </Stack>
                    <Typography component="h3" variant="subtitle1" sx={{ mt: 0.75 }}>
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
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
