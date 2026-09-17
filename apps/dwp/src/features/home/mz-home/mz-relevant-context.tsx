import { useTranslation } from 'react-i18next';
import { ArrowUpRight, CircleHelp, Newspaper, ShieldCheck } from 'lucide-react';
import { ActionButton } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { orderedFlowStories } from '../flow-home/flow-updates';

import type { HomeOverview } from '@dwp-frontend/shared-utils';

type MzRelevantContextProps = Readonly<{
  overview?: HomeOverview;
  loading: boolean;
  fetching: boolean;
  failed: boolean;
  onOpenRoute: (route: string) => void;
}>;

export function MzRelevantContext({
  overview,
  loading,
  fetching,
  failed,
  onOpenRoute,
}: MzRelevantContextProps) {
  const { t } = useTranslation('home');
  const stories = orderedFlowStories(overview)
    .filter((story) => !story.acknowledgementRequired)
    .slice(0, 3);
  const communicationsState = loading
    ? 'LOADING'
    : fetching
      ? 'REFRESHING'
      : failed
        ? 'ERROR'
        : (overview?.communications.status ?? 'UNAVAILABLE');
  const transitional =
    communicationsState === 'LOADING' ||
    communicationsState === 'REFRESHING' ||
    communicationsState === 'ERROR';
  return (
    <Box
      component="section"
      aria-labelledby="mz-relevant-context-title"
      data-mz-relevant-context
      data-mz-relevant-context-state={communicationsState.toLowerCase()}
      aria-busy={loading || fetching ? 'true' : 'false'}
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1.4fr) minmax(280px, .6fr)' },
        gap: 2,
      }}
    >
      <Stack
        gap={1.25}
        sx={{
          p: { xs: 2, md: 2.5 },
          border: 1,
          borderColor: 'divider',
          borderRadius: 3,
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" gap={0.75}>
            <Newspaper size={18} aria-hidden="true" />
            <Typography id="mz-relevant-context-title" variant="subtitle1" fontWeight={750}>
              {t('mz.relatedNews.title')}
            </Typography>
          </Stack>
          <Chip
            size="small"
            variant="outlined"
            label={t(`mz.relatedNews.state.${communicationsState}`)}
          />
        </Stack>
        {transitional && (
          <Typography variant="body2" color="text.secondary" data-mz-news-runtime-state>
            {t(`mz.relatedNews.${communicationsState.toLowerCase()}`)}
          </Typography>
        )}
        {stories.length === 0 && !transitional ? (
          <Typography variant="body2" color="text.secondary">
            {t('mz.relatedNews.empty')}
          </Typography>
        ) : stories.length > 0 ? (
          stories.map((story) => (
            <Stack
              key={story.communicationId}
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ sm: 'center' }}
              justifyContent="space-between"
              gap={1}
              sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}
            >
              <Box minWidth={0}>
                <Typography variant="body2" fontWeight={650}>
                  {story.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {story.publisherName} · {story.readingMinutes} {t('mz.relatedNews.minutes')}
                </Typography>
              </Box>
              <ActionButton
                intent="quiet"
                size="small"
                onClick={() =>
                  onOpenRoute(
                    story.actionUrl?.startsWith('/') ? story.actionUrl : '/communications'
                  )
                }
                endIcon={<ArrowUpRight size={15} aria-hidden="true" />}
              >
                {t('mz.relatedNews.open')}
              </ActionButton>
            </Stack>
          ))
        ) : null}
      </Stack>

      <Stack
        component="aside"
        gap={1.5}
        sx={{
          p: { xs: 2, md: 2.5 },
          border: 1,
          borderColor: 'divider',
          borderRadius: 3,
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" alignItems="center" gap={0.75}>
          <ShieldCheck size={18} aria-hidden="true" />
          <Typography variant="subtitle1" fontWeight={750}>
            {t('mz.scope.title')}
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t('mz.scope.description')}
        </Typography>
        <Stack direction="row" alignItems="center" gap={0.75}>
          <CircleHelp size={17} aria-hidden="true" />
          <Typography variant="subtitle2">{t('mz.scope.helpTitle')}</Typography>
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {t('mz.scope.helpDescription')}
        </Typography>
        <ActionButton intent="quiet" onClick={() => onOpenRoute('/dwaion/personal-controls')}>
          {t('mz.scope.openControls')}
        </ActionButton>
      </Stack>
    </Box>
  );
}
