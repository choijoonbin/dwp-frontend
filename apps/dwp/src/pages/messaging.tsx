import { useLocation } from 'react-router-dom';

import {
  MessagingAdminOverview,
  MessagingAdminPolicy,
} from '../features/messaging/messaging-admin';
import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import { MessagingConversationWorkspace } from '../features/messaging/messaging-conversation-workspace';
import { MessagingHome } from '../features/messaging/messaging-home';
import { MessagingPeople } from '../features/messaging/messaging-people';
import { MessagingSavedItems } from '../features/messaging/messaging-saved-items';
import { findMessagingNavigationItem } from '../features/messaging/messaging-navigation';
import { ProductAreaNavigationItemAccessGuard } from '../layouts/product-area-navigation-access-guard';

export default function MessagingPage() {
  const { pathname } = useLocation();
  const page = findMessagingNavigationItem(pathname);

  if (!page) return <ProductSurfaceLocalNotFound />;

  return (
    <ProductAreaNavigationItemAccessGuard item={page}>
      {
        {
          home: <MessagingHome />,
          inbox: <MessagingConversationWorkspace scope="ALL" />,
          spaces: <MessagingConversationWorkspace scope="SPACES" />,
          direct: <MessagingConversationWorkspace scope="DIRECT" />,
          people: <MessagingPeople />,
          later: <MessagingSavedItems />,
          'admin-overview': <MessagingAdminOverview />,
          'admin-policy': <MessagingAdminPolicy />,
        }[page.view]
      }
    </ProductAreaNavigationItemAccessGuard>
  );
}
