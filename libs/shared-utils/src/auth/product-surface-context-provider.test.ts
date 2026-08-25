import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  isProductAuthoritySensitiveQuery,
  productSurfaceEvaluationQueryKey,
} from './product-surface-context-provider';

import type { ProductSurfaceAuthoritySnapshot } from './product-surface-authority-model';

describe('product surface authority cache invalidation', () => {
  it('does not reuse a direct ALLOWED result across list-envelope revisions', () => {
    const snapshot = (decisionRevision: string) =>
      ({
        envelope: { activeAccessMode: 'NORMAL', decisionRevision },
      }) as ProductSurfaceAuthoritySnapshot;
    const request = {
      subject: {
        type: 'PRODUCT' as const,
        productKey: 'approvals',
        surfaceKey: 'approvals.admin',
      },
      routeContractKey: 'route.approvals.admin.policies.page',
    };
    const identity = { tenantId: '1', actorId: '900018' };
    const before = productSurfaceEvaluationQueryKey(snapshot('list-revision-1'), request, identity);
    const after = productSurfaceEvaluationQueryKey(snapshot('list-revision-2'), request, identity);
    const queryClient = new QueryClient();
    queryClient.setQueryData(before, {
      decision: 'ALLOWED',
      decisionRevision: 'independent-direct-revision',
    });

    expect(after).not.toEqual(before);
    expect(queryClient.getQueryData(after)).toBeUndefined();
  });

  it('purges exact sensitive meta and migrated product prefixes after a revision change', () => {
    const identity = { tenantId: 'tenant-1', actorId: 'actor-1', accessMode: 'NORMAL' };
    expect(
      isProductAuthoritySensitiveQuery(
        { queryKey: ['owner-detail'], meta: { accessSensitive: true } },
        identity
      )
    ).toBe(true);
    expect(
      isProductAuthoritySensitiveQuery({ queryKey: ['approvals', 'inbox'] }, identity, [
        'approvals',
        'communications',
      ])
    ).toBe(true);
    expect(
      isProductAuthoritySensitiveQuery(
        {
          queryKey: ['private'],
          meta: { accessSensitive: true, tenantId: 'other-tenant' },
        },
        identity
      )
    ).toBe(false);
    expect(
      isProductAuthoritySensitiveQuery({ queryKey: ['unrelated', 'public'] }, identity, [
        'approvals',
      ])
    ).toBe(false);
  });

  it('removes governed product data while preserving unrelated public cache data', () => {
    const queryClient = new QueryClient();
    const identity = { tenantId: 'tenant-1', actorId: 'actor-1', accessMode: 'NORMAL' };
    queryClient.setQueryData(['approvals', 'review', 'private'], { subject: 'secret' });
    queryClient.setQueryData(['public-catalog', 'apps'], [{ id: 'approvals' }]);

    queryClient.removeQueries({
      predicate: (query) =>
        isProductAuthoritySensitiveQuery(query, identity, [
          'approvals',
          'communications',
          'services',
          'hcm',
        ]),
    });

    expect(queryClient.getQueryData(['approvals', 'review', 'private'])).toBeUndefined();
    expect(queryClient.getQueryData(['public-catalog', 'apps'])).toEqual([{ id: 'approvals' }]);
  });
});
