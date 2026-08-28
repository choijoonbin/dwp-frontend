import { describe, expect, it } from 'vitest';

import {
  createProviderTenantEntitlementSaveCommand,
  emptyProviderTenantEntitlementDraft,
  hydrateProviderTenantEntitlementDraft,
  PROVIDER_TENANT_ENTITLEMENT_SERVER_DRIFT,
  providerTenantEntitlementSaveResponseMatches,
  providerTenantEntitlementSaveTokenMatches,
  rebaseProviderTenantEntitlementDraft,
  rebaseProviderTenantEntitlementSaveResponse,
  toggleProviderTenantEntitlementDraft,
} from './provider-tenant-entitlement-draft-model';

const serverState = (tenantId: string, keys: string[], version = 3) => ({
  tenantId,
  version,
  entitlements: keys.map((entitlementKey) => ({ entitlementKey })),
});

describe('provider tenant entitlement draft model', () => {
  it('hydrates once and preserves a dirty selection across unrelated refreshes', () => {
    const hydrated = hydrateProviderTenantEntitlementDraft(
      emptyProviderTenantEntitlementDraft(),
      'tenant-42',
      ['mail', 'space']
    );
    const dirty = toggleProviderTenantEntitlementDraft(hydrated, 'space');
    const refreshed = hydrateProviderTenantEntitlementDraft(dirty, 'tenant-42', ['space', 'mail']);

    expect([...refreshed.selected]).toEqual(['mail']);
    expect(refreshed.dirty).toBe(true);
    expect(refreshed.conflict).toBe(false);
  });

  it('fails closed when server entitlements drift from a dirty baseline', () => {
    const baseline = rebaseProviderTenantEntitlementDraft('tenant-42', ['mail']);
    const dirty = toggleProviderTenantEntitlementDraft(baseline, 'space');
    const conflicted = hydrateProviderTenantEntitlementDraft(dirty, 'tenant-42', [
      'mail',
      'calendar',
    ]);

    expect([...conflicted.selected]).toEqual(['mail', 'space']);
    expect(conflicted.dirty).toBe(true);
    expect(conflicted.conflict).toBe(true);
  });

  it('rebases only when explicitly given the successful server state', () => {
    const baseline = rebaseProviderTenantEntitlementDraft('tenant-42', ['mail']);
    const dirty = toggleProviderTenantEntitlementDraft(baseline, 'space');
    const rebased = rebaseProviderTenantEntitlementDraft('tenant-42', dirty.selected);

    expect([...rebased.selected]).toEqual(['mail', 'space']);
    expect(rebased.dirty).toBe(false);
    expect(rebased.conflict).toBe(false);
  });

  it('applies a save response only while the exact tenant and draft token remain current', () => {
    const baseline = rebaseProviderTenantEntitlementDraft('tenant-a', ['mail']);
    const dirty = toggleProviderTenantEntitlementDraft(baseline, 'space');
    const command = createProviderTenantEntitlementSaveCommand(
      dirty,
      'tenant-a',
      serverState('tenant-a', ['mail']),
      '  approved change  ',
      false
    );

    if (!command || command === PROVIDER_TENANT_ENTITLEMENT_SERVER_DRIFT) {
      throw new Error('Expected an entitlement save command.');
    }
    const token = command.token;
    expect(command.selected).toEqual(['mail', 'space']);
    expect(command.justification).toBe('approved change');
    expect(token.serverSnapshotFingerprint).toBe('mail');
    expect(token.serverSnapshotVersion).toBe(3);
    expect(
      providerTenantEntitlementSaveTokenMatches(
        token,
        'tenant-a',
        dirty,
        serverState('tenant-a', ['mail'])
      )
    ).toBe(true);
    expect(
      providerTenantEntitlementSaveResponseMatches(
        token,
        'tenant-a',
        dirty,
        serverState('tenant-a', ['mail']),
        serverState('tenant-a', ['mail', 'space'], 4)
      )
    ).toBe(true);
    expect(
      providerTenantEntitlementSaveResponseMatches(
        token,
        'tenant-a',
        dirty,
        serverState('tenant-a', ['mail']),
        serverState('tenant-a', ['mail', 'space'], 5)
      )
    ).toBe(true);
    expect(
      providerTenantEntitlementSaveResponseMatches(
        token,
        'tenant-a',
        dirty,
        serverState('tenant-a', ['mail']),
        serverState('tenant-b', ['mail', 'space'], 4)
      )
    ).toBe(false);
    expect(
      providerTenantEntitlementSaveResponseMatches(
        token,
        'tenant-a',
        dirty,
        serverState('tenant-a', ['mail']),
        serverState('tenant-a', ['mail'], 4)
      )
    ).toBe(false);
    expect(
      rebaseProviderTenantEntitlementSaveResponse(
        token,
        'tenant-a',
        dirty,
        serverState('tenant-a', ['mail']),
        serverState('tenant-a', ['mail', 'space'], 4)
      )
    ).toEqual(rebaseProviderTenantEntitlementDraft('tenant-a', ['mail', 'space']));
    expect(
      rebaseProviderTenantEntitlementSaveResponse(
        token,
        'tenant-b',
        rebaseProviderTenantEntitlementDraft('tenant-b', ['mail']),
        serverState('tenant-b', ['mail']),
        serverState('tenant-a', ['mail', 'space'])
      )
    ).toBeNull();
    expect(
      providerTenantEntitlementSaveTokenMatches(
        token,
        'tenant-a',
        toggleProviderTenantEntitlementDraft(dirty, 'calendar'),
        serverState('tenant-a', ['mail'])
      )
    ).toBe(false);
    expect(
      providerTenantEntitlementSaveTokenMatches(
        token,
        'tenant-a',
        dirty,
        serverState('tenant-a', ['mail', 'calendar'])
      )
    ).toBe(false);
    expect(
      providerTenantEntitlementSaveTokenMatches(
        token,
        'tenant-a',
        dirty,
        serverState('tenant-a', ['mail'], 4)
      )
    ).toBe(false);
    expect(
      providerTenantEntitlementSaveResponseMatches(
        token,
        'tenant-a',
        dirty,
        serverState('tenant-a', ['mail']),
        serverState('tenant-a', ['mail', 'space'])
      )
    ).toBe(false);
  });

  it('rejects a save synchronously when server drift renders before conflict hydration', () => {
    const baseline = rebaseProviderTenantEntitlementDraft('tenant-a', ['mail']);
    const staleDraft = toggleProviderTenantEntitlementDraft(baseline, 'space');

    expect(staleDraft.conflict).toBe(false);
    expect(
      createProviderTenantEntitlementSaveCommand(
        staleDraft,
        'tenant-a',
        serverState('tenant-a', ['mail', 'calendar']),
        'approved change',
        false
      )
    ).toBe(PROVIDER_TENANT_ENTITLEMENT_SERVER_DRIFT);
  });
});
