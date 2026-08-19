import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@dwp-frontend/shared-utils';

import { MailAccounts } from '../features/mail/mail-accounts';
import {
  MailAdminConnections,
  MailAdminOverview,
  MailAdminPolicies,
  MailAdminSharedInboxes,
} from '../features/mail/mail-admin';
import { MailHome } from '../features/mail/mail-home';
import { MailInbox } from '../features/mail/mail-inbox';
import { findMailNavigationItem, MAIL_DEFAULT_PATH } from '../features/mail/mail-navigation';

export default function MailPage() {
  const { pathname } = useLocation();
  const { hasPermission } = usePermissions();
  const page = findMailNavigationItem(pathname);

  if (!page) return <Navigate to={MAIL_DEFAULT_PATH} replace />;
  if (
    page.requiredResourceKey &&
    !hasPermission(page.requiredResourceKey, page.requiredPermissionCode)
  ) {
    return <Navigate to={MAIL_DEFAULT_PATH} replace />;
  }

  return {
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
  }[page.view];
}
