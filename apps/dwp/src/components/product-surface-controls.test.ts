import { describe, expect, it } from 'vitest';

import {
  productSurfaceContentInstanceKey,
  resolveSurfaceExpiryIndicator,
} from './product-surface-controls';

describe('product surface content instance', () => {
  it('changes across scope or authority revision so stale local page state is remounted', () => {
    const current = {
      contextKey: 'context-1',
      surfaceKey: 'approvals.admin',
      contextScopeKey: 'scope-a',
      decisionRevision: 'revision-1',
    };

    expect(productSurfaceContentInstanceKey(current)).not.toBe(
      productSurfaceContentInstanceKey({ ...current, contextScopeKey: 'scope-b' })
    );
    expect(productSurfaceContentInstanceKey(current)).not.toBe(
      productSurfaceContentInstanceKey({ ...current, decisionRevision: 'revision-2' })
    );
  });
});

describe('management surface expiry indicator', () => {
  const serverNow = Date.parse('2026-08-24T01:00:00Z');

  it('warns once the server-clock deadline enters the final five minutes', () => {
    expect(resolveSurfaceExpiryIndicator('management', '2026-08-24T01:05:00Z', serverNow)).toEqual({
      state: 'warning',
    });
    expect(resolveSurfaceExpiryIndicator('management', '2026-08-24T01:10:00Z', serverNow)).toEqual({
      state: 'hidden',
      warningDelayMs: 5 * 60_000,
    });
  });

  it('never interrupts Work and fails expired/invalid management time closed', () => {
    expect(resolveSurfaceExpiryIndicator('work', 'not-a-time', serverNow)).toEqual({
      state: 'hidden',
    });
    expect(resolveSurfaceExpiryIndicator('management', '2026-08-24T00:59:59Z', serverNow)).toEqual({
      state: 'expired',
    });
    expect(resolveSurfaceExpiryIndicator('management', 'not-a-time', serverNow)).toEqual({
      state: 'expired',
    });
  });
});
