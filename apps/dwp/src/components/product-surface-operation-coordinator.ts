export type ProductSurfaceOperationTarget = Readonly<{
  productKey: string;
  surfaceKey: string;
}>;

export type ProductSurfaceOperationIdentity = ProductSurfaceOperationTarget &
  Readonly<{
    tenantId: string;
    actorId: string;
    accessMode: string;
    contextKey: string;
    contextScopeKey: string;
    decisionRevision: string;
  }>;

type OperationPhase = 'PRE_FLIGHT' | 'DISPATCHED' | 'FINISHED';

type SurfaceState = {
  epoch: number;
  observedIdentity?: ProductSurfaceOperationIdentity;
  expectedScopeKey?: string;
  preflight: Map<symbol, AbortController>;
  dispatched: Set<symbol>;
  transition?: { token: symbol; controller: AbortController };
};

export class ProductSurfaceOperationCancelledError extends Error {
  constructor() {
    super('Product surface operation was cancelled because its authority context changed.');
    this.name = 'ProductSurfaceOperationCancelledError';
  }
}

export function isProductSurfaceOperationCancelledError(error: unknown): boolean {
  return error instanceof ProductSurfaceOperationCancelledError;
}

export type ProductSurfaceOperationTicket = Readonly<{
  epoch: number;
  signal: AbortSignal;
  assertCurrent: () => void;
  markDispatched: () => void;
  markPreflight: () => void;
  cancel: () => void;
  finish: () => void;
}>;

export type ProductSurfaceTransitionTicket = Readonly<{
  state: 'READY';
  epoch: number;
  signal: AbortSignal;
  abortedPreflightCount: number;
  assertCurrent: () => void;
  isCurrent: () => boolean;
  finish: (completed: boolean) => void;
}>;

export type ProductSurfaceTransitionBlocked = Readonly<{
  state: 'BLOCKED';
  dispatchedCount: number;
}>;

function targetKey(target: ProductSurfaceOperationTarget): string {
  return `${target.productKey}\u0000${target.surfaceKey}`;
}

function sameIdentity(
  left: ProductSurfaceOperationIdentity,
  right: ProductSurfaceOperationIdentity
): boolean {
  return (
    left.productKey === right.productKey &&
    left.surfaceKey === right.surfaceKey &&
    left.tenantId === right.tenantId &&
    left.actorId === right.actorId &&
    left.accessMode === right.accessMode &&
    left.contextKey === right.contextKey &&
    left.contextScopeKey === right.contextScopeKey &&
    left.decisionRevision === right.decisionRevision
  );
}

function sameIdentityExceptScope(
  left: ProductSurfaceOperationIdentity,
  right: ProductSurfaceOperationIdentity
): boolean {
  return sameIdentity({ ...left, contextScopeKey: right.contextScopeKey }, right);
}

export class ProductSurfaceOperationCoordinator {
  private readonly states = new Map<string, SurfaceState>();

  private state(target: ProductSurfaceOperationTarget): SurfaceState {
    const key = targetKey(target);
    const existing = this.states.get(key);
    if (existing) return existing;
    const created: SurfaceState = {
      epoch: 0,
      preflight: new Map(),
      dispatched: new Set(),
    };
    this.states.set(key, created);
    return created;
  }

  observeIdentity(identity: ProductSurfaceOperationIdentity): void {
    const state = this.state(identity);
    const previous = state.observedIdentity;
    if (!previous) {
      state.observedIdentity = identity;
      if (state.expectedScopeKey === identity.contextScopeKey) {
        state.expectedScopeKey = undefined;
      }
      return;
    }
    if (sameIdentity(previous, identity)) return;
    if (
      state.expectedScopeKey === identity.contextScopeKey &&
      sameIdentityExceptScope(previous, identity)
    ) {
      state.observedIdentity = identity;
      state.expectedScopeKey = undefined;
      return;
    }
    state.observedIdentity = identity;
    state.expectedScopeKey = undefined;
    this.invalidate(state);
  }

  observeNavigation(target: ProductSurfaceOperationTarget, requestedScopeKey: string | null): void {
    const state = this.state(target);
    if (state.expectedScopeKey && state.expectedScopeKey === requestedScopeKey) return;
    state.expectedScopeKey = undefined;
    this.invalidate(state);
  }

  observeAuthorityUnavailable(target: ProductSurfaceOperationTarget): void {
    const state = this.state(target);
    state.observedIdentity = undefined;
    if (state.transition !== undefined || state.expectedScopeKey !== undefined) {
      this.abortPreflight(state);
      return;
    }
    this.invalidate(state);
  }

  beginOperation(target: ProductSurfaceOperationTarget): ProductSurfaceOperationTicket {
    const state = this.state(target);
    if (state.expectedScopeKey !== undefined || state.transition !== undefined) {
      throw new ProductSurfaceOperationCancelledError();
    }
    const token = Symbol('product-surface-operation');
    const controller = new AbortController();
    const epoch = state.epoch;
    let phase: OperationPhase = 'PRE_FLIGHT';
    state.preflight.set(token, controller);

    const isCurrent = () =>
      phase !== 'FINISHED' && state.epoch === epoch && !controller.signal.aborted;
    const assertCurrent = () => {
      if (!isCurrent()) throw new ProductSurfaceOperationCancelledError();
    };
    const finish = () => {
      if (phase === 'FINISHED') return;
      state.preflight.delete(token);
      state.dispatched.delete(token);
      phase = 'FINISHED';
    };

    return {
      epoch,
      signal: controller.signal,
      assertCurrent,
      markDispatched: () => {
        assertCurrent();
        state.preflight.delete(token);
        state.dispatched.add(token);
        phase = 'DISPATCHED';
      },
      markPreflight: () => {
        if (phase !== 'DISPATCHED') {
          assertCurrent();
          return;
        }
        if (state.epoch !== epoch || controller.signal.aborted) {
          finish();
          throw new ProductSurfaceOperationCancelledError();
        }
        state.dispatched.delete(token);
        state.preflight.set(token, controller);
        phase = 'PRE_FLIGHT';
      },
      cancel: () => {
        if (phase === 'DISPATCHED') return;
        if (!controller.signal.aborted) controller.abort('product-surface-context-changed');
        finish();
      },
      finish,
    };
  }

  beginScopeTransition(
    target: ProductSurfaceOperationTarget,
    expectedScopeKey: string
  ): ProductSurfaceTransitionTicket | ProductSurfaceTransitionBlocked {
    const state = this.state(target);
    if (state.dispatched.size > 0) {
      return { state: 'BLOCKED', dispatchedCount: state.dispatched.size };
    }
    const abortedPreflightCount = state.preflight.size;
    this.invalidate(state);
    const token = Symbol('product-surface-transition');
    const controller = new AbortController();
    const epoch = state.epoch;
    state.expectedScopeKey = expectedScopeKey;
    state.transition = { token, controller };
    const isCurrent = () =>
      state.epoch === epoch && state.transition?.token === token && !controller.signal.aborted;
    const assertCurrent = () => {
      if (!isCurrent()) throw new ProductSurfaceOperationCancelledError();
    };
    return {
      state: 'READY',
      epoch,
      signal: controller.signal,
      abortedPreflightCount,
      assertCurrent,
      isCurrent,
      finish: (completed) => {
        if (state.transition?.token === token) state.transition = undefined;
        if (!completed && state.expectedScopeKey === expectedScopeKey) {
          state.expectedScopeKey = undefined;
        }
      },
    };
  }

  resetForTest(): void {
    for (const state of this.states.values()) {
      this.abortPreflight(state);
      state.transition?.controller.abort('test-reset');
    }
    this.states.clear();
  }

  private abortPreflight(state: SurfaceState): void {
    for (const controller of state.preflight.values()) {
      if (!controller.signal.aborted) controller.abort('product-surface-context-changed');
    }
    state.preflight.clear();
  }

  private invalidate(state: SurfaceState): void {
    state.epoch += 1;
    this.abortPreflight(state);
    state.transition?.controller.abort('product-surface-context-changed');
    state.transition = undefined;
  }
}

export const productSurfaceOperationCoordinator = new ProductSurfaceOperationCoordinator();

export function sameProductSurfaceOperationIdentity(
  left: ProductSurfaceOperationIdentity | null,
  right: ProductSurfaceOperationIdentity
): boolean {
  return Boolean(left && sameIdentity(left, right));
}
