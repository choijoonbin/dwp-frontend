import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Grid3X3,
  Search,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';
import { useAuth, usePermissions, useToast } from '@dwp-frontend/shared-utils';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import ButtonBase from '@mui/material/ButtonBase';
import ToggleButton from '@mui/material/ToggleButton';
import Typography from '@mui/material/Typography';
import InputAdornment from '@mui/material/InputAdornment';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';

import { PageHeader, ReferenceModeChip, SectionHeading } from '../features/work-hub/workspace-ui';
import { localizeReferenceApps } from '../features/work-hub/reference-data';
import { HOME_APPS, isAppEntitled } from '../features/home/app-launchpad-model';
import { AppGlyph } from '../features/home/app-glyph';

import type { ReferenceApp } from '../features/work-hub/reference-data';

type AppFilter = 'all' | 'pinned' | 'native' | 'connected';

const homeAppById = new Map(HOME_APPS.map((app) => [app.id, app]));
const fallbackAppVisual = { iconKey: 'legacy', tone: '#4B5663' } as const;

function appVisual(app: ReferenceApp) {
  return homeAppById.get(app.id) ?? fallbackAppVisual;
}

function HealthIcon({ health }: { health: ReferenceApp['health'] }) {
  if (health === 'healthy') return <CheckCircle2 size={15} strokeWidth={1.8} />;
  if (health === 'attention') return <TriangleAlert size={15} strokeWidth={1.8} />;
  return <ShieldCheck size={15} strokeWidth={1.8} />;
}

function AppIcon({ app, size = 46 }: { app: ReferenceApp; size?: number }) {
  return <AppGlyph app={appVisual(app)} size={size} />;
}

export default function AppsPage() {
  const { t } = useTranslation('work');
  const auth = useAuth();
  const { permissions } = usePermissions();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<AppFilter>('all');
  const [query, setQuery] = useState('');
  const selectedAppId = searchParams.get('app');
  const entitledReferenceApps = useMemo(() => {
    const entitledIds = new Set(
      HOME_APPS.filter((app) => isAppEntitled(app, auth.user?.roles ?? [], permissions)).map(
        (app) => app.id
      )
    );
    return localizeReferenceApps(t).filter((app) => entitledIds.has(app.id));
  }, [auth.user?.roles, permissions, t]);
  const pinnedApps = entitledReferenceApps.filter((app) => app.pinned);

  const visibleApps = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return entitledReferenceApps.filter((app) => {
      const filterMatch =
        filter === 'all' ||
        (filter === 'pinned' && app.pinned) ||
        (filter === 'native' && app.launchMode === 'Native') ||
        (filter === 'connected' && app.launchMode !== 'Native');
      const queryMatch =
        !normalized ||
        [app.name, app.description, app.owner].some((value) =>
          value.toLowerCase().includes(normalized)
        );
      return filterMatch && queryMatch;
    });
  }, [entitledReferenceApps, filter, query]);

  const changeFilter = (_event: React.MouseEvent<HTMLElement>, value: AppFilter | null) => {
    if (value) setFilter(value);
  };

  const launch = (app: ReferenceApp) =>
    toast.success(t('appsPage.launchOpened', { app: app.name }));

  return (
    <PageCanvas>
      <PageHeader
        eyebrow={t('appsPage.header.eyebrow')}
        title={t('appsPage.header.title')}
        description={t('appsPage.header.description')}
        action={<ReferenceModeChip />}
      />

      <Box component="section" aria-labelledby="launchpad-heading" sx={{ mt: 4 }}>
        <SectionHeading
          id="launchpad-heading"
          icon={Grid3X3}
          title={t('appsPage.launchpad')}
          meta={
            <Typography variant="body2" color="text.secondary">
              {t('appsPage.pinnedCount', { count: pinnedApps.length })}
            </Typography>
          }
        />
        <Box
          component="ul"
          sx={{
            p: 0,
            mt: 2,
            mb: 0,
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: { xs: 'none', sm: 'repeat(3, minmax(0, 1fr))' },
            gridAutoFlow: { xs: 'column', sm: 'row' },
            gridAutoColumns: { xs: 'minmax(270px, 82vw)', sm: 'auto' },
            gap: 1.5,
            overflowX: { xs: 'auto', sm: 'visible' },
            scrollSnapType: { xs: 'x mandatory', sm: 'none' },
            pb: { xs: 1, sm: 0 },
          }}
        >
          {pinnedApps.map((app) => (
            <Box component="li" key={app.id} sx={{ minWidth: 0, scrollSnapAlign: 'start' }}>
              <ButtonBase
                onClick={() => launch(app)}
                sx={{
                  width: 1,
                  minHeight: 166,
                  p: 2.5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  justifyContent: 'space-between',
                  gap: 2,
                  textAlign: 'left',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  borderTop: 3,
                  borderTopColor: appVisual(app).tone,
                  borderRadius: 1,
                  transition: (theme) =>
                    theme.transitions.create(['border-color', 'box-shadow', 'transform']),
                  '&:hover': {
                    borderColor: appVisual(app).tone,
                    transform: 'translateY(-2px)',
                    boxShadow: '0 12px 28px rgba(15, 21, 29, 0.09)',
                  },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 2,
                  }}
                >
                  <AppIcon app={app} size={50} />
                  <ArrowUpRight size={17} strokeWidth={1.8} aria-hidden="true" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography component="h3" variant="subtitle1">
                    {app.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>
                    {app.description}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1 }}
                  >
                    {t('appsPage.lastUsed', { value: app.lastUsed })}
                  </Typography>
                </Box>
              </ButtonBase>
            </Box>
          ))}
        </Box>
      </Box>

      <Box
        sx={{
          mt: 5,
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(280px, 1fr) auto' },
          gap: 2,
          alignItems: 'center',
        }}
      >
        <TextField
          label={t('appsPage.searchLabel')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('appsPage.searchPlaceholder')}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} strokeWidth={1.8} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        <ToggleButtonGroup
          exclusive
          size="small"
          value={filter}
          onChange={changeFilter}
          aria-label={t('appsPage.filterLabel')}
          sx={{ overflowX: 'auto', maxWidth: 1 }}
        >
          <ToggleButton value="all">{t('appsPage.filters.all')}</ToggleButton>
          <ToggleButton value="pinned">{t('appsPage.filters.pinned')}</ToggleButton>
          <ToggleButton value="native">{t('appsPage.filters.native')}</ToggleButton>
          <ToggleButton value="connected">{t('appsPage.filters.connected')}</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mt: 3 }}>
        <Typography component="h2" variant="h6">
          {t('appsPage.available')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t('appsPage.appCount', { count: visibleApps.length })}
        </Typography>
      </Box>

      {visibleApps.length > 0 ? (
        <Box
          component="ul"
          sx={{
            p: 0,
            mt: 1.5,
            mb: 0,
            listStyle: 'none',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
            borderTop: 1,
            borderLeft: { xs: 0, lg: 1 },
            borderColor: 'divider',
          }}
        >
          {visibleApps.map((app) => {
            const selected = selectedAppId === app.id;
            const healthColor =
              app.health === 'healthy'
                ? 'success.main'
                : app.health === 'attention'
                  ? 'warning.main'
                  : 'info.main';
            return (
              <Box
                component="li"
                key={app.id}
                sx={{
                  minWidth: 0,
                  borderRight: { xs: 0, lg: 1 },
                  borderBottom: 1,
                  borderColor: 'divider',
                }}
              >
                <ButtonBase
                  onClick={() => launch(app)}
                  sx={{
                    width: 1,
                    minHeight: 116,
                    p: 2,
                    display: 'grid',
                    gridTemplateColumns: '46px minmax(0, 1fr) auto',
                    alignItems: 'start',
                    gap: 1.75,
                    textAlign: 'left',
                    bgcolor: selected ? 'action.selected' : 'transparent',
                    transition: (theme) => theme.transitions.create('background-color'),
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <AppIcon app={app} />
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography component="h3" variant="subtitle2">
                        {app.name}
                      </Typography>
                      {app.pinned && (
                        <Chip label={t('appsPage.pinned')} size="small" color="info" />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.2 }}>
                      {app.description}
                    </Typography>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexWrap: 'wrap',
                        mt: 1,
                      }}
                    >
                      <Chip
                        label={t(`appsPage.launchMode.${app.launchMode}`)}
                        size="small"
                        variant="outlined"
                      />
                      <Box
                        sx={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 0.5,
                          color: healthColor,
                        }}
                      >
                        <HealthIcon health={app.health} />
                        <Typography variant="caption" color="inherit" fontWeight={700}>
                          {t(`appsPage.health.${app.health}`)}
                        </Typography>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {app.owner}
                      </Typography>
                    </Box>
                  </Box>
                  <ArrowRight size={17} strokeWidth={1.8} aria-hidden="true" />
                </ButtonBase>
              </Box>
            );
          })}
        </Box>
      ) : (
        <Box
          sx={{ py: 8, borderTop: 1, borderBottom: 1, borderColor: 'divider', textAlign: 'center' }}
        >
          <Search size={28} strokeWidth={1.6} aria-hidden="true" />
          <Typography component="p" variant="subtitle1" sx={{ mt: 1.5 }}>
            {t('appsPage.noMatches')}
          </Typography>
          <Button
            sx={{ mt: 1.5 }}
            onClick={() => {
              setQuery('');
              setFilter('all');
            }}
          >
            {t('appsPage.resetFilters')}
          </Button>
        </Box>
      )}
    </PageCanvas>
  );
}
