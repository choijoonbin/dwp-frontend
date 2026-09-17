import { describe, expect, it } from 'vitest';

import { canContextAccessNavigation } from '../../components/product-surface-context';
import { MAIL_MANAGEMENT_NAVIGATION, MAIL_PRODUCT_MANIFEST } from './mail-product-manifest';

import type { ProductNavigationAccess } from '../../components/product-manifest';
import type { EffectiveProductSurfaceContext } from '../../components/product-surface-context';

const NOW = Date.parse('2026-09-17T00:00:00.000Z');
const SCOPE = 'mail-management-scope';

function routeAccess(path: string): ProductNavigationAccess {
  const item = MAIL_MANAGEMENT_NAVIGATION.flatMap((group) => group.items).find(
    (candidate) => candidate.path === path
  );
  if (!item) throw new Error(`Missing Mail management route ${path}`);
  return item.access;
}

function contextWith(capabilityContractKey: string): EffectiveProductSurfaceContext {
  return {
    contextKey: 'mail-management-context',
    productKey: 'mail',
    surfaceKey: 'mail.management',
    plane: 'management',
    accessMode: 'NORMAL',
    accessSource: 'MANAGEMENT',
    appResourceKey: 'APP.MAIL',
    effectiveGrants: [
      {
        grantKind: 'CAPABILITY',
        capabilityContractKey,
        resolvedCapabilityCode: capabilityContractKey,
        authorityMode: 'PERMISSION',
        responsibilityRequirement: 'NOT_REQUIRED',
        scopeKeys: [SCOPE],
        requiresProductEntitlement: false,
        readOnly: false,
        activationState: 'ACTIVE',
      },
    ],
    scopes: [
      {
        key: SCOPE,
        kind: 'RESOURCE_SET',
        displayName: 'Mail management',
        isDefault: true,
        readOnly: false,
      },
    ],
    revalidateAt: '2026-09-18T00:00:00.000Z',
  };
}

describe('Mail exact management authorization projection', () => {
  it.each([
    'mail.management.hold.manage',
    'mail.management.purge.preview',
    'mail.management.purge.authorize',
    'mail.management.purge.execute',
    'mail.management.evidence.export',
  ])('allows the retention route for the exact %s responsibility', (capability) => {
    expect(
      canContextAccessNavigation(
        routeAccess('/mail/admin/retention'),
        contextWith(capability),
        SCOPE,
        NOW
      )
    ).toBe(true);
  });

  it.each([
    'mail.management.audit.read',
    'mail.management.audit.reveal',
    'mail.management.delivery.reconcile',
    'mail.management.delivery.retry',
    'mail.management.delivery.cancel',
    'mail.management.evidence.export',
  ])('allows the delivery route for the exact %s responsibility', (capability) => {
    expect(
      canContextAccessNavigation(
        routeAccess('/mail/admin/delivery-audit'),
        contextWith(capability),
        SCOPE,
        NOW
      )
    ).toBe(true);
  });

  it('does not cross-authorize retention and delivery responsibilities', () => {
    expect(
      canContextAccessNavigation(
        routeAccess('/mail/admin/retention'),
        contextWith('mail.management.delivery.retry'),
        SCOPE,
        NOW
      )
    ).toBe(false);
    expect(
      canContextAccessNavigation(
        routeAccess('/mail/admin/delivery-audit'),
        contextWith('mail.management.purge.execute'),
        SCOPE,
        NOW
      )
    ).toBe(false);
  });

  it('exposes exact responsibilities at the Mail management entry boundary', () => {
    const management = MAIL_PRODUCT_MANIFEST.surfaces.find(
      (surface) => surface.id === 'mail.management'
    );
    expect(management?.entryAccess).toMatchObject({
      type: 'capability',
      entryCapabilityMode: 'ANY',
    });
    if (!management || management.entryAccess.type !== 'capability') return;
    expect(management.entryAccess.requiredCapabilityContractKeys).toEqual(
      expect.arrayContaining([
        'mail.management.hold.manage',
        'mail.management.purge.execute',
        'mail.management.delivery.retry',
        'mail.management.delivery.cancel',
        'mail.management.evidence.export',
      ])
    );
  });
});
