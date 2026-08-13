import {
  BadgeDollarSign,
  Braces,
  Building2,
  ClipboardList,
  Database,
  Flag,
  Gauge,
  HeartPulse,
  LifeBuoy,
  ListChecks,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';

export type ProviderNavigationItem = {
  key: string;
  path: string;
  icon: LucideIcon;
  permission: string;
};

export type ProviderNavigationGroup = {
  key: 'operate' | 'govern';
  items: readonly ProviderNavigationItem[];
};

export const PROVIDER_NAVIGATION: readonly ProviderNavigationGroup[] = [
  {
    key: 'operate',
    items: [
      { key: 'overview', path: '/provider/overview', icon: Gauge, permission: 'ESTATE_READ' },
      { key: 'tenants', path: '/provider/tenants', icon: Building2, permission: 'ESTATE_READ' },
      {
        key: 'operations',
        path: '/provider/operations',
        icon: ListChecks,
        permission: 'ESTATE_READ',
      },
      { key: 'health', path: '/provider/health', icon: HeartPulse, permission: 'HEALTH_READ' },
    ],
  },
  {
    key: 'govern',
    items: [
      {
        key: 'featureRollouts',
        path: '/provider/feature-rollouts',
        icon: Flag,
        permission: 'FEATURE_ROLLOUT_READ',
      },
      { key: 'support', path: '/provider/support', icon: LifeBuoy, permission: 'ESTATE_READ' },
      {
        key: 'commercial',
        path: '/provider/commercial',
        icon: BadgeDollarSign,
        permission: 'COMMERCIAL_READ',
      },
      {
        key: 'codeContracts',
        path: '/provider/code-contracts',
        icon: Braces,
        permission: 'CATALOG_READ',
      },
      {
        key: 'dataGovernance',
        path: '/provider/data-governance',
        icon: Database,
        permission: 'DATA_GOVERNANCE_READ',
      },
      { key: 'audit', path: '/provider/audit', icon: ClipboardList, permission: 'AUDIT_READ' },
    ],
  },
];
