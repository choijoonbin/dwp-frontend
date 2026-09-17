import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { MailAccounts } from '../features/mail/mail-accounts';
import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import {
  MailAdminConnections,
  MailAdminPolicies,
  MailAdminSharedInboxes,
} from '../features/mail/mail-admin';
import {
  MailConnectionsAdminWorkspace,
  MailDeliveryAuditAdminWorkspace,
  MailGovernanceAdminWorkspace,
  MailOperationsAdminWorkspace,
  MailRetentionAdminWorkspace,
  MailSharedAccessAdminWorkspace,
} from '../features/mail/mail-admin-operations-workspace-surfaces';
import { MailHome } from '../features/mail/mail-home';
import { MailInbox } from '../features/mail/mail-inbox';
import { MailAdminWritingAssetsWorkspace } from '../features/mail/mail-admin-writing-assets-workspace';
import { MailAddressBook } from '../features/mail/mail-address-book';
import { MailOrganization } from '../features/mail/mail-organization';
import { findMailNavigationItem } from '../features/mail/mail-navigation';
import { MailSecondaryWorkspace } from '../features/mail/mail-secondary-workspace';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';

export default function MailPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const page = findMailNavigationItem(pathname);
  const settingsOpen = searchParams.get('settings') === 'edit';
  const openSettings = () => navigate(`${pathname}?settings=edit`);
  const closeSettings = () => navigate(pathname, { replace: true });

  if (!page) return <ProductSurfaceLocalNotFound />;

  return (
    <ProductAreaNavigationItemAccessGuard item={page}>
      {
        {
          home: <MailHome />,
          inbox: <MailInbox mode="inbox" />,
          search: <MailSecondaryWorkspace view="search" />,
          'follow-up': <MailSecondaryWorkspace view="follow-up" />,
          delivery: <MailSecondaryWorkspace view="delivery" />,
          sent: <MailInbox mode="sent" />,
          drafts: <MailInbox mode="drafts" />,
          archive: <MailInbox mode="archive" />,
          spam: <MailInbox mode="spam" />,
          trash: <MailInbox mode="trash" />,
          folders: <MailInbox mode="custom" />,
          shared: <MailInbox mode="shared" />,
          contacts: <MailAddressBook />,
          actions: <MailSecondaryWorkspace view="actions" />,
          organization: <MailOrganization />,
          accounts: <MailAccounts />,
          templates: <MailSecondaryWorkspace view="templates" />,
          'admin-overview': <MailOperationsAdminWorkspace />,
          'admin-connections': settingsOpen ? (
            <MailAdminConnections onBack={closeSettings} />
          ) : (
            <MailConnectionsAdminWorkspace onOpenConnectionSettings={openSettings} />
          ),
          'admin-shared-inboxes': settingsOpen ? (
            <MailAdminSharedInboxes onBack={closeSettings} />
          ) : (
            <MailSharedAccessAdminWorkspace onOpenSharedInboxSettings={openSettings} />
          ),
          'admin-writing-assets': <MailAdminWritingAssetsWorkspace />,
          'admin-policies': settingsOpen ? (
            <MailAdminPolicies onBack={closeSettings} />
          ) : (
            <MailGovernanceAdminWorkspace onOpenPolicySettings={openSettings} />
          ),
          'admin-retention': <MailRetentionAdminWorkspace />,
          'admin-delivery-audit': <MailDeliveryAuditAdminWorkspace />,
        }[page.view]
      }
    </ProductAreaNavigationItemAccessGuard>
  );
}
