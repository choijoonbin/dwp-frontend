import { ADMIN_HOME_STUDIO_RETAINED_INVENTORY_ROUTES } from '../features/admin/admin-home-studio-route-contract';

export type SettingsJourneyId =
  | 'S01'
  | 'S02'
  | 'S03'
  | 'S04'
  | 'S05'
  | 'S06'
  | 'S07'
  | 'S08'
  | 'S09'
  | 'S10'
  | 'S11'
  | 'S12'
  | 'S13'
  | 'S14'
  | 'S15'
  | 'S16'
  | 'S17'
  | 'S18'
  | 'S19';

export type SettingsJourney = {
  id: SettingsJourneyId;
  plane: 'account' | 'tenant' | 'provider' | 'cross-plane';
  routes: readonly `/${string}`[];
};

export const SETTINGS_INVENTORY_EXPECTATIONS = {
  accountLeaves: 8,
  tenantVisibleLeaves: 22,
  tenantLeaves: 24,
  providerLeaves: 10,
  appManagementAreas: 12,
} as const;

export { ADMIN_HOME_STUDIO_RETAINED_INVENTORY_ROUTES };

export const SETTINGS_LANDING_ROUTES = ['/account/settings', '/admin', '/provider'] as const;

export const APP_MANAGEMENT_ENTRY_ROUTES = [
  '/dwaion/admin/overview',
  '/approvals/admin/overview',
  '/notifications/admin/overview',
  '/calendar/admin/overview',
  '/mail/admin/overview',
  '/meetings/admin/operations',
  '/messages/admin/overview',
  '/workplace/admin/overview',
  '/spaces/admin/overview',
  '/services/admin/catalog',
  '/communications/admin/content',
  '/hr/operations',
] as const;

/**
 * Stitch journeys mapped to canonical DWP owners for route inventory only. A journey may span
 * several routes. Presence here proves neither design/content acceptance nor functional coverage;
 * those require rendered journey assertions against the screen-specific acceptance contract.
 * This catalog is not a replacement navigation tree and must not grant access by itself.
 */
export const SETTINGS_JOURNEY_CATALOG: readonly SettingsJourney[] = [
  {
    id: 'S01',
    plane: 'cross-plane',
    routes: ['/account/settings', '/admin', '/provider'],
  },
  { id: 'S02', plane: 'account', routes: ['/account/settings'] },
  { id: 'S03', plane: 'account', routes: ['/account/profile'] },
  { id: 'S04', plane: 'account', routes: ['/account/security'] },
  {
    id: 'S05',
    plane: 'account',
    routes: [
      '/account/settings/appearance',
      '/account/settings/accessibility',
      '/account/settings/language',
    ],
  },
  { id: 'S06', plane: 'tenant', routes: ['/admin', '/admin/experience/branding'] },
  {
    id: 'S07',
    plane: 'tenant',
    routes: [
      '/admin/identity/access',
      '/admin/identity/roles',
      '/admin/identity/access-reviews',
      '/admin/identity/workforce-access',
      '/admin/identity/saved-view-custody',
    ],
  },
  {
    id: 'S08',
    plane: 'tenant',
    routes: ['/admin/governance/audit-governance', '/admin/governance/audit-events'],
  },
  { id: 'S09', plane: 'provider', routes: ['/provider/overview'] },
  {
    id: 'S10',
    plane: 'provider',
    routes: ['/provider/tenants', '/provider/commercial'],
  },
  {
    id: 'S11',
    plane: 'cross-plane',
    routes: [
      '/provider/feature-rollouts',
      '/provider/code-contracts',
      '/admin/experience/preference-exceptions',
      '/account/settings/managed',
    ],
  },
  {
    id: 'S12',
    plane: 'provider',
    routes: [
      '/provider/feature-rollouts',
      '/provider/health',
      '/provider/support',
      '/provider/operations',
    ],
  },
  {
    id: 'S13',
    plane: 'tenant',
    routes: ['/admin/platform/catalog', '/admin/platform/registry', ...APP_MANAGEMENT_ENTRY_ROUTES],
  },
  {
    id: 'S14',
    plane: 'tenant',
    routes: ['/admin/identity/app-governance', '/admin/identity/app-access-requests'],
  },
  {
    id: 'S15',
    plane: 'cross-plane',
    routes: ['/provider/feature-rollouts', '/provider/code-contracts'],
  },
  {
    id: 'S16',
    plane: 'provider',
    routes: ['/provider/operations', '/provider/audit'],
  },
  {
    id: 'S17',
    plane: 'cross-plane',
    routes: [
      '/provider/feature-rollouts',
      '/admin/governance/api-monitoring',
      '/provider/health',
      '/provider/operations',
    ],
  },
  {
    id: 'S18',
    plane: 'tenant',
    routes: [
      '/admin/integrations/productivity',
      '/admin/identity/provisioning',
      '/mail/admin/connections',
    ],
  },
  {
    id: 'S19',
    plane: 'cross-plane',
    routes: [
      '/dwaion/admin/safety',
      '/dwaion/admin/evaluation',
      '/dwaion/admin/actions',
      '/provider/commercial',
    ],
  },
] as const;

export function settingsJourney(id: SettingsJourneyId): SettingsJourney {
  const journey = SETTINGS_JOURNEY_CATALOG.find((candidate) => candidate.id === id);
  if (!journey) throw new Error(`Settings journey is not registered: ${id}`);
  return journey;
}
