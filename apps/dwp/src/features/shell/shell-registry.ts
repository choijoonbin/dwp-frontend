import {
  Activity,
  AppWindow,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ContactRound,
  FileCheck2,
  LifeBuoy,
  Layers3,
  Mail,
  MessageSquareText,
  Newspaper,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import type { LucideIcon } from 'lucide-react';

export type ShellScope = 'home' | 'tenant' | 'provider' | 'support';
export type ShellKey =
  | 'home'
  | 'catalog'
  | 'work'
  | 'activity'
  | 'dwaion'
  | 'communications'
  | 'services'
  | 'calendar'
  | 'rooms'
  | 'mail'
  | 'messaging'
  | 'notifications'
  | 'hcm'
  | 'approvals'
  | 'spaces'
  | 'account'
  | 'admin'
  | 'provider';

type ShellBrandMode = 'tenant-cobrand' | 'product' | 'control-center' | 'provider';

export type ShellDefinition = {
  key: ShellKey;
  routePrefixes: readonly string[];
  scope: Exclude<ShellScope, 'support'>;
  brandMode: ShellBrandMode;
  showWorkspace: boolean;
  desktopNavigationWidth: number;
  compactNavigationWidth?: number;
  headerPosition: 'fixed' | 'sticky';
  headerSurface: 'solid' | 'glass';
  context?: {
    icon: LucideIcon;
    labelKey: string;
  };
};

const navigationExpanded = foundationTokens.layout.navigationExpanded;
const controlNavigationExpanded = foundationTokens.layout.adminNavigationExpanded;

export const shellRegistry = {
  home: {
    key: 'home',
    routePrefixes: ['/'],
    scope: 'home',
    brandMode: 'tenant-cobrand',
    showWorkspace: true,
    desktopNavigationWidth: 0,
    headerPosition: 'sticky',
    headerSurface: 'glass',
  },
  catalog: {
    key: 'catalog',
    routePrefixes: ['/apps'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: 0,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: AppWindow, labelKey: 'navigation.items.apps' },
  },
  work: {
    key: 'work',
    routePrefixes: ['/work'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: BriefcaseBusiness, labelKey: 'shell.work.name' },
  },
  activity: {
    key: 'activity',
    routePrefixes: ['/activity'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: Activity, labelKey: 'shell.activity.name' },
  },
  dwaion: {
    key: 'dwaion',
    routePrefixes: ['/dwaion', '/ask'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: Sparkles, labelKey: 'shell.dwaion.name' },
  },
  communications: {
    key: 'communications',
    routePrefixes: ['/communications'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: Newspaper, labelKey: 'shell.communications.name' },
  },
  services: {
    key: 'services',
    routePrefixes: ['/services'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: LifeBuoy, labelKey: 'shell.services.name' },
  },
  calendar: {
    key: 'calendar',
    routePrefixes: ['/calendar'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: CalendarDays, labelKey: 'shell.calendar.name' },
  },
  rooms: {
    key: 'rooms',
    routePrefixes: ['/workplace', '/rooms'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: Building2, labelKey: 'shell.rooms.name' },
  },
  mail: {
    key: 'mail',
    routePrefixes: ['/mail'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: Mail, labelKey: 'shell.mail.name' },
  },
  messaging: {
    key: 'messaging',
    routePrefixes: ['/messages'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: MessageSquareText, labelKey: 'shell.messaging.name' },
  },
  notifications: {
    key: 'notifications',
    routePrefixes: ['/notifications'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: BellRing, labelKey: 'shell.notifications.name' },
  },
  hcm: {
    key: 'hcm',
    routePrefixes: ['/hr'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: ContactRound, labelKey: 'shell.hcm.name' },
  },
  approvals: {
    key: 'approvals',
    routePrefixes: ['/approvals'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: FileCheck2, labelKey: 'shell.approvals.name' },
  },
  spaces: {
    key: 'spaces',
    routePrefixes: ['/spaces'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: Layers3, labelKey: 'shell.spaces.name' },
  },
  account: {
    key: 'account',
    routePrefixes: ['/account'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: controlNavigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: Settings2, labelKey: 'shell.title' },
  },
  admin: {
    key: 'admin',
    routePrefixes: ['/admin'],
    scope: 'tenant',
    brandMode: 'control-center',
    showWorkspace: true,
    desktopNavigationWidth: controlNavigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: ShieldCheck, labelKey: 'shell.controlCenter' },
  },
  provider: {
    key: 'provider',
    routePrefixes: ['/provider'],
    scope: 'provider',
    brandMode: 'provider',
    showWorkspace: false,
    desktopNavigationWidth: controlNavigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: ShieldCheck, labelKey: 'shell.title' },
  },
} as const satisfies Record<ShellKey, ShellDefinition>;

export const shellHeaderHeight = foundationTokens.layout.headerHeight;

const routeResolutionOrder: readonly ShellKey[] = [
  'provider',
  'admin',
  'account',
  'dwaion',
  'approvals',
  'spaces',
  'calendar',
  'rooms',
  'mail',
  'messaging',
  'notifications',
  'hcm',
  'services',
  'communications',
  'work',
  'activity',
  'catalog',
  'home',
];

export function resolveShellKey(pathname: string): ShellKey | undefined {
  const normalizedPath = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  return routeResolutionOrder.find((key) =>
    shellRegistry[key].routePrefixes.some((prefix) =>
      prefix === '/'
        ? normalizedPath === '/'
        : normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
    )
  );
}
