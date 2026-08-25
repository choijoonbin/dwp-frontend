import { describe, expect, it } from 'vitest';

import {
  ProductSurfaceOperationCancelledError,
  ProductSurfaceOperationCoordinator,
} from './product-surface-operation-coordinator';

const target = { productKey: 'approvals', surfaceKey: 'approvals.admin' } as const;
const identity = {
  ...target,
  tenantId: 'tenant-1',
  actorId: 'actor-1',
  accessMode: 'NORMAL',
  contextKey: 'context-1',
  contextScopeKey: 'scope-a',
  decisionRevision: 'revision-1',
} as const;

describe('product surface operation coordinator', () => {
  it('aborts PRE_FLIGHT work and rejects its stale epoch before a scope transition', () => {
    const coordinator = new ProductSurfaceOperationCoordinator();
    coordinator.observeIdentity(identity);
    const operation = coordinator.beginOperation(target);
    const transition = coordinator.beginScopeTransition(target, 'scope-b');

    expect(transition).toMatchObject({ state: 'READY', abortedPreflightCount: 1 });
    expect(operation.signal.aborted).toBe(true);
    expect(() => operation.assertCurrent()).toThrow(ProductSurfaceOperationCancelledError);
  });

  it('blocks scope transition while a state-changing request is DISPATCHED', () => {
    const coordinator = new ProductSurfaceOperationCoordinator();
    const operation = coordinator.beginOperation(target);
    operation.markDispatched();

    expect(coordinator.beginScopeTransition(target, 'scope-b')).toEqual({
      state: 'BLOCKED',
      dispatchedCount: 1,
    });
    expect(operation.signal.aborted).toBe(false);

    operation.markPreflight();
    expect(coordinator.beginScopeTransition(target, 'scope-b')).toMatchObject({ state: 'READY' });
  });

  it('consumes the expected scope observation without cancelling its own transition', () => {
    const coordinator = new ProductSurfaceOperationCoordinator();
    coordinator.observeIdentity(identity);
    const transition = coordinator.beginScopeTransition(target, 'scope-b');
    if (transition.state !== 'READY') throw new Error('transition should be ready');

    coordinator.observeIdentity({ ...identity, contextScopeKey: 'scope-b' });

    expect(transition.signal.aborted).toBe(false);
    expect(() => transition.assertCurrent()).not.toThrow();
  });

  it('blocks stale-scope operations after transition success until the new identity is observed', () => {
    const coordinator = new ProductSurfaceOperationCoordinator();
    coordinator.observeIdentity(identity);
    const transition = coordinator.beginScopeTransition(target, 'scope-b');
    if (transition.state !== 'READY') throw new Error('transition should be ready');
    transition.finish(true);

    expect(() => coordinator.beginOperation(target)).toThrow(ProductSurfaceOperationCancelledError);

    coordinator.observeIdentity({ ...identity, contextScopeKey: 'scope-b' });
    expect(() => coordinator.beginOperation(target)).not.toThrow();
  });

  it('releases the transition latch when the first observed identity is the expected scope', () => {
    const coordinator = new ProductSurfaceOperationCoordinator();
    const transition = coordinator.beginScopeTransition(target, 'scope-b');
    if (transition.state !== 'READY') throw new Error('transition should be ready');
    transition.finish(true);

    coordinator.observeIdentity({ ...identity, contextScopeKey: 'scope-b' });

    expect(() => coordinator.beginOperation(target)).not.toThrow();
  });

  it('keeps operations blocked until an observed expected-scope transition itself finishes', () => {
    const coordinator = new ProductSurfaceOperationCoordinator();
    coordinator.observeIdentity(identity);
    const transition = coordinator.beginScopeTransition(target, 'scope-b');
    if (transition.state !== 'READY') throw new Error('transition should be ready');

    coordinator.observeIdentity({ ...identity, contextScopeKey: 'scope-b' });
    expect(() => coordinator.beginOperation(target)).toThrow(ProductSurfaceOperationCancelledError);

    transition.finish(true);
    expect(() => coordinator.beginOperation(target)).not.toThrow();
  });

  it('invalidates ABA and revision changes even when the visible scope returns to its old value', () => {
    const coordinator = new ProductSurfaceOperationCoordinator();
    coordinator.observeIdentity(identity);
    const first = coordinator.beginOperation(target);
    coordinator.observeIdentity({ ...identity, contextScopeKey: 'scope-b' });
    coordinator.observeIdentity(identity);
    expect(() => first.assertCurrent()).toThrow(ProductSurfaceOperationCancelledError);

    const second = coordinator.beginOperation(target);
    coordinator.observeIdentity({ ...identity, decisionRevision: 'revision-2' });
    expect(() => second.assertCurrent()).toThrow(ProductSurfaceOperationCancelledError);
  });

  it('aborts preflight authority when the live identity becomes unavailable', () => {
    const coordinator = new ProductSurfaceOperationCoordinator();
    coordinator.observeIdentity(identity);
    const operation = coordinator.beginOperation(target);

    coordinator.observeAuthorityUnavailable(target);

    expect(operation.signal.aborted).toBe(true);
    expect(() => operation.assertCurrent()).toThrow(ProductSurfaceOperationCancelledError);
  });

  it('keeps an expected scope latch fail-closed while route authority is temporarily unavailable', () => {
    const coordinator = new ProductSurfaceOperationCoordinator();
    coordinator.observeIdentity(identity);
    const transition = coordinator.beginScopeTransition(target, 'scope-b');
    if (transition.state !== 'READY') throw new Error('transition should be ready');
    transition.finish(true);

    coordinator.observeAuthorityUnavailable(target);

    expect(() => coordinator.beginOperation(target)).toThrow(ProductSurfaceOperationCancelledError);
  });

  it('isolates operation epochs by product surface', () => {
    const coordinator = new ProductSurfaceOperationCoordinator();
    const operation = coordinator.beginOperation(target);
    coordinator.beginScopeTransition(
      { productKey: 'services', surfaceKey: 'services.management' },
      'service-scope-b'
    );
    expect(() => operation.assertCurrent()).not.toThrow();
  });

  it('invalidates preflight work on direct navigation but preserves an expected scope push', () => {
    const coordinator = new ProductSurfaceOperationCoordinator();
    const directNavigationOperation = coordinator.beginOperation(target);

    coordinator.observeNavigation(target, 'scope-from-history');

    expect(directNavigationOperation.signal.aborted).toBe(true);
    expect(() => directNavigationOperation.assertCurrent()).toThrow(
      ProductSurfaceOperationCancelledError
    );

    const transition = coordinator.beginScopeTransition(target, 'scope-controlled');
    expect(transition.state).toBe('READY');
    if (transition.state !== 'READY') return;

    coordinator.observeNavigation(target, 'scope-controlled');

    expect(transition.signal.aborted).toBe(false);
    expect(() => transition.assertCurrent()).not.toThrow();
  });
});
