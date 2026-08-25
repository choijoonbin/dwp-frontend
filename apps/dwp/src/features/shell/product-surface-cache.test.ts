import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import {
  calculateServerClockOffset,
  createProductSurfaceQueryContract,
  createProductSurfaceRevisionChannel,
  invalidateProductSurfaceAccess,
  productSurfaceServerNow,
  shouldRetryProductSurfaceRequest,
  transitionProductSurfaceScope,
  withProductSurfaceMutationContext,
} from './product-surface-cache';

import type { ProductSurfaceRevisionMessage } from './product-surface-cache';

const identity = {
  tenantId: 'tenant-1',
  actorId: 'actor-1',
  accessMode: 'NORMAL' as const,
  productId: 'example',
  surfaceId: 'example.admin',
  contextScopeKey: 'scope-1',
  decisionRevision: 'revision-1',
};

describe('product surface sensitive cache', () => {
  it('binds every sensitive key and meta record to tenant, actor, surface, scope, and revision', () => {
    expect(createProductSurfaceQueryContract(identity, 'policies', 'ACTIVE')).toEqual({
      queryKey: [
        'product-surface-sensitive',
        'tenant-1',
        'actor-1',
        'NORMAL',
        'example',
        'example.admin',
        'scope-1',
        'revision-1',
        'policies',
        'ACTIVE',
      ],
      meta: { accessSensitive: true, ...identity },
    });
  });

  it('invalidates in the required cancel, clear, remove, last-route, refetch order', async () => {
    const queryClient = new QueryClient();
    const contract = createProductSurfaceQueryContract(identity, 'policies');
    queryClient.setQueryData(contract.queryKey, ['secret'], { updatedAt: 1 });
    const query = queryClient.getQueryCache().find({ queryKey: contract.queryKey });
    if (query) query.setOptions({ ...query.options, meta: contract.meta });
    const order: string[] = [];
    const originalCancel = queryClient.cancelQueries.bind(queryClient);
    const originalRemove = queryClient.removeQueries.bind(queryClient);
    queryClient.cancelQueries = async (filters) => {
      order.push('cancel');
      return originalCancel(filters);
    };
    queryClient.removeQueries = (filters) => {
      order.push('remove');
      return originalRemove(filters);
    };

    await invalidateProductSurfaceAccess({
      queryClient,
      identity,
      clearContent: () => order.push('clear'),
      clearLastRoute: () => order.push('last-route'),
      refetchContext: async () => order.push('refetch'),
    });

    expect(order).toEqual(['cancel', 'clear', 'remove', 'last-route', 'refetch']);
    expect(queryClient.getQueryData(contract.queryKey)).toBeUndefined();
  });

  it('orders scope transitions before any query for the new scope', async () => {
    const order: string[] = [];
    await transitionProductSurfaceScope({
      cancelInFlight: async () => order.push('cancel'),
      clearContent: () => order.push('clear'),
      pushScopeUrl: () => order.push('push-url'),
      startScopeQuery: async () => order.push('query'),
    });
    expect(order).toEqual(['cancel', 'clear', 'push-url', 'query']);
  });

  it('clears old content and aborts the transition when cancellation fails', async () => {
    const order: string[] = [];
    await expect(
      transitionProductSurfaceScope({
        cancelInFlight: async () => {
          order.push('cancel');
          throw new Error('cancel failed');
        },
        clearContent: () => order.push('clear'),
        pushScopeUrl: () => order.push('push-url'),
        startScopeQuery: async () => order.push('query'),
      })
    ).rejects.toThrow(/cancel failed/u);
    expect(order).toEqual(['cancel', 'clear']);
  });

  it('restores the previous URL when the new direct evaluation fails', async () => {
    const order: string[] = [];
    await expect(
      transitionProductSurfaceScope({
        cancelInFlight: async () => order.push('cancel'),
        clearContent: () => order.push('clear'),
        pushScopeUrl: () => order.push('push-url'),
        rollbackScopeUrl: () => order.push('rollback-url'),
        startScopeQuery: async () => {
          order.push('query');
          throw new Error('scope denied');
        },
      })
    ).rejects.toThrow(/scope denied/u);
    expect(order).toEqual(['cancel', 'clear', 'push-url', 'query', 'rollback-url']);
  });
});

describe('product surface revision propagation', () => {
  it('accepts only a new revision for the same tenant, actor, and access mode', () => {
    const posted: ProductSurfaceRevisionMessage[] = [];
    let listener: ((event: MessageEvent<ProductSurfaceRevisionMessage>) => void) | undefined;
    const received: string[] = [];
    const channel = createProductSurfaceRevisionChannel({
      identity,
      senderId: 'tab-a',
      currentDecisionRevision: () => 'revision-1',
      onRevision: (message) => received.push(message.decisionRevision),
      channelFactory: () => ({
        postMessage: (message) => posted.push(message),
        addEventListener: (_type, nextListener) => {
          listener = nextListener;
        },
        removeEventListener: () => undefined,
        close: () => undefined,
      }),
    });
    channel.publish('revision-2');
    expect(posted[0]).toMatchObject({ decisionRevision: 'revision-2', senderId: 'tab-a' });

    listener?.({
      data: { ...posted[0]!, senderId: 'tab-b' },
    } as MessageEvent<ProductSurfaceRevisionMessage>);
    listener?.({
      data: { ...posted[0]!, tenantId: 'other', senderId: 'tab-b' },
    } as MessageEvent<ProductSurfaceRevisionMessage>);
    listener?.({
      data: { ...posted[0]!, decisionRevision: 'revision-1', senderId: 'tab-b' },
    } as MessageEvent<ProductSurfaceRevisionMessage>);
    expect(received).toEqual(['revision-2']);
  });

  it('allows one refreshed retry only for idempotent reads and binds mutation revisions', () => {
    expect(shouldRetryProductSurfaceRequest('GET', 0)).toBe(true);
    expect(shouldRetryProductSurfaceRequest('HEAD', 0)).toBe(true);
    expect(shouldRetryProductSurfaceRequest('GET', 1)).toBe(false);
    expect(shouldRetryProductSurfaceRequest('PUT', 0)).toBe(false);
    expect(
      withProductSurfaceMutationContext(
        { command: 'publish' },
        { contextScopeKey: 'scope-1', expectedDecisionRevision: 'revision-1' }
      )
    ).toEqual({
      command: 'publish',
      contextScopeKey: 'scope-1',
      expectedDecisionRevision: 'revision-1',
    });
  });

  it('derives countdown time from the server-generated clock offset', () => {
    const receivedAt = Date.parse('2026-08-24T00:00:10Z');
    const offset = calculateServerClockOffset('2026-08-24T00:00:00Z', receivedAt);
    expect(offset).toBe(-10_000);
    expect(productSurfaceServerNow(offset, receivedAt + 5_000)).toBe(
      Date.parse('2026-08-24T00:00:05Z')
    );
  });
});
