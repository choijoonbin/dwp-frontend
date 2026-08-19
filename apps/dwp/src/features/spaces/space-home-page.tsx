import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  ArrowRight,
  Compass,
  Layers3,
  Plus,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ActionButton, EmptyState, PageCanvas } from '@dwp-frontend/design-system';
import { formatDate, formatNumber } from '@dwp-frontend/shared-i18n';
import { getSpaceHome, useAuth } from '@dwp-frontend/shared-utils';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { CreateSpaceDialog } from './create-space-dialog';
import { SpaceCard, SpaceGlyph } from './space-ui';

const METRIC_ICONS = [Layers3, Compass, Activity, UsersRound] as const;

function SpaceHomeLoading() {
  return (
    <PageCanvas>
      <Skeleton variant="rounded" height={264} />
      <Box
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
          gap: 1,
        }}
      >
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} variant="rounded" height={92} />
        ))}
      </Box>
    </PageCanvas>
  );
}

export function SpaceHomePage() {
  const { t, i18n } = useTranslation('spaces');
  const auth = useAuth();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const home = useQuery({
    queryKey: ['spaces', 'home', auth.user?.tenantId, auth.user?.userId],
    queryFn: getSpaceHome,
    staleTime: 30_000,
    retry: 1,
  });

  if (home.isLoading) return <SpaceHomeLoading />;
  if (home.isError || !home.data) {
    return (
      <PageCanvas>
        <Alert
          severity="error"
          action={
            <ActionButton intent="quiet" onClick={() => home.refetch()}>
              {t('actions.retry')}
            </ActionButton>
          }
        >
          {t('home.loadError')}
        </Alert>
      </PageCanvas>
    );
  }

  const data = home.data;
  const language = i18n.resolvedLanguage ?? i18n.language;
  const metricValues = [
    data.metrics.mySpaces,
    data.metrics.discoverableSpaces,
    data.metrics.unreadSignals,
    data.metrics.pendingRequests,
  ];
  const metricKeys = ['mySpaces', 'discoverable', 'unread', 'requests'] as const;
  const openCreate = (templateId?: string) => {
    setSelectedTemplateId(templateId ?? null);
    setCreateOpen(true);
  };

  return (
    <PageCanvas>
      <Box
        component="section"
        sx={{
          minHeight: { xs: 320, md: 286 },
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          overflow: 'hidden',
          color: 'common.white',
          borderRadius: 1,
          bgcolor: '#16232D',
          backgroundImage: 'url(/media/spaces/space-command-center.png)',
          backgroundSize: 'cover',
          backgroundPosition: { xs: '60% center', md: 'center' },
          border: 1,
          borderColor: 'rgba(255,255,255,0.15)',
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(8, 23, 31, 0.46)',
          },
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 1, p: { xs: 2.5, md: 4 }, maxWidth: 650 }}>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <Chip
              icon={<ShieldCheck size={14} />}
              label={t('home.hero.trustLabel')}
              size="small"
              variant="outlined"
              sx={{
                color: 'common.white',
                borderColor: 'rgba(255,255,255,0.34)',
                bgcolor: 'rgba(12,31,42,0.42)',
                '& .MuiChip-icon': { color: '#82D5C8' },
              }}
            />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.88)', fontWeight: 650 }}>
              {formatDate(data.generatedAt, { dateStyle: 'medium', timeStyle: 'short' })}
            </Typography>
          </Stack>
          <Typography component="h1" variant="h3" sx={{ mt: 2, maxWidth: 560 }}>
            {t('home.hero.title', {
              name: auth.user?.displayName ?? t('home.personFallback'),
            })}
          </Typography>
          <Typography sx={{ mt: 1.25, color: 'rgba(255,255,255,0.76)', maxWidth: 560 }}>
            {t('home.hero.description')}
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} sx={{ mt: 3 }}>
            {data.canCreate && (
              <ActionButton
                intent="primary"
                startIcon={<Plus size={17} />}
                onClick={() => openCreate()}
              >
                {t('actions.createSpace')}
              </ActionButton>
            )}
            <ActionButton
              intent="secondary"
              startIcon={<Compass size={17} />}
              onClick={() => navigate('/spaces/discover')}
              sx={{ color: 'common.white', borderColor: 'rgba(255,255,255,0.5)' }}
            >
              {t('actions.explore')}
            </ActionButton>
          </Stack>
        </Box>
      </Box>

      <Box
        component="section"
        aria-label={t('home.metrics.label')}
        sx={{
          mt: 2,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' },
          border: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        {metricKeys.map((key, index) => {
          const Icon = METRIC_ICONS[index];
          return (
            <Box
              key={key}
              sx={{
                minHeight: 92,
                px: 2,
                py: 1.75,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                borderRight: { xs: index % 2 === 0 ? 1 : 0, lg: index < 3 ? 1 : 0 },
                borderBottom: { xs: index < 2 ? 1 : 0, lg: 0 },
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  display: 'grid',
                  placeItems: 'center',
                  color: index === 2 ? '#A7464B' : index === 3 ? '#A86612' : '#315B7A',
                  bgcolor: index === 2 ? '#F6E8E9' : index === 3 ? '#F7EDDD' : '#E6EDF2',
                  borderRadius: 1,
                }}
              >
                <Icon size={18} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {t(`home.metrics.${key}`)}
                </Typography>
                <Typography component="p" variant="h5">
                  {formatNumber(metricValues[index])}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={1}
        sx={{ mt: 4, mb: 1.5 }}
      >
        <Box>
          <Typography component="h2" variant="h5">
            {t('home.focus.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('home.focus.description')}
          </Typography>
        </Box>
        <ActionButton
          intent="quiet"
          endIcon={<ArrowRight size={16} />}
          onClick={() => navigate('/spaces/my')}
        >
          {t('actions.viewAll')}
        </ActionButton>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, minmax(0, 1fr))',
            lg: 'repeat(3, minmax(0, 1fr))',
          },
          gap: 1.5,
        }}
      >
        {data.focusSpaces.slice(0, 6).map((space) => (
          <SpaceCard key={space.spaceId} space={space} />
        ))}
        {!data.focusSpaces.length && (
          <Box sx={{ gridColumn: '1 / -1', border: 1, borderColor: 'divider' }}>
            <EmptyState
              size="compact"
              title={t('home.focus.emptyTitle')}
              description={t('home.focus.emptyDescription')}
              actionLabel={t('actions.explore')}
              onAction={() => navigate('/spaces/discover')}
            />
          </Box>
        )}
      </Box>

      <Box
        sx={{
          mt: 4,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.7fr) minmax(320px, 0.8fr)' },
          gap: 2,
          alignItems: 'stretch',
        }}
      >
        <Paper component="section" variant="outlined" sx={{ p: 0, borderRadius: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2 }}>
            <Box>
              <Typography component="h2" variant="h6">
                {t('home.activity.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('home.activity.description')}
              </Typography>
            </Box>
            <Activity size={19} aria-hidden="true" />
          </Stack>
          <Divider />
          <Stack divider={<Divider flexItem />}>
            {data.recentActivity.slice(0, 6).map((item) => {
              const korean = language.startsWith('ko');
              return (
                <Box key={item.activityId} sx={{ px: 2, py: 1.5 }}>
                  <Stack direction="row" justifyContent="space-between" gap={2}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={700} noWrap>
                        {korean ? item.titleKo : item.titleEn}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {korean ? item.spaceNameKo : item.spaceNameEn}
                        {item.actorName ? ` · ${item.actorName}` : ''}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {formatDate(item.occurredAt, { timeStyle: 'short' })}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
            {!data.recentActivity.length && (
              <EmptyState
                size="compact"
                title={t('home.activity.emptyTitle')}
                description={t('home.activity.emptyDescription')}
              />
            )}
          </Stack>
        </Paper>

        <Paper
          component="section"
          elevation={0}
          sx={{
            p: 2.5,
            color: '#EAF2F5',
            bgcolor: '#172A33',
            border: 1,
            borderColor: '#31515E',
            borderRadius: 1,
          }}
        >
          <Stack direction="row" gap={1} alignItems="center">
            <Sparkles size={18} color="#82D5C8" />
            <Typography component="h2" variant="h6">
              {t('home.insights.title')}
            </Typography>
          </Stack>
          <Stack gap={2} sx={{ mt: 2 }}>
            {data.insights.slice(0, 3).map((insight) => (
              <Box key={insight.key}>
                <Typography fontWeight={750}>
                  {language.startsWith('ko') ? insight.titleKo : insight.titleEn}
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.5, color: 'rgba(234,242,245,0.68)' }}>
                  {language.startsWith('ko') ? insight.detailKo : insight.detailEn}
                </Typography>
              </Box>
            ))}
            {!data.insights.length && (
              <Typography variant="body2" sx={{ color: 'rgba(234,242,245,0.68)' }}>
                {t('home.insights.empty')}
              </Typography>
            )}
          </Stack>
        </Paper>
      </Box>

      <Box component="section" sx={{ mt: 4 }}>
        <Typography component="h2" variant="h5">
          {t('home.templates.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
          {t('home.templates.description')}
        </Typography>
        <Box
          sx={{
            mt: 1.5,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, 1fr)' },
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          {data.recommendedTemplates.slice(0, 4).map((template, index) => {
            const label = {
              name: language.startsWith('ko') ? template.nameKo : template.nameEn,
              summary: language.startsWith('ko') ? template.descriptionKo : template.descriptionEn,
            };
            return (
              <ButtonBase
                key={template.templateId}
                disabled={!data.canCreate}
                onClick={() => openCreate(template.templateId)}
                sx={{
                  width: 1,
                  minHeight: 140,
                  p: 2,
                  display: 'block',
                  textAlign: 'left',
                  color: 'text.primary',
                  borderRight: { xl: index < 3 ? 1 : 0 },
                  borderBottom: { xs: index < 3 ? 1 : 0, xl: 0 },
                  borderColor: 'divider',
                  transition: (theme) => theme.transitions.create(['background-color', 'color']),
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.light' },
                  '&.Mui-disabled': { color: 'text.primary' },
                }}
              >
                <SpaceGlyph
                  iconKey={template.iconKey}
                  accentToken={template.accentToken}
                  size={36}
                />
                <Typography fontWeight={750} sx={{ mt: 1.5 }}>
                  {label.name}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                  {label.summary}
                </Typography>
                {data.canCreate && (
                  <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 1.25 }}>
                    <Typography variant="caption" color="primary.main" fontWeight={750}>
                      {t('actions.useTemplate')}
                    </Typography>
                    <ArrowRight size={14} aria-hidden="true" />
                  </Stack>
                )}
              </ButtonBase>
            );
          })}
          {!data.recommendedTemplates.length && (
            <Box sx={{ gridColumn: '1 / -1' }}>
              <EmptyState
                size="compact"
                title={t('home.templates.emptyTitle')}
                description={t('home.templates.emptyDescription')}
              />
            </Box>
          )}
        </Box>
      </Box>
      <CreateSpaceDialog
        open={createOpen}
        initialTemplateId={selectedTemplateId}
        onClose={() => {
          setCreateOpen(false);
          setSelectedTemplateId(null);
        }}
      />
    </PageCanvas>
  );
}
