import { describe, expect, it } from 'vitest';

import { resolveHomeV2ActivationState, resolveHomeV2ReadPath } from './use-home-v2-runtime';

const result = (runtimeMode: 'ACTIVE' | 'SHADOW') =>
  ({
    metadata: { runtimeMode },
  }) as never;

describe('Home v2 activation gate', () => {
  it('holds the legacy path while the runtime handshake is unresolved', () => {
    expect(
      resolveHomeV2ActivationState(true, {
        isPending: true,
        isError: false,
      })
    ).toEqual({ kind: 'PENDING' });
    expect(resolveHomeV2ReadPath({ kind: 'PENDING' })).toEqual({
      legacyFanoutEnabled: false,
      render: 'LOADING',
    });
  });

  it('selects the v2 path only from the trusted ACTIVE response header', () => {
    const active = resolveHomeV2ActivationState(true, {
      data: result('ACTIVE'),
      isPending: false,
      isError: false,
    });
    const shadow = resolveHomeV2ActivationState(true, {
      data: result('SHADOW'),
      isPending: false,
      isError: false,
    });
    expect(active.kind).toBe('ACTIVE');
    expect(resolveHomeV2ReadPath(active)).toEqual({
      legacyFanoutEnabled: false,
      render: 'V2',
    });
    expect(shadow.kind).toBe('SHADOW');
    expect(resolveHomeV2ReadPath(shadow)).toEqual({
      legacyFanoutEnabled: true,
      render: 'LEGACY',
    });
  });

  it('fails closed instead of enabling legacy fanout after a v2 error', () => {
    const error = new Error('authority unavailable');
    const activation = resolveHomeV2ActivationState(true, {
      error,
      isPending: false,
      isError: true,
    });
    expect(activation).toEqual({ kind: 'ERROR', error });
    expect(resolveHomeV2ReadPath(activation)).toEqual({
      legacyFanoutEnabled: false,
      render: 'ERROR',
    });
  });

  it('keeps the last ACTIVE snapshot after a refresh error without enabling legacy fanout', () => {
    const activation = resolveHomeV2ActivationState(true, {
      data: result('ACTIVE'),
      error: new Error('refresh failed'),
      isPending: false,
      isError: true,
    });
    expect(activation).toMatchObject({ kind: 'ACTIVE', refreshFailed: true });
    expect(resolveHomeV2ReadPath(activation)).toEqual({
      legacyFanoutEnabled: false,
      render: 'V2',
    });
  });

  it('does not invent a runtime decision when the handshake is disabled', () => {
    expect(
      resolveHomeV2ActivationState(false, {
        isPending: false,
        isError: false,
      })
    ).toEqual({ kind: 'DISABLED' });
  });
});
