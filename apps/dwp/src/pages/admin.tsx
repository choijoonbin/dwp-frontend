import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth, usePermissions } from '@dwp-frontend/shared-utils';
import { hasProviderControlPlaneRole } from '@dwp-frontend/shared-utils/auth/control-plane-access';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { ADMIN_NAVIGATION, findAdminNavigationItem } from '../features/admin/admin-navigation';
import { AdminContent } from '../features/admin/admin-content';
import { canAccessAdminNavigationItem } from '../features/admin/admin-access-policy';
import { RouteFallback } from '../routes/route-support';
import { useProviderSupportContext } from '@dwp-frontend/shared-utils/auth/provider-support-context';

export default function AdminPage() {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const { hasPermission, isLoaded: permissionsLoaded } = usePermissions();
  const supportContext = useProviderSupportContext(
    hasProviderControlPlaneRole(auth.user?.roles ?? [])
  );
  const { section, view } = useParams();
  const page = findAdminNavigationItem(section, view);

  if (!page) return <Navigate to="/404" replace />;
  if (
    !canAccessAdminNavigationItem(page, {
      roles: auth.user?.roles ?? [],
      permissionsLoaded,
      hasPermission,
      supportScopes: supportContext.data?.scopes,
      resourceRoles: auth.user?.resourceRoles,
    })
  ) {
    return <Navigate to="/403" replace />;
  }

  const PageIcon = page.icon;
  const groupLabel =
    ADMIN_NAVIGATION.find((group) => group.id === page.section)?.id ?? 'governance';

  return (
    <PageCanvas>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        gap={2}
        sx={{ mb: 3 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography component="p" variant="overline" color="primary.main">
            {t('page.breadcrumb', {
              group: t(`navigation.groups.${groupLabel}`),
            })}
          </Typography>
          <Box sx={{ mt: 0.25, display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
            <Box
              aria-hidden="true"
              sx={{
                width: 36,
                height: 36,
                display: 'grid',
                flex: '0 0 36px',
                placeItems: 'center',
                color: 'primary.main',
                bgcolor: 'action.selected',
                borderRadius: 1,
              }}
            >
              <PageIcon size={19} strokeWidth={1.8} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography component="h1" variant="h4">
                {t(`navigation.items.${page.view}.title`)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                {t(`navigation.items.${page.view}.description`)}
              </Typography>
            </Box>
          </Box>
        </Box>
        <Chip
          label={t('page.tenantScope', {
            tenant:
              supportContext.data?.tenantName ||
              auth.user?.tenantName ||
              auth.user?.tenantCode ||
              t('shell.tenantFallback'),
          })}
          color="info"
          variant="outlined"
          size="small"
        />
      </Stack>

      <AdminContent view={page.view} fallback={<RouteFallback />} />
    </PageCanvas>
  );
}
