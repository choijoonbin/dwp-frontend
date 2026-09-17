import {
  ArrowRight,
  Clock3,
  MonitorCheck,
  Palette,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Star,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDate } from '@dwp-frontend/shared-i18n';
import {
  getAuthSessions,
  getPersonalSettingsWorkspace,
  updatePersonalSettingFavorite,
  type PersonalSettingKey,
} from '@dwp-frontend/shared-utils';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { FormField, InlineFeedback, PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';

import { getAccountNavigationGroups } from '../../features/account/settings-navigation';
import { filterSettingsDocuments } from '../../components/settings-search';
import { usePersonalPreference } from '../../providers/personal-preference-provider';

type StatusCardProps = {
  icon: typeof ShieldCheck;
  title: string;
  value: string;
  detail: string;
  state?: 'success' | 'warning' | 'default';
};

function StatusCard({ icon: Icon, title, value, detail, state = 'default' }: StatusCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2, minWidth: 0 }}>
      <Stack direction="row" alignItems="flex-start" gap={1.5}>
        <Box
          aria-hidden="true"
          sx={{
            width: 36,
            height: 36,
            flex: '0 0 36px',
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1,
            bgcolor: 'action.hover',
            color: 'text.secondary',
          }}
        >
          <Icon size={18} strokeWidth={1.8} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography component="h3" variant="subtitle2">
            {title}
          </Typography>
          <Chip
            size="small"
            variant="outlined"
            color={state}
            label={value}
            sx={{ mt: 0.75, maxWidth: 1 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
            {detail}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export default function SettingsHomePage() {
  const { t } = useTranslation('account');
  const auth = useAuth();
  const providerAccount = isProviderIdentity(auth.user);
  const personalPreference = usePersonalPreference();
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: async () => {
      const response = await getAuthSessions();
      return Array.isArray(response.data) ? response.data : [];
    },
    retry: false,
  });
  const [query, setQuery] = useState('');
  const ownerQueryKey = ['personal-settings', 'workspace'] as const;
  const ownerQuery = useQuery({
    queryKey: ownerQueryKey,
    queryFn: getPersonalSettingsWorkspace,
    enabled: !providerAccount,
    retry: false,
  });
  const favoriteMutation = useMutation({
    mutationFn: ({
      settingKey,
      favorite,
      version,
    }: {
      settingKey: PersonalSettingKey;
      favorite: boolean;
      version: number;
    }) => updatePersonalSettingFavorite(settingKey, favorite, version),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ownerQueryKey }),
  });
  const groups = getAccountNavigationGroups(providerAccount);
  const preference = personalPreference.preference;
  const managedRuleCount = preference?.managedPolicy?.rules.length;

  const visiblePaths = useMemo(() => {
    const documents = groups.flatMap((group) =>
      group.items.map((item) => ({
        value: item.path,
        fields: [
          t(`shell.groups.${group.key}`),
          t(`navigation.${item.key}`),
          t(`settingsHome.items.${item.key}`),
          t(`settingsHome.keywords.${item.key}`),
        ],
      }))
    );
    return new Set(filterSettingsDocuments(documents, query));
  }, [groups, query, t]);

  const visibleCount = groups.reduce(
    (count, group) => count + group.items.filter((item) => visiblePaths.has(item.path)).length,
    0
  );

  return (
    <PageCanvas mode="focus">
      <Stack gap={3}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          gap={1.5}
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
                  {t(
                    providerAccount
                      ? 'settingsHome.providerDescription'
                      : 'settingsHome.description'
                  )}
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

        {providerAccount && (
          <InlineFeedback severity="info">{t('settingsHome.providerBoundary')}</InlineFeedback>
        )}

        <Box component="section" aria-labelledby="settings-current-state">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            justifyContent="space-between"
            gap={1}
          >
            <Box>
              <Typography id="settings-current-state" component="h2" variant="h6">
                {t('settingsHome.status.title')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {t('settingsHome.status.description')}
              </Typography>
            </Box>
            {preference?.updatedAt && (
              <Chip
                size="small"
                variant="outlined"
                label={t('settingsHome.status.preferenceUpdated', {
                  date: formatDate(preference.updatedAt, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })}
              />
            )}
          </Stack>
          <Box
            data-testid="settings-status-summary"
            sx={{
              mt: 1.25,
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                sm: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(4, minmax(0, 1fr))',
              },
              gap: 1.25,
            }}
          >
            <StatusCard
              icon={ShieldCheck}
              title={t('settingsHome.status.identity.title')}
              value={
                auth.user?.displayName?.trim() || t('settingsHome.status.identity.unavailable')
              }
              detail={
                providerAccount
                  ? t('settingsHome.status.identity.provider')
                  : auth.user?.tenantName ||
                    auth.user?.tenantCode ||
                    t('settingsHome.status.identity.unavailable')
              }
              state={auth.user ? 'success' : 'warning'}
            />
            <StatusCard
              icon={MonitorCheck}
              title={t('settingsHome.status.sessions.title')}
              value={
                sessionsQuery.isError
                  ? t('settingsHome.status.unavailable')
                  : sessionsQuery.isPending
                    ? t('settingsHome.status.loading')
                    : t('settingsHome.status.sessions.count', {
                        count: sessionsQuery.data.length,
                      })
              }
              detail={
                sessionsQuery.isError
                  ? t('settingsHome.status.sessions.error')
                  : t('settingsHome.status.sessions.description')
              }
              state={sessionsQuery.isError ? 'warning' : 'success'}
            />
            <StatusCard
              icon={Palette}
              title={t('settingsHome.status.experience.title')}
              value={
                personalPreference.loadFailed
                  ? t('settingsHome.status.unavailable')
                  : personalPreference.isLoading || !preference
                    ? t('settingsHome.status.loading')
                    : t('settingsHome.status.experience.value', {
                        mode: t(`options.colorMode.${preference.preferences.appearance.mode}`),
                        density: t(`options.density.${preference.preferences.appearance.density}`),
                      })
              }
              detail={t('settingsHome.status.experience.description')}
              state={personalPreference.loadFailed ? 'warning' : 'default'}
            />
            <StatusCard
              icon={SlidersHorizontal}
              title={t('settingsHome.status.managed.title')}
              value={
                providerAccount
                  ? t('settingsHome.status.managed.providerLocal')
                  : personalPreference.loadFailed
                    ? t('settingsHome.status.unavailable')
                    : typeof managedRuleCount === 'number'
                      ? t('settingsHome.status.managed.count', { count: managedRuleCount })
                      : t('settingsHome.status.loading')
              }
              detail={
                providerAccount
                  ? t('settingsHome.status.managed.providerDescription')
                  : t('settingsHome.status.managed.description')
              }
              state={personalPreference.loadFailed ? 'warning' : 'default'}
            />
          </Box>
        </Box>

        <Box
          component="section"
          data-testid="settings-owner-boundaries"
          aria-label={t('settingsHome.observations.label')}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
            gap: 1.25,
          }}
        >
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <ShieldAlert size={19} aria-hidden="true" />
              <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
                {t('settingsHome.observations.security.title')}
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ mt: 1 }}>
              {!sessionsQuery.isPending && !sessionsQuery.isError && sessionsQuery.data.length > 1
                ? t('settingsHome.observations.security.sessionReview', {
                    count: sessionsQuery.data.length - 1,
                  })
                : t('settingsHome.observations.security.unavailable')}
            </Typography>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mt: 0.75 }}
            >
              {t('settingsHome.observations.security.boundary')}
            </Typography>
            <ButtonBase
              component={NavLink}
              to="/account/security"
              sx={{ mt: 1.25, color: 'primary.main', fontWeight: 700, borderRadius: 1 }}
            >
              {t('settingsHome.observations.security.open')}
            </ButtonBase>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" gap={1}>
              <Clock3 size={19} aria-hidden="true" />
              <Typography component="h2" variant="subtitle1" fontWeight="fontWeightBold">
                {t('settingsHome.observations.recent.title')}
              </Typography>
            </Stack>
            {ownerQuery.isPending ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('settingsHome.observations.recent.loading')}
              </Typography>
            ) : ownerQuery.isError ? (
              <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                {t('settingsHome.observations.recent.loadError')}
              </Typography>
            ) : ownerQuery.data.recentActivity.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {t('settingsHome.observations.recent.empty')}
              </Typography>
            ) : (
              <Stack component="ol" gap={0.75} sx={{ mt: 1, p: 0, mb: 0, listStyle: 'none' }}>
                {ownerQuery.data.recentActivity.slice(0, 4).map((activity) => (
                  <Box component="li" key={activity.activityId}>
                    <Typography variant="body2" fontWeight={650}>
                      {t(`navigation.${activity.settingKey}`)} ·{' '}
                      {t(`settingsHome.observations.recent.types.${activity.activityType}`)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(activity.occurredAt, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </Typography>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        </Box>

        <FormField
          fullWidth
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          label={t('settingsHome.searchLabel')}
          placeholder={t('settingsHome.searchPlaceholder')}
          slotProps={{
            htmlInput: { 'aria-describedby': 'account-settings-search-help' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={18} aria-hidden="true" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Typography id="account-settings-search-help" variant="caption" color="text.secondary">
          {t('settingsHome.searchHelp')}
        </Typography>

        {favoriteMutation.isError && (
          <InlineFeedback severity="error">{t('settingsHome.favorites.saveError')}</InlineFeedback>
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
              <Box component="section" key={group.key} aria-labelledby={`settings-${group.key}`}>
                <Typography id={`settings-${group.key}`} component="h2" variant="h6">
                  {t(`shell.groups.${group.key}`)}
                </Typography>
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
                    const favorite = ownerQuery.data?.favorites.find(
                      (entry) => entry.settingKey === item.key
                    );
                    const isFavorite = Boolean(favorite?.favorite);
                    return (
                      <Paper
                        key={item.path}
                        variant="outlined"
                        sx={{ overflow: 'hidden', position: 'relative' }}
                      >
                        <ButtonBase
                          component={NavLink}
                          to={item.path}
                          sx={{
                            width: 1,
                            minHeight: 96,
                            p: 2,
                            pr: providerAccount ? 2 : 6,
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
                              {t(`navigation.${item.key}`)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                              {t(`settingsHome.items.${item.key}`)}
                            </Typography>
                          </Box>
                          <ArrowRight size={18} aria-hidden="true" />
                        </ButtonBase>
                        {!providerAccount && (
                          <Tooltip
                            title={t(
                              isFavorite
                                ? 'settingsHome.favorites.remove'
                                : 'settingsHome.favorites.add'
                            )}
                          >
                            <span style={{ position: 'absolute', top: 8, right: 8 }}>
                              <IconButton
                                size="small"
                                aria-label={t(
                                  isFavorite
                                    ? 'settingsHome.favorites.removeNamed'
                                    : 'settingsHome.favorites.addNamed',
                                  { name: t(`navigation.${item.key}`) }
                                )}
                                disabled={ownerQuery.isError || favoriteMutation.isPending}
                                onClick={() =>
                                  favoriteMutation.mutate({
                                    settingKey: item.key as PersonalSettingKey,
                                    favorite: !isFavorite,
                                    version: favorite?.version ?? 0,
                                  })
                                }
                                color={isFavorite ? 'primary' : 'default'}
                              >
                                <Star
                                  size={17}
                                  fill={isFavorite ? 'currentColor' : 'none'}
                                  aria-hidden="true"
                                />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
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
