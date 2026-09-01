import {
  Bookmark,
  CircleGauge,
  Hash,
  House,
  Inbox,
  MessagesSquare,
  Settings2,
  UserRoundSearch,
} from 'lucide-react';

import type { ProductNavigationItem } from '../../components/product-manifest';

export type MessagingSection = 'start' | 'conversations' | 'work' | 'admin';
export type MessagingView =
  'home' | 'inbox' | 'spaces' | 'direct' | 'people' | 'later' | 'admin-overview' | 'admin-policy';

export type MessagingNavigationItem = ProductNavigationItem & {
  section: MessagingSection;
  view: MessagingView;
};

export type MessagingNavigationGroup = {
  id: MessagingSection;
  items: readonly MessagingNavigationItem[];
};

export const MESSAGING_NAVIGATION: readonly MessagingNavigationGroup[] = [
  {
    id: 'start',
    items: [{ section: 'start', view: 'home', path: '/messages/home', icon: House }],
  },
  {
    id: 'conversations',
    items: [
      { section: 'conversations', view: 'inbox', path: '/messages/inbox', icon: Inbox },
      { section: 'conversations', view: 'spaces', path: '/messages/spaces', icon: Hash },
      { section: 'conversations', view: 'direct', path: '/messages/direct', icon: MessagesSquare },
      { section: 'conversations', view: 'people', path: '/messages/people', icon: UserRoundSearch },
    ],
  },
  {
    id: 'work',
    items: [{ section: 'work', view: 'later', path: '/messages/later', icon: Bookmark }],
  },
  {
    id: 'admin',
    items: [
      {
        section: 'admin',
        view: 'admin-overview',
        path: '/messages/admin/overview',
        icon: CircleGauge,
        requiredResourceKey: 'ADMIN.MESSAGING',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'admin',
        view: 'admin-policy',
        path: '/messages/admin/policy',
        icon: Settings2,
        requiredResourceKey: 'ADMIN.MESSAGING',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
];

export function findMessagingNavigationItem(pathname: string): MessagingNavigationItem | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  return MESSAGING_NAVIGATION.flatMap((group) => group.items).find(
    (item) => item.path === normalized
  );
}
