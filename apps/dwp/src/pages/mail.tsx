import { lazy, Suspense } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import { MailLiveInvalidationBridge } from '../features/mail/mail-live-invalidation';
import { findMailNavigationItem } from '../features/mail/mail-navigation';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';
import { RouteFallback } from '../routes/route-support';

const MailAccounts = lazy(() =>
  import('../features/mail/mail-accounts').then((module) => ({ default: module.MailAccounts }))
);
const MailAdminConnections = lazy(() =>
  import('../features/mail/mail-admin').then((module) => ({
    default: module.MailAdminConnections,
  }))
);
const MailAdminSharedInboxes = lazy(() =>
  import('../features/mail/mail-admin').then((module) => ({
    default: module.MailAdminSharedInboxes,
  }))
);
const MailAdminPolicies = lazy(() =>
  import('../features/mail/mail-admin').then((module) => ({
    default: module.MailAdminPolicies,
  }))
);
const MailOperationsAdminWorkspace = lazy(() =>
  import('../features/mail/mail-admin-operations-workspace-surfaces').then((module) => ({
    default: module.MailOperationsAdminWorkspace,
  }))
);
const MailConnectionsAdminWorkspace = lazy(() =>
  import('../features/mail/mail-admin-operations-workspace-surfaces').then((module) => ({
    default: module.MailConnectionsAdminWorkspace,
  }))
);
const MailSharedAccessAdminWorkspace = lazy(() =>
  import('../features/mail/mail-admin-operations-workspace-surfaces').then((module) => ({
    default: module.MailSharedAccessAdminWorkspace,
  }))
);
const MailGovernanceAdminWorkspace = lazy(() =>
  import('../features/mail/mail-admin-operations-workspace-surfaces').then((module) => ({
    default: module.MailGovernanceAdminWorkspace,
  }))
);
const MailRetentionAdminWorkspace = lazy(() =>
  import('../features/mail/mail-admin-operations-workspace-surfaces').then((module) => ({
    default: module.MailRetentionAdminWorkspace,
  }))
);
const MailDeliveryAuditAdminWorkspace = lazy(() =>
  import('../features/mail/mail-admin-operations-workspace-surfaces').then((module) => ({
    default: module.MailDeliveryAuditAdminWorkspace,
  }))
);
const MailHome = lazy(() =>
  import('../features/mail/mail-home').then((module) => ({ default: module.MailHome }))
);
const MailInbox = lazy(() =>
  import('../features/mail/mail-inbox').then((module) => ({ default: module.MailInbox }))
);
const MailAdminWritingAssetsWorkspace = lazy(() =>
  import('../features/mail/mail-admin-writing-assets-workspace').then((module) => ({
    default: module.MailAdminWritingAssetsWorkspace,
  }))
);
const MailAddressBook = lazy(() =>
  import('../features/mail/mail-address-book').then((module) => ({
    default: module.MailAddressBook,
  }))
);
const MailOrganization = lazy(() =>
  import('../features/mail/mail-organization').then((module) => ({
    default: module.MailOrganization,
  }))
);
const MailSecondaryWorkspace = lazy(() =>
  import('../features/mail/mail-secondary-workspace').then((module) => ({
    default: module.MailSecondaryWorkspace,
  }))
);

export default function MailPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const page = findMailNavigationItem(pathname);
  const settingsOpen = searchParams.get('settings') === 'edit';
  const openSettings = () => navigate(`${pathname}?settings=edit`);
  const closeSettings = () => navigate(pathname, { replace: true });

  if (!page) return <ProductSurfaceLocalNotFound />;
  const view = page.view;

  return (
    <ProductAreaNavigationItemAccessGuard item={page}>
      <MailLiveInvalidationBridge />
      <Suspense fallback={<RouteFallback />}>{renderMailView(view)}</Suspense>
    </ProductAreaNavigationItemAccessGuard>
  );

  function renderMailView(currentView: typeof view) {
    switch (currentView) {
      case 'home':
        return <MailHome />;
      case 'inbox':
      case 'sent':
      case 'drafts':
      case 'archive':
      case 'spam':
      case 'trash':
      case 'folders':
      case 'shared':
        return (
          <MailInbox
            mode={
              currentView === 'folders'
                ? 'custom'
                : currentView === 'shared'
                  ? 'shared'
                  : currentView
            }
          />
        );
      case 'search':
      case 'follow-up':
      case 'delivery':
      case 'actions':
      case 'templates':
        return <MailSecondaryWorkspace view={currentView} />;
      case 'contacts':
        return <MailAddressBook />;
      case 'organization':
        return <MailOrganization />;
      case 'accounts':
        return <MailAccounts />;
      case 'admin-overview':
        return <MailOperationsAdminWorkspace />;
      case 'admin-connections':
        return settingsOpen ? (
          <MailAdminConnections onBack={closeSettings} />
        ) : (
          <MailConnectionsAdminWorkspace onOpenConnectionSettings={openSettings} />
        );
      case 'admin-shared-inboxes':
        return settingsOpen ? (
          <MailAdminSharedInboxes onBack={closeSettings} />
        ) : (
          <MailSharedAccessAdminWorkspace onOpenSharedInboxSettings={openSettings} />
        );
      case 'admin-writing-assets':
        return <MailAdminWritingAssetsWorkspace />;
      case 'admin-policies':
        return settingsOpen ? (
          <MailAdminPolicies onBack={closeSettings} />
        ) : (
          <MailGovernanceAdminWorkspace onOpenPolicySettings={openSettings} />
        );
      case 'admin-retention':
        return <MailRetentionAdminWorkspace />;
      case 'admin-delivery-audit':
        return <MailDeliveryAuditAdminWorkspace />;
    }
  }
}
