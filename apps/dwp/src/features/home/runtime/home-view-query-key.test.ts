import { describe, expect, it } from 'vitest';

import { homeViewQueryKey, requireHomeViewMode } from './home-view-query-key';

describe('Home view query identity', () => {
  const scope = {
    tenantId: 7,
    userId: 11,
    surfaceKey: 'workspace-home' as const,
    modeScoped: true,
  };

  it('isolates Classic and Flow cache entries', () => {
    expect(homeViewQueryKey({ ...scope, modeKey: 'CLASSIC' })).not.toEqual(
      homeViewQueryKey({ ...scope, modeKey: 'FLOW_V1' })
    );
  });

  it('isolates owner transitions as well as the Home surface', () => {
    expect(homeViewQueryKey({ ...scope, modeKey: 'CLASSIC' })).not.toEqual(
      homeViewQueryKey({ ...scope, userId: 12, modeKey: 'CLASSIC' })
    );
  });

  it('does not reuse an unscoped legacy read after capability activation', () => {
    expect(homeViewQueryKey({ ...scope, modeKey: 'CLASSIC', modeScoped: false })).not.toEqual(
      homeViewQueryKey({ ...scope, modeKey: 'CLASSIC', modeScoped: true })
    );
  });

  it('rejects a mutation response from another immutable Home mode', () => {
    expect(requireHomeViewMode({ modeKey: 'FLOW_V1' }, 'FLOW_V1')).toEqual({
      modeKey: 'FLOW_V1',
    });
    expect(() => requireHomeViewMode({ modeKey: 'CLASSIC' }, 'FLOW_V1')).toThrow(
      /returned CLASSIC, not requested mode FLOW_V1/u
    );
  });

  it('only treats a missing mutation mode as Classic on the explicit legacy bridge', () => {
    expect(requireHomeViewMode({}, 'CLASSIC', true)).toEqual({ modeKey: 'CLASSIC' });
    expect(() => requireHomeViewMode({}, 'CLASSIC')).toThrow(/returned no mode/u);
    expect(() => requireHomeViewMode({}, 'FLOW_V1', true)).toThrow(/returned CLASSIC/u);
  });
});
