import { describe, expect, it } from 'vitest';

import { isDwaionGlobalHostAllowed } from './dwaion-global-host-policy';

const allowAsk = {
  resourceType: 'APP',
  resourceKey: 'APP.ASK',
  permissionCode: 'VIEW',
  effect: 'ALLOW',
};

describe('DWAI.ON global host policy', () => {
  it('renders only for an explicitly entitled tenant identity', () => {
    expect(isDwaionGlobalHostAllowed('TENANT', [allowAsk])).toBe(true);
  });

  it('never renders in the provider control plane', () => {
    expect(isDwaionGlobalHostAllowed('PROVIDER', [allowAsk])).toBe(false);
    expect(isDwaionGlobalHostAllowed('PROVIDER', [])).toBe(false);
  });

  it('fails closed for missing or denied tenant entitlement', () => {
    expect(isDwaionGlobalHostAllowed('TENANT', [])).toBe(false);
    expect(isDwaionGlobalHostAllowed('TENANT', [{ ...allowAsk, effect: 'DENY' }])).toBe(false);
  });
});
