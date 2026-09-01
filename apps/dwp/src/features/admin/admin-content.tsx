import {
  Component,
  lazy,
  Suspense,
  type ComponentType,
  type ErrorInfo,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { LocalErrorState } from '@dwp-frontend/design-system/components/states/state-panels';

import Box from '@mui/material/Box';

import type { AdminView } from './admin-navigation';

type AdminComponent = LazyExoticComponent<ComponentType>;

const ADMIN_CONTENT: Record<AdminView, AdminComponent> = {
  access: lazy(() =>
    import('./access-manager').then((module) => ({ default: module.AccessManager }))
  ),
  'app-access-requests': lazy(() =>
    import('./app-access-request-manager').then((module) => ({
      default: module.AppAccessRequestManager,
    }))
  ),
  'app-governance': lazy(() =>
    import('./app-governance-manager').then((module) => ({ default: module.AppGovernanceManager }))
  ),
  'access-reviews': lazy(() =>
    import('./access-review-manager').then((module) => ({ default: module.AccessReviewManager }))
  ),
  roles: lazy(() =>
    import('./role-governance-manager').then((module) => ({
      default: module.RoleGovernanceManager,
    }))
  ),
  'workforce-access': lazy(() =>
    import('./workforce-access-manager').then((module) => ({
      default: module.WorkforceAccessManager,
    }))
  ),
  'saved-view-custody': lazy(() =>
    import('./saved-view-custody-manager').then((module) => ({
      default: module.SavedViewCustodyManager,
    }))
  ),
  provisioning: lazy(() =>
    import('./identity-provisioning-manager').then((module) => ({
      default: module.IdentityProvisioningManager,
    }))
  ),
  'preference-exceptions': lazy(() =>
    import('./preference-exception-manager').then((module) => ({
      default: module.PreferenceExceptionManager,
    }))
  ),
  localization: lazy(() =>
    import('./localization-studio').then((module) => ({ default: module.LocalizationStudio }))
  ),
  branding: lazy(() =>
    import('./tenant-branding-manager').then((module) => ({
      default: module.TenantBrandingManager,
    }))
  ),
  'home-experience': lazy(() =>
    import('./home-experience-manager').then((module) => ({
      default: module.HomeExperienceManager,
    }))
  ),
  'home-composition': lazy(() =>
    import('./home-composition-manager').then((module) => ({
      default: module.HomeCompositionManager,
    }))
  ),
  'home-apps': lazy(() =>
    import('./home-app-layout-manager').then((module) => ({ default: module.HomeAppLayoutManager }))
  ),
  'reference-data': lazy(() =>
    import('./reference-data-manager').then((module) => ({ default: module.ReferenceDataManager }))
  ),
  catalog: lazy(() =>
    import('./catalog-explorer').then((module) => ({ default: module.CatalogExplorer }))
  ),
  registry: lazy(() =>
    import('./registry-manager').then((module) => ({ default: module.RegistryManager }))
  ),
  navigation: lazy(() =>
    import('./navigation-studio-manager').then((module) => ({ default: module.NavigationManager }))
  ),
  productivity: lazy(() =>
    import('./productivity-connector-manager').then((module) => ({
      default: module.ProductivityConnectorManager,
    }))
  ),
  audit: lazy(() => import('./audit-log').then((module) => ({ default: module.AuditLog }))),
  'audit-overview': lazy(() =>
    import('./audit-overview').then((module) => ({ default: module.AuditOverview }))
  ),
  'audit-events': lazy(() =>
    import('./audit-evidence-workspace').then((module) => ({
      default: module.AuditEvidenceWorkspace,
    }))
  ),
  'audit-investigations': lazy(() =>
    import('./audit-investigations').then((module) => ({ default: module.AuditInvestigations }))
  ),
  'audit-governance': lazy(() =>
    import('./audit-governance').then((module) => ({ default: module.AuditGovernance }))
  ),
  'api-monitoring': lazy(() =>
    import('./api-monitoring').then((module) => ({ default: module.ApiMonitoring }))
  ),
};

class AdminContentErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Keep the administration shell available. A page reload is the reliable retry for a
    // rejected dynamic import because the browser may cache the failed module request.
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function AdminContentLoadError() {
  const { t } = useTranslation('admin');
  return (
    <Box data-testid="admin-content-load-error">
      <LocalErrorState
        title={t('contentLoadError.title')}
        description={t('contentLoadError.description')}
        retryLabel={t('contentLoadError.reloadPage')}
        onRetry={() => window.location.reload()}
        size="page"
      />
    </Box>
  );
}

export function AdminContent({ view, fallback }: { view: AdminView; fallback: ReactNode }) {
  const Content = ADMIN_CONTENT[view];
  return (
    <AdminContentErrorBoundary key={view} fallback={<AdminContentLoadError />}>
      <Suspense fallback={fallback}>
        <Content />
      </Suspense>
    </AdminContentErrorBoundary>
  );
}
