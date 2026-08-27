import {
  Archive,
  Cable,
  CircleGauge,
  FilePenLine,
  FolderTree,
  House,
  Inbox,
  ListFilter,
  MailCheck,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UsersRound,
} from 'lucide-react';

import type { ProductNavigationItem } from '../../components/product-manifest';

export type MailSection = 'start' | 'mailbox' | 'collaboration' | 'settings' | 'admin';
export type MailView =
  | 'home'
  | 'inbox'
  | 'sent'
  | 'drafts'
  | 'archive'
  | 'spam'
  | 'trash'
  | 'folders'
  | 'shared'
  | 'accounts'
  | 'organization'
  | 'admin-overview'
  | 'admin-connections'
  | 'admin-shared-inboxes'
  | 'admin-policies';

export type MailNavigationItem = ProductNavigationItem & {
  section: MailSection;
  view: MailView;
};

export type MailNavigationGroup = {
  id: MailSection;
  items: readonly MailNavigationItem[];
};

export const MAIL_NAVIGATION: readonly MailNavigationGroup[] = [
  {
    id: 'start',
    items: [{ section: 'start', view: 'home', path: '/mail/home', icon: House }],
  },
  {
    id: 'mailbox',
    items: [
      { section: 'mailbox', view: 'inbox', path: '/mail/inbox', icon: Inbox },
      { section: 'mailbox', view: 'sent', path: '/mail/sent', icon: Send },
      { section: 'mailbox', view: 'drafts', path: '/mail/drafts', icon: FilePenLine },
      { section: 'mailbox', view: 'archive', path: '/mail/archive', icon: Archive },
      { section: 'mailbox', view: 'spam', path: '/mail/spam', icon: ShieldAlert },
      { section: 'mailbox', view: 'trash', path: '/mail/trash', icon: Trash2 },
      { section: 'mailbox', view: 'folders', path: '/mail/folders', icon: FolderTree },
    ],
  },
  {
    id: 'collaboration',
    items: [{ section: 'collaboration', view: 'shared', path: '/mail/shared', icon: UsersRound }],
  },
  {
    id: 'settings',
    items: [
      {
        section: 'settings',
        view: 'organization',
        path: '/mail/organization',
        icon: ListFilter,
      },
      { section: 'settings', view: 'accounts', path: '/mail/accounts', icon: MailCheck },
    ],
  },
  {
    id: 'admin',
    items: [
      {
        section: 'admin',
        view: 'admin-overview',
        path: '/mail/admin/overview',
        icon: CircleGauge,
        requiredResourceKey: 'ADMIN.MAIL',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'admin',
        view: 'admin-connections',
        path: '/mail/admin/connections',
        icon: Cable,
        requiredResourceKey: 'ADMIN.MAIL',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'admin',
        view: 'admin-shared-inboxes',
        path: '/mail/admin/shared-inboxes',
        icon: ShieldCheck,
        requiredResourceKey: 'ADMIN.MAIL',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'admin',
        view: 'admin-policies',
        path: '/mail/admin/policies',
        icon: Settings2,
        requiredResourceKey: 'ADMIN.MAIL',
        requiredPermissionCode: 'VIEW',
      },
    ],
  },
];

export const MAIL_DEFAULT_PATH = '/mail/home';

export function findMailNavigationItem(pathname: string): MailNavigationItem | undefined {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname;
  return MAIL_NAVIGATION.flatMap((group) => group.items).find((item) => item.path === normalized);
}
