import { ArrowRight, Search, Settings2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { FormField, InlineFeedback, PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { getAccountNavigationGroups } from '../../features/account/settings-navigation';
import { filterSettingsDocuments } from '../../components/settings-search';

export default function SettingsHomePage() {
  const { t } = useTranslation('account');
  const auth = useAuth();
  const providerAccount = isProviderIdentity(auth.user);
  const [query, setQuery] = useState('');
  const groups = getAccountNavigationGroups(providerAccount);

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
                    return (
                      <Paper key={item.path} variant="outlined" sx={{ overflow: 'hidden' }}>
                        <ButtonBase
                          component={NavLink}
                          to={item.path}
                          sx={{
                            width: 1,
                            minHeight: 96,
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
                              {t(`navigation.${item.key}`)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                              {t(`settingsHome.items.${item.key}`)}
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
