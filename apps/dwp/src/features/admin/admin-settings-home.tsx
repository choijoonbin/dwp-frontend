import { ArrowRight, Bot, Cable, Search, Settings2, Waves } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { usePermissions } from '@dwp-frontend/shared-utils/auth/use-permissions';
import { FormField, PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { canAccessAdminNavigationItem } from './admin-access-policy';
import { ADMIN_NAVIGATION } from './admin-navigation';
import { filterSettingsDocuments } from '../../components/settings-search';

const ENHANCEMENT_ENTRIES = [
  {
    key: 'application',
    route: '/admin/governance/api-monitoring',
    icon: Waves,
    resourceKey: 'ADMIN.API_MONITORING',
  },
  {
    key: 'connections',
    route: '/admin/integrations/productivity',
    icon: Cable,
    resourceKey: 'ADMIN.PRODUCTIVITY_CONNECTOR',
  },
  {
    key: 'ai',
    route: '/dwaion/admin/overview',
    icon: Bot,
    resourceKey: 'ADMIN.DWAION_OPERATIONS',
  },
] as const;

export function AdminSettingsHome() {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const { hasPermission, isLoaded } = usePermissions();
  const [query, setQuery] = useState('');

  const groups = useMemo(
    () =>
      ADMIN_NAVIGATION.map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          canAccessAdminNavigationItem(item, {
            roles: auth.user?.roles ?? [],
            permissionsLoaded: isLoaded,
            hasPermission,
            resourceRoles: auth.user?.resourceRoles,
          })
        ),
      })).filter((group) => group.items.length > 0),
    [auth.user?.resourceRoles, auth.user?.roles, hasPermission, isLoaded]
  );

  const visiblePaths = useMemo(() => {
    const documents = groups.flatMap((group) =>
      group.items.map((item) => ({
        value: item.path,
        fields: [
          t(`navigation.groups.${group.id}`),
          t(`navigation.items.${item.view}.label`),
          t(`navigation.items.${item.view}.title`),
          t(`navigation.items.${item.view}.description`),
        ],
      }))
    );
    return new Set(filterSettingsDocuments(documents, query));
  }, [groups, query, t]);

  const visibleCount = groups.reduce(
    (count, group) => count + group.items.filter((item) => visiblePaths.has(item.path)).length,
    0
  );
  const availableEnhancements = ENHANCEMENT_ENTRIES.filter(({ resourceKey }) =>
    hasPermission(resourceKey, 'VIEW')
  );

  return (
    <PageCanvas>
      <Stack gap={3}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          justifyContent="space-between"
          gap={2}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="primary.main">
              {t('settingsHome.eyebrow')}
            </Typography>
            <Stack direction="row" alignItems="flex-start" gap={1.25} sx={{ mt: 0.25 }}>
              <Box
                aria-hidden="true"
                sx={{
                  width: 40,
                  height: 40,
                  flex: '0 0 40px',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 'shape.borderRadius',
                  color: 'primary.main',
                  bgcolor: 'action.selected',
                }}
              >
                <Settings2 size={20} strokeWidth={1.8} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography component="h1" variant="h4">
                  {t('settingsHome.title')}
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('settingsHome.description')}
                </Typography>
              </Box>
            </Stack>
          </Box>
          <Chip
            size="small"
            variant="outlined"
            label={t('settingsHome.availableCount', { count: visibleCount })}
          />
        </Stack>

        <FormField
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          label={t('settingsHome.searchLabel')}
          placeholder={t('settingsHome.searchPlaceholder')}
          slotProps={{
            htmlInput: { 'aria-describedby': 'admin-settings-search-help' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Typography id="admin-settings-search-help" variant="caption" color="text.secondary">
          {t('settingsHome.searchHelp')}
        </Typography>

        {!query.trim() && availableEnhancements.length > 0 && (
          <Box component="section" aria-labelledby="admin-settings-control-loop">
            <Typography id="admin-settings-control-loop" component="h2" variant="h6">
              {t('settingsHome.controlLoop.title')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('settingsHome.controlLoop.description')}
            </Typography>
            <Box
              sx={{
                mt: 1.25,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: `repeat(${Math.min(availableEnhancements.length, 3)}, minmax(0, 1fr))`,
                },
                gap: 1.25,
              }}
            >
              {availableEnhancements.map(({ key, route, icon: EntryIcon }) => (
                <Paper key={key} variant="outlined" sx={{ overflow: 'hidden' }}>
                  <ButtonBase
                    component={NavLink}
                    to={route}
                    sx={{
                      width: 1,
                      minHeight: 136,
                      p: 2,
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 1.5,
                      textAlign: 'left',
                      '&:focus-visible': {
                        outline: '3px solid',
                        outlineColor: 'primary.main',
                        outlineOffset: -3,
                      },
                    }}
                  >
                    <Stack gap={1} sx={{ minWidth: 0 }}>
                      <EntryIcon size={20} strokeWidth={1.8} aria-hidden="true" />
                      <Typography component="h3" variant="subtitle1" fontWeight="fontWeightBold">
                        {t(`settingsHome.controlLoop.${key}.title`)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t(`settingsHome.controlLoop.${key}.description`)}
                      </Typography>
                    </Stack>
                    <ArrowRight size={18} aria-hidden="true" />
                  </ButtonBase>
                </Paper>
              ))}
            </Box>
          </Box>
        )}

        {visibleCount === 0 ? (
          <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
            <Typography component="h2" variant="h6">
              {t('settingsHome.emptyTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {t('settingsHome.emptyDescription')}
            </Typography>
          </Paper>
        ) : (
          groups.map((group) => {
            const items = group.items.filter((item) => visiblePaths.has(item.path));
            if (items.length === 0) return null;
            return (
              <Box component="section" key={group.id} aria-labelledby={`admin-${group.id}`}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                  <Typography id={`admin-${group.id}`} component="h2" variant="h6">
                    {t(`navigation.groups.${group.id}`)}
                  </Typography>
                  <Chip size="small" label={items.length} variant="outlined" />
                </Stack>
                <Box
                  sx={{
                    mt: 1.25,
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 1.25,
                  }}
                >
                  {items.map((item) => {
                    const ItemIcon = item.icon;
                    return (
                      <Paper key={item.path} variant="outlined" sx={{ overflow: 'hidden' }}>
                        <ButtonBase
                          component={NavLink}
                          to={item.path}
                          sx={{
                            width: 1,
                            minHeight: 112,
                            p: 2,
                            display: 'grid',
                            gridTemplateColumns: '40px minmax(0, 1fr) 20px',
                            gap: 1.5,
                            alignItems: 'center',
                            justifyItems: 'stretch',
                            textAlign: 'left',
                            '&:focus-visible': {
                              outline: '3px solid',
                              outlineColor: 'primary.main',
                              outlineOffset: -3,
                            },
                          }}
                        >
                          <Box
                            aria-hidden="true"
                            sx={{
                              width: 40,
                              height: 40,
                              display: 'grid',
                              placeItems: 'center',
                              borderRadius: 'shape.borderRadius',
                              bgcolor: 'action.hover',
                              color: 'text.secondary',
                            }}
                          >
                            <ItemIcon size={19} strokeWidth={1.8} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              component="h3"
                              variant="subtitle1"
                              fontWeight="fontWeightBold"
                            >
                              {t(`navigation.items.${item.view}.label`)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                              {t(`navigation.items.${item.view}.description`)}
                            </Typography>
                          </Box>
                          <ArrowRight size={18} aria-hidden="true" />
                        </ButtonBase>
                      </Paper>
                    );
                  })}
                </Box>
              </Box>
            );
          })
        )}
      </Stack>
    </PageCanvas>
  );
}
