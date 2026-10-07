import { describe, expect, it } from 'vitest';

import { hrisSystemQueryKey } from '../hooks/use-hris-system';

import type { ProductSurfaceRequestScope } from '../../../../../components/use-product-surface-request-scope';

function scope(
  tenantId: string,
  actorId: string,
  contextScopeKey: string,
  decisionRevision: string
): ProductSurfaceRequestScope {
  return {
    governed: true,
    ready: true,
    contextScopeKey,
    cacheKey: [tenantId, actorId, 'NORMAL', 'hcm.management', contextScopeKey, decisionRevision],
    queryMeta: {
      accessSensitive: true,
      tenantId,
      actorId,
      accessMode: 'NORMAL',
      productId: 'hcm',
      surfaceId: 'hcm.management',
      contextScopeKey,
      decisionRevision,
    },
  };
}

describe('HRIS system cache identity', () => {
  it('partitions projection evidence by tenant, subject, surface scope, and decision revision', () => {
    const first = hrisSystemQueryKey(
      scope('tenant-1', 'actor-1', 'scope:west', 'decision-1'),
      'authority-1'
    );
    const tenantChanged = hrisSystemQueryKey(
      scope('tenant-2', 'actor-1', 'scope:west', 'decision-1'),
      'authority-1'
    );
    const actorChanged = hrisSystemQueryKey(
      scope('tenant-1', 'actor-2', 'scope:west', 'decision-1'),
      'authority-1'
    );
    const scopeChanged = hrisSystemQueryKey(
      scope('tenant-1', 'actor-1', 'scope:east', 'decision-1'),
      'authority-1'
    );
    const revisionChanged = hrisSystemQueryKey(
      scope('tenant-1', 'actor-1', 'scope:west', 'decision-2'),
      'authority-1'
    );
    const authorityChanged = hrisSystemQueryKey(
      scope('tenant-1', 'actor-1', 'scope:west', 'decision-1'),
      'authority-2'
    );

    expect(
      new Set(
        [first, tenantChanged, actorChanged, scopeChanged, revisionChanged, authorityChanged].map(
          (key) => JSON.stringify(key)
        )
      )
    ).toHaveLength(6);
    expect(first).toEqual([
      'hris',
      'administration',
      'system-access',
      'v2',
      'tenant-1',
      'actor-1',
      'NORMAL',
      'hcm.management',
      'scope:west',
      'decision-1',
      'authority-1',
      'HRIS_SYSTEM_CONFIGURATION',
    ]);
  });
});
