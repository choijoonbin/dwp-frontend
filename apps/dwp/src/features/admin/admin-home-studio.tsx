import { useTranslation } from 'react-i18next';
import { NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import {
  AppWindow,
  FileStack,
  History,
  LayoutGrid,
  LibraryBig,
  LockKeyhole,
  Palette,
  ScrollText,
} from 'lucide-react';
import { InlineFeedback, PageCanvas } from '@dwp-frontend/design-system';
import { usePermissions } from '@dwp-frontend/shared-utils';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';

import { HomeStudioAuditPanel } from './admin-home-studio-audit-panel';
import { HomeStudioReleasePanel } from './admin-home-studio-release-panel';
import { HomeAppLayoutManager } from './home-app-layout-manager';
import { HomeCompositionPolicyPanel } from './home-composition-manager';
import { HomeExperienceManager } from './home-experience-manager';
import { TenantHomeBlueprintPanel, TenantWidgetCatalogPanel } from './home-widget-manager';

export const ADMIN_HOME_STUDIO_SECTIONS = [
  'modes',
  'app-dock',
  'widgets',
  'templates',
  'content',
  'releases',
  'audit',
] as const;

export type AdminHomeStudioSection = (typeof ADMIN_HOME_STUDIO_SECTIONS)[number];

const sectionIcons = {
  modes: LayoutGrid,
  'app-dock': AppWindow,
  widgets: LibraryBig,
  templates: FileStack,
  content: Palette,
  releases: History,
  audit: ScrollText,
} as const;

export function isAdminHomeStudioSection(
  value: string | undefined
): value is AdminHomeStudioSection {
  return ADMIN_HOME_STUDIO_SECTIONS.includes(value as AdminHomeStudioSection);
}

function AdminHomeStudioContent({ section }: { section: AdminHomeStudioSection }) {
  const { t } = useTranslation('admin');
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  if (section === 'modes') return <HomeCompositionPolicyPanel />;
  if (section === 'app-dock') return <HomeAppLayoutManager />;
  if (section === 'widgets') {
    if (!hasPermission('ADMIN.HOME_WIDGET_POLICY', 'VIEW')) {
      return (
        <InlineFeedback severity="warning" title={t('homeStudio.sectionAccess.widgetsTitle')}>
          {t('homeStudio.sectionAccess.widgetsDescription')}
        </InlineFeedback>
      );
    }
    return (
      <TenantWidgetCatalogPanel onOpenPolicy={() => navigate('/admin/experience/home/modes')} />
    );
  }
  if (section === 'templates') return <TenantHomeBlueprintPanel />;
  if (section === 'content') return <HomeExperienceManager />;
  if (section === 'releases') return <HomeStudioReleasePanel />;
  return <HomeStudioAuditPanel />;
}

export default function AdminHomeStudio() {
  const { t } = useTranslation('admin');
  const { hasPermission } = usePermissions();
  const { studioSection } = useParams();
  if (!isAdminHomeStudioSection(studioSection)) {
    return <Navigate to="/admin/experience/home/modes" replace />;
  }

  return (
    <PageCanvas>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        alignItems={{ xs: 'flex-start', md: 'center' }}
        justifyContent="space-between"
        gap={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography component="p" variant="overline" color="primary.main">
            {t('homeStudio.eyebrow')}
          </Typography>
          <Typography component="h1" variant="h4">
            {t('homeStudio.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
            {t('homeStudio.description')}
          </Typography>
        </Box>
        <Chip size="small" color="warning" variant="outlined" label={t('homeStudio.shadow')} />
      </Stack>

      <Box data-testid="admin-home-studio" data-registry-authoritative="false">
        {!hasPermission('ADMIN.HOME_EXPERIENCE', 'MANAGE') && (
          <InlineFeedback
            severity="info"
            icon={<LockKeyhole size={18} />}
            title={t('homeStudio.readOnly.title')}
            sx={{ mb: 2 }}
          >
            {t('homeStudio.readOnly.description')}
          </InlineFeedback>
        )}
        <Tabs
          value={studioSection}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label={t('homeStudio.navigationLabel')}
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          {ADMIN_HOME_STUDIO_SECTIONS.map((section) => {
            const Icon = sectionIcons[section];
            return (
              <Tab
                key={section}
                component={NavLink}
                to={`/admin/experience/home/${section}`}
                value={section}
                icon={<Icon size={17} aria-hidden="true" />}
                iconPosition="start"
                label={t(`homeStudio.sections.${section}`)}
              />
            );
          })}
        </Tabs>
        <Box role="tabpanel" aria-label={t(`homeStudio.sections.${studioSection}`)}>
          <AdminHomeStudioContent section={studioSection} />
        </Box>
      </Box>
    </PageCanvas>
  );
}
