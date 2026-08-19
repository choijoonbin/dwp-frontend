import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@dwp-frontend/shared-utils';

import {
  MessagingAdminOverview,
  MessagingAdminPolicy,
} from '../features/messaging/messaging-admin';
import { MessagingConversationWorkspace } from '../features/messaging/messaging-conversation-workspace';
import { MessagingHome } from '../features/messaging/messaging-home';
import { MessagingPeople } from '../features/messaging/messaging-people';
import { MessagingSavedItems } from '../features/messaging/messaging-saved-items';
import {
  findMessagingNavigationItem,
  MESSAGING_DEFAULT_PATH,
} from '../features/messaging/messaging-navigation';

export default function MessagingPage() {
  const { pathname } = useLocation();
  const { hasPermission } = usePermissions();
  const page = findMessagingNavigationItem(pathname);

  if (!page) return <Navigate to={MESSAGING_DEFAULT_PATH} replace />;
  if (
    page.requiredResourceKey &&
    !hasPermission(page.requiredResourceKey, page.requiredPermissionCode)
  ) {
    return <Navigate to={MESSAGING_DEFAULT_PATH} replace />;
  }

  return {
    home: <MessagingHome />,
    inbox: <MessagingConversationWorkspace scope="ALL" />,
    spaces: <MessagingConversationWorkspace scope="SPACES" />,
    direct: <MessagingConversationWorkspace scope="DIRECT" />,
    people: <MessagingPeople />,
    later: <MessagingSavedItems />,
    'admin-overview': <MessagingAdminOverview />,
    'admin-policy': <MessagingAdminPolicy />,
  }[page.view];
}
