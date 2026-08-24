import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  isAuthorizedScopeTransitionResponse,
  isProductAccessSensitiveQuery,
} from './use-product-surface-scope-transition';

describe('governed product sensitive-query adapter', () => {
  it('covers migrated product query prefixes until every feature owns exact meta', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['approvals', 'inbox'], [{ private: true }]);
    queryClient.setQueryData(['communications', 'feed'], [{ private: true }]);
    queryClient.setQueryData(['services', 'requests'], [{ private: true }]);
    queryClient.setQueryData(['hcm', 'employee'], [{ private: true }]);
    queryClient.setQueryData(['unrelated', 'public'], [{ public: true }]);

    for (const productId of ['approvals', 'communications', 'services', 'hcm']) {
      queryClient.removeQueries({
        predicate: (query) => isProductAccessSensitiveQuery(query, productId),
      });
    }

    expect(queryClient.getQueryData(['approvals', 'inbox'])).toBeUndefined();
    expect(queryClient.getQueryData(['communications', 'feed'])).toBeUndefined();
    expect(queryClient.getQueryData(['services', 'requests'])).toBeUndefined();
    expect(queryClient.getQueryData(['hcm', 'employee'])).toBeUndefined();
    expect(queryClient.getQueryData(['unrelated', 'public'])).toEqual([{ public: true }]);
  });

  it('accepts only a fresh direct response for the exact new scope and revision', () => {
    const evaluated = {
      decision: 'ALLOWED' as const,
      decisionRevision: 'revision-2',
      routeGrantRef: 'grant-ref',
      effectiveReadOnly: false,
      revalidateAt: '2026-08-24T02:05:00Z',
      context: {
        contextKey: 'context-1',
        productKey: 'approvals',
        surfaceKey: 'approvals.management',
        plane: 'management' as const,
        accessMode: 'NORMAL' as const,
        accessSource: 'MANAGEMENT' as const,
        appResourceKey: 'APP.APPROVALS',
        effectiveGrants: [],
        scopes: [
          {
            key: 'scope-new',
            kind: 'RESOURCE_SET',
            displayName: 'Assigned scope',
            isDefault: true,
            readOnly: false,
          },
        ],
        revalidateAt: '2026-08-24T02:05:00Z',
      },
      scope: {
        key: 'scope-new',
        kind: 'RESOURCE_SET',
        displayName: 'Assigned scope',
        isDefault: true,
        readOnly: false,
      },
    };
    const expected = {
      productKey: 'approvals',
      surfaceKey: 'approvals.management',
      contextKey: 'context-1',
      scopeKey: 'scope-new',
      decisionRevision: 'revision-2',
      serverNowMs: Date.parse('2026-08-24T02:00:00Z'),
    };

    expect(isAuthorizedScopeTransitionResponse(evaluated, expected)).toBe(true);
    expect(
      isAuthorizedScopeTransitionResponse(evaluated, {
        ...expected,
        scopeKey: 'scope-foreign',
      })
    ).toBe(false);
    expect(
      isAuthorizedScopeTransitionResponse(evaluated, {
        ...expected,
        serverNowMs: Date.parse('2026-08-24T02:05:00Z'),
      })
    ).toBe(false);
  });
});
