import { describe, expect, it } from 'vitest';

import { resolveCanaryAccessActionKinds } from './product-canary-access-state';

describe('Canary typed access-state actions', () => {
  it('never offers an access request for unknown or unavailable authority', () => {
    expect([
      ...resolveCanaryAccessActionKinds({ state: 'authority-unavailable' }, true, true),
    ]).toEqual(['return', 'retry']);
    expect([...resolveCanaryAccessActionKinds({ state: 'route-denied' }, true, true)]).toEqual([
      'return',
    ]);
  });

  it('offers only safe state-specific actions', () => {
    expect([...resolveCanaryAccessActionKinds({ state: 'app-denied' }, false, true)]).toEqual([
      'return',
      'request-access',
    ]);
    expect([
      ...resolveCanaryAccessActionKinds({ state: 'scope-selection-required' }, true, true),
    ]).toEqual(['return', 'select-scope']);
  });
});
