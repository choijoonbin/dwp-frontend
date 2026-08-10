import { Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@dwp-frontend/shared-utils';
import { PageCanvas } from '@dwp-frontend/design-system';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { AuditLog } from '../features/admin/audit-log';
import { AccessManager } from '../features/admin/access-manager';
import { AnnouncementManager } from '../features/admin/announcement-manager';
import { DirectoryManager } from '../features/admin/directory-manager';
import { HomeExperienceManager } from '../features/admin/home-experience-manager';
import { RegistryManager } from '../features/admin/registry-manager';
import { ReferenceDataManager } from '../features/admin/reference-data-manager';
import { TenantBrandingManager } from '../features/admin/tenant-branding-manager';
import {
  ADMIN_NAVIGATION,
  findAdminNavigationItem,
  type AdminView,
} from '../features/admin/admin-navigation';

function AdminContent({ view }: { view: AdminView }) {
  switch (view) {
    case 'access':
      return <AccessManager />;
    case 'announcements':
      return <AnnouncementManager />;
    case 'branding':
      return <TenantBrandingManager />;
    case 'directory':
      return <DirectoryManager />;
    case 'home-experience':
      return <HomeExperienceManager />;
    case 'reference-data':
      return <ReferenceDataManager />;
    case 'registry':
      return <RegistryManager />;
    case 'audit':
      return <AuditLog />;
  }
}

export default function AdminPage() {
  const { t } = useTranslation('admin');
  const auth = useAuth();
  const { section, view } = useParams();
  const page = findAdminNavigationItem(section, view);

  if (!page) return <Navigate to="/404" replace />;

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
            tenant: auth.user?.tenantCode || t('shell.tenantFallback'),
          })}
          color="info"
          variant="outlined"
          size="small"
        />
      </Stack>

      <AdminContent view={page.view} />
    </PageCanvas>
  );
}
