import type { QueryClient } from '@tanstack/react-query';

import type { ProductAccessMode } from './product-surface-context';

export type ProductSurfaceCacheIdentity = {
  tenantId: string;
  actorId: string;
  accessMode: ProductAccessMode;
  productId: string;
  surfaceId: string;
  contextScopeKey: string;
  decisionRevision: string;
};

export type ProductSurfaceAccessSensitiveMeta = ProductSurfaceCacheIdentity & {
  accessSensitive: true;
};

export type ProductSurfaceRevisionIdentity = Pick<
  ProductSurfaceCacheIdentity,
  'tenantId' | 'actorId' | 'accessMode'
>;

export type ProductSurfaceRevisionMessage = ProductSurfaceRevisionIdentity & {
  type: 'product-surface-revision-changed';
  decisionRevision: string;
  senderId: string;
};

export type ProductSurfaceRevisionChannel = {
  publish: (decisionRevision: string) => void;
  close: () => void;
};

type BroadcastChannelLike = {
  postMessage: (message: ProductSurfaceRevisionMessage) => void;
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<ProductSurfaceRevisionMessage>) => void
  ) => void;
  removeEventListener: (
    type: 'message',
    listener: (event: MessageEvent<ProductSurfaceRevisionMessage>) => void
  ) => void;
  close: () => void;
};

const SENSITIVE_QUERY_PREFIX = 'product-surface-sensitive';
const REVISION_CHANNEL_NAME = 'dwp:product-surface:revision:v1';

function assertOpaqueCacheValue(value: string, field: string): void {
  if (!value.trim()) throw new Error(`Product surface ${field} is required.`);
}

export function createProductSurfaceQueryContract(
  identity: ProductSurfaceCacheIdentity,
  resourceKey: string,
  ...keyParts: readonly unknown[]
): {
  queryKey: readonly unknown[];
  meta: ProductSurfaceAccessSensitiveMeta;
} {
  Object.entries(identity).forEach(([field, value]) => assertOpaqueCacheValue(value, field));
  assertOpaqueCacheValue(resourceKey, 'resourceKey');
  return {
    queryKey: [
      SENSITIVE_QUERY_PREFIX,
      identity.tenantId,
      identity.actorId,
      identity.accessMode,
      identity.productId,
      identity.surfaceId,
      identity.contextScopeKey,
      identity.decisionRevision,
      resourceKey,
      ...keyParts,
    ],
    meta: { accessSensitive: true, ...identity },
  };
}

function isSensitiveQueryForRevisionIdentity(
  query: { queryKey: readonly unknown[]; meta?: Readonly<Record<string, unknown>> },
  identity: ProductSurfaceRevisionIdentity
): boolean {
  const meta = query.meta;
  return Boolean(
    query.queryKey[0] === SENSITIVE_QUERY_PREFIX &&
    meta?.accessSensitive === true &&
    meta.tenantId === identity.tenantId &&
    meta.actorId === identity.actorId &&
    meta.accessMode === identity.accessMode
  );
}

export async function invalidateProductSurfaceAccess({
  queryClient,
  identity,
  clearContent,
  clearLastRoute,
  refetchContext,
}: {
  queryClient: QueryClient;
  identity: ProductSurfaceRevisionIdentity;
  clearContent: () => void;
  clearLastRoute: () => void;
  refetchContext: () => Promise<unknown>;
}): Promise<void> {
  const errors: unknown[] = [];
  try {
    await queryClient.cancelQueries({
      predicate: (query) => isSensitiveQueryForRevisionIdentity(query, identity),
    });
  } catch (error) {
    errors.push(error);
  }
  try {
    clearContent();
  } catch (error) {
    errors.push(error);
  }
  try {
    queryClient.removeQueries({
      predicate: (query) => isSensitiveQueryForRevisionIdentity(query, identity),
    });
  } catch (error) {
    errors.push(error);
  }
  try {
    clearLastRoute();
  } catch (error) {
    errors.push(error);
  }
  try {
    await refetchContext();
  } catch (error) {
    errors.push(error);
  }
  if (errors.length > 0)
    throw new AggregateError(errors, 'Product surface access invalidation failed.');
}

export async function transitionProductSurfaceScope({
  cancelInFlight,
  clearContent,
  pushScopeUrl,
  rollbackScopeUrl,
  startScopeQuery,
}: {
  cancelInFlight: () => Promise<unknown>;
  clearContent: () => void;
  pushScopeUrl: () => void;
  rollbackScopeUrl?: () => void;
  startScopeQuery: () => Promise<unknown>;
}): Promise<void> {
  let cancellationError: unknown;
  try {
    await cancelInFlight();
  } catch (error) {
    cancellationError = error;
  }
  clearContent();
  if (cancellationError) throw cancellationError;
  pushScopeUrl();
  try {
    await startScopeQuery();
  } catch (error) {
    rollbackScopeUrl?.();
    throw error;
  }
}

function isRevisionMessage(
  value: unknown,
  identity: ProductSurfaceRevisionIdentity,
  senderId: string,
  currentDecisionRevision: () => string
): value is ProductSurfaceRevisionMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<ProductSurfaceRevisionMessage>;
  return (
    message.type === 'product-surface-revision-changed' &&
    message.tenantId === identity.tenantId &&
    message.actorId === identity.actorId &&
    message.accessMode === identity.accessMode &&
    Boolean(message.decisionRevision?.trim()) &&
    message.decisionRevision !== currentDecisionRevision() &&
    message.senderId !== senderId
  );
}

export function createProductSurfaceRevisionChannel({
  identity,
  senderId,
  currentDecisionRevision,
  onRevision,
  channelFactory,
}: {
  identity: ProductSurfaceRevisionIdentity;
  senderId: string;
  currentDecisionRevision: () => string;
  onRevision: (message: ProductSurfaceRevisionMessage) => void;
  channelFactory?: (name: string) => BroadcastChannelLike;
}): ProductSurfaceRevisionChannel {
  assertOpaqueCacheValue(identity.tenantId, 'tenantId');
  assertOpaqueCacheValue(identity.actorId, 'actorId');
  assertOpaqueCacheValue(senderId, 'senderId');
  const factory =
    channelFactory ??
    ((name: string) => {
      if (typeof BroadcastChannel === 'undefined') {
        return {
          postMessage: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          close: () => undefined,
        };
      }
      return new BroadcastChannel(name) as BroadcastChannelLike;
    });
  const channel = factory(REVISION_CHANNEL_NAME);
  const listener = (event: MessageEvent<ProductSurfaceRevisionMessage>) => {
    if (isRevisionMessage(event.data, identity, senderId, currentDecisionRevision)) {
      onRevision(event.data);
    }
  };
  channel.addEventListener('message', listener);
  return {
    publish: (decisionRevision) => {
      assertOpaqueCacheValue(decisionRevision, 'decisionRevision');
      channel.postMessage({
        type: 'product-surface-revision-changed',
        tenantId: identity.tenantId,
        actorId: identity.actorId,
        accessMode: identity.accessMode,
        decisionRevision,
        senderId,
      });
    },
    close: () => {
      channel.removeEventListener('message', listener);
      channel.close();
    },
  };
}

export function shouldRetryProductSurfaceRequest(
  method: string,
  completedRetries: number
): boolean {
  return completedRetries === 0 && ['GET', 'HEAD'].includes(method.toUpperCase());
}

export function withProductSurfaceMutationContext<Payload extends object>(
  payload: Payload,
  context: { contextScopeKey: string; expectedDecisionRevision: string }
): Payload & { contextScopeKey: string; expectedDecisionRevision: string } {
  assertOpaqueCacheValue(context.contextScopeKey, 'contextScopeKey');
  assertOpaqueCacheValue(context.expectedDecisionRevision, 'expectedDecisionRevision');
  return { ...payload, ...context };
}

export function calculateServerClockOffset(generatedAt: string, receivedAtMs = Date.now()): number {
  const serverTime = Date.parse(generatedAt);
  return Number.isFinite(serverTime) ? serverTime - receivedAtMs : 0;
}

export function productSurfaceServerNow(clockOffsetMs: number, clientNowMs = Date.now()): number {
  return clientNowMs + clockOffsetMs;
}
