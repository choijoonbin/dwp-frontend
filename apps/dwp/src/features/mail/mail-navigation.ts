import {
  Activity,
  Archive,
  ArchiveX,
  Cable,
  CircleGauge,
  Clock3,
  ContactRound,
  FileText,
  FilePenLine,
  FolderTree,
  House,
  Inbox,
  ListFilter,
  MailCheck,
  Search,
  Send,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UsersRound,
} from 'lucide-react';

import type { ProductNavigationItem } from '../../components/product-manifest';

export type MailSection = 'start' | 'mailbox' | 'collaboration' | 'settings' | 'admin';
export type MailView =
  | 'home'
  | 'inbox'
  | 'search'
  | 'follow-up'
  | 'delivery'
  | 'sent'
  | 'drafts'
  | 'archive'
  | 'spam'
  | 'trash'
  | 'folders'
  | 'shared'
  | 'contacts'
  | 'actions'
  | 'accounts'
  | 'templates'
  | 'organization'
  | 'admin-overview'
  | 'admin-connections'
  | 'admin-shared-inboxes'
  | 'admin-policies'
  | 'admin-retention'
  | 'admin-delivery-audit';

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
      { section: 'mailbox', view: 'follow-up', path: '/mail/follow-up', icon: Clock3 },
      { section: 'mailbox', view: 'search', path: '/mail/search', icon: Search },
      { section: 'mailbox', view: 'sent', path: '/mail/sent', icon: Send },
      { section: 'mailbox', view: 'delivery', path: '/mail/delivery', icon: Activity },
      { section: 'mailbox', view: 'drafts', path: '/mail/drafts', icon: FilePenLine },
      { section: 'mailbox', view: 'archive', path: '/mail/archive', icon: Archive },
      { section: 'mailbox', view: 'spam', path: '/mail/spam', icon: ShieldAlert },
      { section: 'mailbox', view: 'trash', path: '/mail/trash', icon: Trash2 },
      { section: 'mailbox', view: 'folders', path: '/mail/folders', icon: FolderTree },
    ],
  },
  {
    id: 'collaboration',
    items: [
      { section: 'collaboration', view: 'contacts', path: '/mail/contacts', icon: ContactRound },
      { section: 'collaboration', view: 'shared', path: '/mail/shared', icon: UsersRound },
      { section: 'collaboration', view: 'actions', path: '/mail/actions', icon: Sparkles },
    ],
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
      { section: 'settings', view: 'templates', path: '/mail/templates', icon: FileText },
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
      {
        section: 'admin',
        view: 'admin-retention',
        path: '/mail/admin/retention',
        icon: ArchiveX,
        requiredResourceKey: 'ADMIN.MAIL',
        requiredPermissionCode: 'VIEW',
      },
      {
        section: 'admin',
        view: 'admin-delivery-audit',
        path: '/mail/admin/delivery-audit',
        icon: Activity,
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
