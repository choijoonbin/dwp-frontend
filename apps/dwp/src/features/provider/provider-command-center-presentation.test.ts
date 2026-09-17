import { describe, expect, it } from 'vitest';

import type { ProviderCommandCenter } from '@dwp-frontend/shared-utils';

import {
  providerCommandCenterPresentationState,
  providerCustomerImpactTone,
} from './provider-command-center-presentation';

function command(overrides: Partial<ProviderCommandCenter> = {}): ProviderCommandCenter {
  return {
    generatedAt: '2026-09-17T00:00:00Z',
    operatingState: 'HEALTHY',
    estate: {
      organizations: 1,
      tenants: 1,
      activeTenants: 1,
      provisioningTenants: 0,
      suspendedTenants: 0,
      failedTenants: 0,
      openOperations: 0,
      activeSupportSessions: 0,
      regions: [],
      serviceTiers: [],
    },
    activeIncidents: 0,
    expiringSubscriptions: 0,
    actionQueue: [],
    services: [],
    cells: [],
    recentActivity: [],
    ...overrides,
  };
}

describe('provider command-center presentation state', () => {
  it('does not present a healthy headline while an action is waiting', () => {
    expect(
      providerCommandCenterPresentationState(
        command({
          actionQueue: [
            {
              itemId: 'action-1',
              category: 'CHANGE',
              severity: 'MEDIUM',
              title: 'Review rollout',
              detail: 'A governed rollout is awaiting review.',
              targetId: 'rollout-1',
              createdAt: '2026-09-17T00:00:00Z',
              route: '/provider/feature-rollouts',
            },
          ],
        })
      )
    ).toBe('ATTENTION');
  });

  it('escalates failed service evidence and critical actions to critical', () => {
    expect(
      providerCommandCenterPresentationState(
        command({
          services: [
            {
              serviceKey: 'workspace',
              displayName: 'Workspace',
              criticality: 'HIGH',
              totalInstances: 1,
              healthyInstances: 0,
              pendingInstances: 0,
              degradedInstances: 0,
              failedInstances: 1,
              impactedTenants: 1,
            },
          ],
        })
      )
    ).toBe('CRITICAL');
  });

  it('never downgrades the authoritative server state', () => {
    expect(providerCommandCenterPresentationState(command({ operatingState: 'CRITICAL' }))).toBe(
      'CRITICAL'
    );
  });

  it('does not show customer impact as successful while impacted-tenant evidence exists', () => {
    expect(providerCustomerImpactTone(0, 3)).toBe('warning');
    expect(providerCustomerImpactTone(1, 0)).toBe('error');
    expect(providerCustomerImpactTone(0, 0)).toBe('success');
  });
});
