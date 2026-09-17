import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { BriefcaseBusiness, Building2, Database, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { getMe } from '@dwp-frontend/shared-utils';
import { useAuth } from '@dwp-frontend/shared-utils/auth/auth-provider';
import { isProviderIdentity } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { ActionButton, PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';

import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { ProfileConnectedApps } from './profile-connected-apps';
import { ProfilePrivacyControls } from './profile-privacy-controls';

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function ProfileField({
  icon: Icon,
  label,
  value,
  source,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  source: string;
}) {
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '36px minmax(0, 1fr)', md: '36px 180px minmax(0, 1fr)' },
        gap: 1.5,
        alignItems: 'center',
        px: { xs: 2, md: 2.5 },
        py: 2,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 36,
          height: 36,
          display: 'grid',
          placeItems: 'center',
          bgcolor: 'action.hover',
          color: 'text.secondary',
          borderRadius: 1,
        }}
      >
        <Icon size={18} strokeWidth={1.8} />
      </Box>
      <Box sx={{ gridColumn: { xs: '2', md: 'auto' }, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography
          component="div"
          variant="body2"
          fontWeight={700}
          sx={{ overflowWrap: 'anywhere' }}
        >
          {value || '-'}
        </Typography>
      </Box>
      <Chip
        size="small"
        variant="outlined"
        label={source}
        sx={{ gridColumn: { xs: '2', md: 'auto' }, justifySelf: 'start' }}
      />
    </Box>
  );
}

export default function ProfilePage() {
  const { t } = useTranslation('account');
  const auth = useAuth();
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => (await getMe()).data,
    retry: false,
  });

  const profile = meQuery.data;
  // The authenticated shell identity is available before this owner query resolves. Use it as
  // the plane boundary so a provider session never starts a tenant workspace connection request
  // during the profile-loading frame.
  const providerAccount = isProviderIdentity(profile ?? auth.user);

  return (
    <PageCanvas mode="workspace">
      <Box sx={{ width: 1, maxWidth: 1240, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          <Avatar
            aria-hidden="true"
            sx={{ width: 48, height: 48, bgcolor: 'primary.main', color: 'primary.contrastText' }}
          >
            {initials(profile?.displayName ?? t('shell.accountFallback'))}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography component="h1" variant="h4">
              {t('profile.title')}
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {t(providerAccount ? 'profile.provider.description' : 'profile.description')}
            </Typography>
          </Box>
        </Box>

        {meQuery.isError && (
          <Alert
            severity="error"
            sx={{ mt: 3 }}
            action={
              <ActionButton intent="quiet" size="small" onClick={() => void meQuery.refetch()}>
                {t('profile.retry')}
              </ActionButton>
            }
          >
            {t('profile.loadError')}
          </Alert>
        )}

        <Box component="section" sx={{ mt: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <UserRound size={20} aria-hidden="true" />
            <Typography component="h2" variant="h6">
              {t('profile.identity.title')}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t(
              providerAccount
                ? 'profile.provider.identityDescription'
                : 'profile.identity.description'
            )}
          </Typography>

          {meQuery.isLoading ? (
            <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
              <CircularProgress size={28} aria-label={t('profile.loading')} />
            </Box>
          ) : profile ? (
            <Stack
              divider={<Divider flexItem />}
              sx={{
                mt: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <ProfileField
                icon={UserRound}
                label={t('profile.fields.name')}
                value={profile.displayName}
                source={t(
                  providerAccount ? 'profile.sources.authIdentity' : 'profile.sources.workforce'
                )}
              />
              <ProfileField
                icon={BriefcaseBusiness}
                label={t('profile.fields.department')}
                value={t('profile.valueUnavailable')}
                source={t('profile.sources.notProvided')}
              />
              <ProfileField
                icon={UserRound}
                label={t('profile.fields.employeeId')}
                value={t('profile.valueUnavailable')}
                source={t('profile.sources.notProvided')}
              />
              <ProfileField
                icon={BriefcaseBusiness}
                label={t('profile.fields.jobTitle')}
                value={profile.jobTitle}
                source={t(
                  providerAccount ? 'profile.sources.authIdentity' : 'profile.sources.workforce'
                )}
              />
              <ProfileField
                icon={Mail}
                label={t('profile.fields.email')}
                value={profile.email}
                source={t('profile.sources.identity')}
              />
              {providerAccount ? (
                <ProfileField
                  icon={Building2}
                  label={t('profile.fields.identityRealm')}
                  value={t('profile.provider.identityRealm')}
                  source={t('profile.sources.providerIdentity')}
                />
              ) : (
                <ProfileField
                  icon={Building2}
                  label={t('profile.fields.tenant')}
                  value={profile.tenantName || profile.tenantCode}
                  source={t('profile.sources.tenant')}
                />
              )}
              <ProfileField
                icon={ShieldCheck}
                label={t('profile.fields.roles')}
                value={
                  <Stack direction="row" gap={0.75} flexWrap="wrap">
                    {(profile.roles ?? []).map((role) => (
                      <Chip key={role} size="small" label={role} />
                    ))}
                  </Stack>
                }
                source={t('profile.sources.access')}
              />
            </Stack>
          ) : null}
        </Box>

        <Alert severity="info" icon={<Database size={20} />} sx={{ mt: 3 }}>
          <Typography component="p" variant="subtitle2">
            {t(providerAccount ? 'profile.provider.governanceTitle' : 'profile.governance.title')}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.25 }}>
            {t(
              providerAccount
                ? 'profile.provider.governanceDescription'
                : 'profile.governance.description'
            )}
          </Typography>
        </Alert>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'minmax(0, 1fr)',
              lg: 'minmax(0, 1.45fr) minmax(340px, 0.75fr)',
            },
            gap: { xs: 0, lg: 3 },
            alignItems: 'start',
          }}
        >
          <ProfileConnectedApps enabled={!providerAccount} />
          <ProfilePrivacyControls enabled={!providerAccount} />
        </Box>
      </Box>
    </PageCanvas>
  );
}
