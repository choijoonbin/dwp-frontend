import { useLocation } from 'react-router-dom';

import {
  MessagingAdminOverview,
  MessagingAdminPolicy,
} from '../features/messaging/messaging-admin';
import { MessagingActivity } from '../features/messaging/messaging-activity';
import { ProductSurfaceLocalNotFound } from '../components/product-surface-local-not-found';
import { MessagingConversationWorkspace } from '../features/messaging/messaging-conversation-workspace';
import { MessagingFiles } from '../features/messaging/messaging-files';
import { MessagingHome } from '../features/messaging/messaging-home';
import { MessagingPeople } from '../features/messaging/messaging-people';
import { MessagingSavedItems } from '../features/messaging/messaging-saved-items';
import { MessagingSettings } from '../features/messaging/messaging-settings';
import { MessagingThreads } from '../features/messaging/messaging-threads';
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
          activity: <MessagingActivity />,
          threads: <MessagingThreads />,
          spaces: <MessagingConversationWorkspace scope="SPACES" />,
          direct: <MessagingConversationWorkspace scope="DIRECT" />,
          people: <MessagingPeople />,
          files: <MessagingFiles />,
          later: <MessagingSavedItems />,
          settings: <MessagingSettings />,
          'admin-overview': <MessagingAdminOverview />,
          'admin-policy': <MessagingAdminPolicy />,
        }[page.view]
      }
    </ProductAreaNavigationItemAccessGuard>
  );
}
