import { describe, expect, it } from 'vitest';

import { privilegedScopeLabelKey, privilegedStateLabelKey } from './privileged-access-presentation';

describe('privileged access presentation', () => {
  it('fails closed for unknown scope and lifecycle values', () => {
    expect(privilegedScopeLabelKey('FUTURE_SCOPE')).toBe('security.privileged.scope.UNAVAILABLE');
    expect(privilegedStateLabelKey('FUTURE_STATE')).toBe('security.privileged.state.UNAVAILABLE');
  });

  it('keeps known values explicit', () => {
    expect(privilegedScopeLabelKey('TENANT')).toBe('security.privileged.scope.TENANT');
    expect(privilegedStateLabelKey('ACTIVE')).toBe('security.privileged.state.ACTIVE');
  });
});
