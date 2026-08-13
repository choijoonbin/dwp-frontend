import {
  Activity,
  AppWindow,
  BriefcaseBusiness,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
} from 'lucide-react';
import { foundationTokens } from '@dwp-frontend/design-system/foundation';

import type { LucideIcon } from 'lucide-react';

export type ShellScope = 'home' | 'tenant' | 'provider' | 'support';
export type ShellKey =
  | 'home'
  | 'workspace'
  | 'people'
  | 'workforce'
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
  workspace: {
    key: 'workspace',
    routePrefixes: ['/work', '/ask', '/activity', '/apps'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    compactNavigationWidth: foundationTokens.layout.navigationCompact,
    headerPosition: 'fixed',
    headerSurface: 'solid',
  },
  people: {
    key: 'people',
    routePrefixes: ['/people'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: UsersRound, labelKey: 'shell.people.name' },
  },
  workforce: {
    key: 'workforce',
    routePrefixes: ['/workforce'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: navigationExpanded,
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: Workflow, labelKey: 'shell.workforce.name' },
  },
  account: {
    key: 'account',
    routePrefixes: ['/account'],
    scope: 'tenant',
    brandMode: 'product',
    showWorkspace: true,
    desktopNavigationWidth: controlNavigationExpanded,
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
    headerPosition: 'fixed',
    headerSurface: 'solid',
    context: { icon: ShieldCheck, labelKey: 'shell.title' },
  },
} as const satisfies Record<ShellKey, ShellDefinition>;

export const shellHeaderHeight = foundationTokens.layout.headerHeight;

export const workspaceNavigationIcons: Readonly<Record<string, LucideIcon>> = {
  activity: Activity,
  apps: AppWindow,
  ask: Sparkles,
  work: BriefcaseBusiness,
  people: UsersRound,
  workforce: Workflow,
};

export const workspaceCoreContexts = [
  { route: '/work', labelKey: 'navigation.items.work', icon: BriefcaseBusiness },
  { route: '/ask', labelKey: 'navigation.items.ask', icon: Sparkles },
  { route: '/activity', labelKey: 'navigation.items.activity', icon: Activity },
  { route: '/apps', labelKey: 'navigation.items.apps', icon: AppWindow },
] as const;

const routeResolutionOrder: readonly ShellKey[] = [
  'provider',
  'admin',
  'account',
  'workforce',
  'people',
  'workspace',
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
