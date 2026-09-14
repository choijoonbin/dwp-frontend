import { useTranslation } from 'react-i18next';
import {
  CircleStop,
  FileCode2,
  Languages,
  RadioTower,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';

import Box from '@mui/material/Box';
import { foundationTokens } from '@dwp-frontend/design-system/foundation/tokens';

import {
  NotificationAdminOverviewPage,
  NotificationDeliveryOperationsPage,
  NotificationTypeCatalogPage,
} from './notification-admin';
import { NotificationPreferences } from './notification-preferences';
import { NotificationPolicyStudio } from './notification-policy-studio';
import { NotificationTemplateStudio } from './notification-template-studio';
import { NotificationSuppressionStudio } from './notification-suppression-studio';
import { NotificationPageFrame } from './notification-page-frame';
import { NotificationPageHeading } from './notification-ui';

const ADMIN_VIEW_ICONS = {
  overview: ShieldCheck,
  contracts: FileCode2,
  policies: SlidersHorizontal,
  templates: Languages,
  operations: RadioTower,
  suppressions: CircleStop,
} as const;

export function NotificationSettingsPage() {
  return <NotificationPreferences />;
}

function NotificationAdminSurface({
  view,
}: {
  view: 'overview' | 'contracts' | 'policies' | 'templates' | 'operations' | 'suppressions';
}) {
  const { t } = useTranslation('notifications');
  const content = {
    overview: <NotificationAdminOverviewPage />,
    contracts: <NotificationTypeCatalogPage />,
    policies: <NotificationPolicyStudio />,
    templates: <NotificationTemplateStudio />,
    operations: <NotificationDeliveryOperationsPage />,
    suppressions: <NotificationSuppressionStudio />,
  }[view];
  const ViewIcon = ADMIN_VIEW_ICONS[view];
  return (
    <NotificationPageFrame>
      <NotificationPageHeading
        eyebrow={t('admin.product.eyebrow')}
        title={t(`admin.product.${view}.title`)}
        description={t(`admin.product.${view}.description`)}
        icon={<ViewIcon size={19} strokeWidth={1.8} />}
      />
      <Box
        sx={{
          mt: 1.5,
          minWidth: 0,
          '& .MuiChip-root': {
            maxWidth: '100%',
            height: 'auto',
            minHeight: 22,
            borderRadius: foundationTokens.radius.compact + 'px',
          },
          '& .MuiChip-label': {
            py: 0.25,
            px: 0.75,
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            lineHeight: 'caption.lineHeight',
          },
          '& .MuiAlert-message': { minWidth: 0 },
          '& .MuiButton-root': { overflowWrap: 'anywhere' },
        }}
      >
        {content}
      </Box>
    </NotificationPageFrame>
  );
}

export function NotificationAdminOverview() {
  return <NotificationAdminSurface view="overview" />;
}

export function NotificationAdminContracts() {
  return <NotificationAdminSurface view="contracts" />;
}

export function NotificationAdminPolicies() {
  return <NotificationAdminSurface view="policies" />;
}

export function NotificationAdminTemplates() {
  return <NotificationAdminSurface view="templates" />;
}

export function NotificationAdminOperations() {
  return <NotificationAdminSurface view="operations" />;
}

export function NotificationAdminSuppressions() {
  return <NotificationAdminSurface view="suppressions" />;
}
