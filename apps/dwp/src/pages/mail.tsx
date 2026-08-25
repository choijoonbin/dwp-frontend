import { useLocation } from 'react-router-dom';

import { MailAccounts } from '../features/mail/mail-accounts';
import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import {
  MailAdminConnections,
  MailAdminOverview,
  MailAdminPolicies,
  MailAdminSharedInboxes,
} from '../features/mail/mail-admin';
import { MailHome } from '../features/mail/mail-home';
import { MailInbox } from '../features/mail/mail-inbox';
import { findMailNavigationItem } from '../features/mail/mail-navigation';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';

export default function MailPage() {
  const { pathname } = useLocation();
  const page = findMailNavigationItem(pathname);

  if (!page) return <ProductSurfaceLocalNotFound />;

  return (
    <ProductAreaNavigationItemAccessGuard item={page}>
      {
        {
          home: <MailHome />,
          inbox: <MailInbox mode="inbox" />,
          sent: <MailInbox mode="sent" />,
          drafts: <MailInbox mode="drafts" />,
          shared: <MailInbox mode="shared" />,
          accounts: <MailAccounts />,
          'admin-overview': <MailAdminOverview />,
          'admin-connections': <MailAdminConnections />,
          'admin-shared-inboxes': <MailAdminSharedInboxes />,
          'admin-policies': <MailAdminPolicies />,
        }[page.view]
      }
    </ProductAreaNavigationItemAccessGuard>
  );
}
