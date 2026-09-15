import { describe, expect, it } from 'vitest';

import { canRunWidgetRegistryTransition } from './widget-registry-governance-policy';

const impact = {
  definitionId: 'definition-1',
  versionId: 'version-1',
  operation: 'PUBLISH',
  activeChannelCount: 0,
  tenantPolicyReferenceCount: 0,
  instanceReferenceCount: 0,
  affectedTenantCount: 0,
  operationAllowed: true,
  impactRevision: 'a'.repeat(64),
  calculatedAt: '2026-09-15T00:00:00Z',
} as const;

describe('widget registry governance transition policy', () => {
  it('keeps every transition closed in shadow mode', () => {
    expect(
      canRunWidgetRegistryTransition({
        shadow: true,
        allowedTransitions: ['PUBLISH'],
        transition: 'PUBLISH',
        impact,
      })
    ).toBe(false);
  });

  it('requires both a server transition grant and matching current impact evidence', () => {
    expect(
      canRunWidgetRegistryTransition({
        shadow: false,
        allowedTransitions: ['PUBLISH'],
        transition: 'PUBLISH',
        impact,
      })
    ).toBe(true);
    expect(
      canRunWidgetRegistryTransition({
        shadow: false,
        allowedTransitions: [],
        transition: 'PUBLISH',
        impact,
      })
    ).toBe(false);
    expect(
      canRunWidgetRegistryTransition({
        shadow: false,
        allowedTransitions: ['BLOCK'],
        transition: 'BLOCK',
        impact,
      })
    ).toBe(false);
  });
});
