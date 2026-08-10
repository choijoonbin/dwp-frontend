import {
  Accessibility,
  Building2,
  Languages,
  LayoutDashboard,
  Palette,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

export const settingsSections = [
  'appearance',
  'accessibility',
  'language',
  'home',
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
      { key: 'language', path: '/account/settings/language', icon: Languages },
      { key: 'home', path: '/account/settings/home', icon: LayoutDashboard },
    ],
  },
  {
    key: 'organization',
    items: [{ key: 'managed', path: '/account/settings/managed', icon: Building2 }],
  },
];

export function isSettingsSection(value: string | undefined): value is SettingsSection {
  return settingsSections.includes(value as SettingsSection);
}
