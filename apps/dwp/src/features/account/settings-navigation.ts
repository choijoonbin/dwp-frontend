import {
  Accessibility,
  BellRing,
  Building2,
  LayoutDashboard,
  Palette,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { LanguageIcon } from '@dwp-frontend/design-system/components/icons';

import type { LucideIcon } from 'lucide-react';

export const settingsSections = [
  'appearance',
  'accessibility',
  'language',
  'home',
  'notifications',
  'managed',
] as const;

export type SettingsSection = (typeof settingsSections)[number];

export type AccountNavigationItem = {
  key: string;
  path: string;
  icon: LucideIcon;
};

export type AccountNavigationGroup = {
  key: string;
  items: AccountNavigationItem[];
};

export type ProviderAccountRouteDecision = 'allow' | 'loading' | 'redirect-support';

export function resolveProviderAccountRouteDecision({
  providerAccount,
  supportLoading,
  supportError,
  hasActiveSupport,
}: {
  providerAccount: boolean;
  supportLoading: boolean;
  supportError: boolean;
  hasActiveSupport: boolean;
}): ProviderAccountRouteDecision {
  if (!providerAccount) return 'allow';
  if (supportLoading) return 'loading';
  return supportError || hasActiveSupport ? 'redirect-support' : 'allow';
}

const tenantOnlySettingsSections = new Set<SettingsSection>(['home', 'notifications', 'managed']);

export const accountNavigationGroups: AccountNavigationGroup[] = [
  {
    key: 'account',
    items: [
      { key: 'profile', path: '/account/profile', icon: UserRound },
      { key: 'security', path: '/account/security', icon: ShieldCheck },
    ],
  },
  {
    key: 'preferences',
    items: [
      { key: 'appearance', path: '/account/settings/appearance', icon: Palette },
      { key: 'accessibility', path: '/account/settings/accessibility', icon: Accessibility },
      { key: 'language', path: '/account/settings/language', icon: LanguageIcon },
      { key: 'home', path: '/account/settings/home', icon: LayoutDashboard },
      { key: 'notifications', path: '/account/settings/notifications', icon: BellRing },
    ],
  },
  {
    key: 'organization',
    items: [{ key: 'managed', path: '/account/settings/managed', icon: Building2 }],
  },
];

export function isAccountSettingsSectionAvailable(
  section: SettingsSection,
  providerAccount: boolean
): boolean {
  return !providerAccount || !tenantOnlySettingsSections.has(section);
}

export function getAccountNavigationGroups(providerAccount: boolean): AccountNavigationGroup[] {
  if (!providerAccount) return accountNavigationGroups;
  return accountNavigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const section = item.path.split('/').pop();
        return !isSettingsSection(section) || isAccountSettingsSectionAvailable(section, true);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export function isSettingsSection(value: string | undefined): value is SettingsSection {
  return settingsSections.includes(value as SettingsSection);
}
