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

  it.each([
    ['communications', 'communications.management', ['admin', 'announcements']],
    ['services', 'services.management', ['admin', 'services', 'catalog']],
  ] as const)(
    'aborts and removes %s non-default-scope queries by exact surface meta',
    async (productId, surfaceId, prefix) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const queryKey = [...prefix, 'scope:non-default', 'revision-direct'];
      let markStarted: (() => void) | undefined;
      const started = new Promise<void>((resolve) => {
        markStarted = resolve;
      });
      let aborted = false;
      const inFlight = queryClient
        .fetchQuery({
          queryKey,
          meta: { accessSensitive: true, productId, surfaceId },
          queryFn: ({ signal }) => {
            markStarted?.();
            return new Promise<never>((_resolve, reject) => {
              signal.addEventListener(
                'abort',
                () => {
                  aborted = true;
                  reject(new DOMException('Scope changed', 'AbortError'));
                },
                { once: true }
              );
            });
          },
        })
        .catch(() => undefined);

      await started;
      const matches = (query: {
        queryKey: readonly unknown[];
        meta?: Readonly<Record<string, unknown>>;
      }) => isProductAccessSensitiveQuery(query, productId, surfaceId);
      await queryClient.cancelQueries({ predicate: matches });
      queryClient.removeQueries({ predicate: matches });
      await inFlight;

      expect(aborted).toBe(true);
      expect(queryClient.getQueryCache().find({ queryKey })).toBeUndefined();
    }
  );

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
