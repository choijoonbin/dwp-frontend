import {
  BellDot,
  Bookmark,
  CircleGauge,
  Files,
  Hash,
  House,
  Inbox,
  MessagesSquare,
  MessageCircleReply,
  SlidersHorizontal,
  Settings2,
  UserRoundSearch,
} from 'lucide-react';

import type { ProductNavigationItem } from '../../components/product-manifest';

export type MessagingSection = 'start' | 'conversations' | 'work' | 'admin';
export type MessagingView =
  | 'home'
  | 'inbox'
  | 'activity'
  | 'threads'
  | 'spaces'
  | 'direct'
  | 'people'
  | 'files'
  | 'later'
  | 'settings'
  | 'admin-overview'
  | 'admin-policy';

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
      { section: 'conversations', view: 'activity', path: '/messages/activity', icon: BellDot },
      {
        section: 'conversations',
        view: 'threads',
        path: '/messages/threads',
        icon: MessageCircleReply,
      },
      { section: 'conversations', view: 'spaces', path: '/messages/spaces', icon: Hash },
      { section: 'conversations', view: 'direct', path: '/messages/direct', icon: MessagesSquare },
      { section: 'conversations', view: 'people', path: '/messages/people', icon: UserRoundSearch },
      { section: 'conversations', view: 'files', path: '/messages/files', icon: Files },
    ],
  },
  {
    id: 'work',
    items: [
      { section: 'work', view: 'later', path: '/messages/later', icon: Bookmark },
      {
        section: 'work',
        view: 'settings',
        path: '/messages/settings',
        icon: SlidersHorizontal,
      },
    ],
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
