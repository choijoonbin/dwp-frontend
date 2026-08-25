import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { transitionProductSurfaceScope } from '../features/shell/product-surface-cache';
import { isProductAccessSensitiveQuery } from '../features/shell/use-product-surface-scope-transition';

const meta = {
  accessSensitive: true,
  tenantId: 'tenant-7',
  actorId: 'actor-9',
  accessMode: 'NORMAL',
  productId: 'hcm',
  surfaceId: 'hcm.operations',
} as const;

function operationsKey(scope: string, directDecisionRevision: string) {
  return [
    'hcm',
    'operations',
    'overview',
    'tenant-7',
    'actor-9',
    'NORMAL',
    'hcm.operations',
    scope,
    directDecisionRevision,
  ] as const;
}

describe('HCM governed read cache', () => {
  it('separates non-default scopes and direct PAGE revisions', () => {
    expect(operationsKey('scope:west', 'psr-direct-a')).not.toEqual(
      operationsKey('scope:east', 'psr-direct-a')
    );
    expect(operationsKey('scope:west', 'psr-direct-a')).not.toEqual(
      operationsKey('scope:west', 'psr-direct-b')
    );
  });

  it('aborts and removes the previous scope request before loading the next scope', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const westKey = operationsKey('scope:west', 'psr-direct-page');
    const eastKey = operationsKey('scope:east', 'psr-direct-page');
    let westSignal: AbortSignal | undefined;
    let markStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const westRequest = queryClient
      .fetchQuery({
        queryKey: westKey,
        meta,
        queryFn: ({ signal }) => {
          westSignal = signal;
          markStarted?.();
          return new Promise<string>((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
          });
        },
      })
      .catch(() => undefined);
    await started;

    await transitionProductSurfaceScope({
      cancelInFlight: () =>
        queryClient.cancelQueries({
          predicate: (query) => isProductAccessSensitiveQuery(query, 'hcm', 'hcm.operations'),
        }),
      clearContent: () =>
        queryClient.removeQueries({
          predicate: (query) => isProductAccessSensitiveQuery(query, 'hcm', 'hcm.operations'),
        }),
      pushScopeUrl: () => undefined,
      startScopeQuery: () =>
        queryClient.fetchQuery({ queryKey: eastKey, meta, queryFn: async () => 'east-data' }),
    });
    await westRequest;

    expect(westSignal?.aborted).toBe(true);
    expect(queryClient.getQueryData(westKey)).toBeUndefined();
    expect(queryClient.getQueryData(eastKey)).toBe('east-data');
  });
});
