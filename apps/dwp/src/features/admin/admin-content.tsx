import {
  lazy,
  Suspense,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from 'react';

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
  'service-catalog': lazy(() =>
    import('./service-catalog-manager').then((module) => ({
      default: module.ServiceCatalogManager,
    }))
  ),
  'service-operations': lazy(() =>
    import('./service-operations-manager').then((module) => ({
      default: module.ServiceOperationsManager,
    }))
  ),
  'space-overview': lazy(() =>
    import('./space-admin-page').then((module) => ({
      default: module.SpaceAdminOverview,
    }))
  ),
  'space-directory': lazy(() =>
    import('./space-admin-page').then((module) => ({
      default: module.SpaceAdminDirectory,
    }))
  ),
  'space-requests': lazy(() =>
    import('./space-admin-page').then((module) => ({
      default: module.SpaceAdminRequests,
    }))
  ),
  'space-templates': lazy(() =>
    import('./space-admin-page').then((module) => ({
      default: module.SpaceAdminTemplates,
    }))
  ),
  'space-content-reviews': lazy(() =>
    import('./space-admin-page').then((module) => ({
      default: module.SpaceAdminContentReviews,
    }))
  ),
  'space-lifecycle': lazy(() =>
    import('./space-admin-page').then((module) => ({
      default: module.SpaceAdminLifecycle,
    }))
  ),
  'space-operations': lazy(() =>
    import('./space-operations-page').then((module) => ({
      default: module.SpaceAdminOperations,
    }))
  ),
  announcements: lazy(() =>
    import('./announcement-manager').then((module) => ({ default: module.AnnouncementManager }))
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

export function AdminContent({ view, fallback }: { view: AdminView; fallback: ReactNode }) {
  const Content = ADMIN_CONTENT[view];
  return (
    <Suspense fallback={fallback}>
      <Content />
    </Suspense>
  );
}
