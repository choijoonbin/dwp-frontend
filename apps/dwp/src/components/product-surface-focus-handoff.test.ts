// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearProductSurfaceFocus,
  clearProductSurfaceFocusAfterNavigation,
  consumeRemovedProductSurfaceFocus,
  deferProductSurfaceFocusClear,
  recordProductSurfaceFocus,
  synchronizeProductSurfaceFocus,
} from './product-surface-focus-handoff';

function focusedSurfaceControl() {
  const container = document.createElement('div');
  const control = document.createElement('button');
  document.body.append(container);
  container.append(control);
  control.focus();
  return { container, control };
}

afterEach(() => {
  clearProductSurfaceFocus();
  vi.useRealTimers();
  document.body.replaceChildren();
  history.replaceState(null, '', '/');
});

describe('product surface focus handoff provenance', () => {
  it('consumes a removed control only for the same URL, plane, and authenticated identity', () => {
    history.replaceState(null, '', '/approvals/admin/overview');
    const { container, control } = focusedSurfaceControl();
    recordProductSurfaceFocus(
      container,
      control,
      'management',
      'TENANT:1:11',
      '/approvals/admin/overview'
    );
    control.remove();

    expect(consumeRemovedProductSurfaceFocus('management', 'TENANT:1:11')).toBe('management');
  });

  it('clears disconnected provenance across navigation before returning to the old URL', () => {
    history.replaceState(null, '', '/approvals/admin/overview');
    const { container, control } = focusedSurfaceControl();
    recordProductSurfaceFocus(
      container,
      control,
      'management',
      'TENANT:1:11',
      '/approvals/admin/overview'
    );
    control.remove();
    history.replaceState(null, '', '/apps');
    clearProductSurfaceFocusAfterNavigation('/approvals/admin/overview');
    history.replaceState(null, '', '/approvals/admin/overview');

    expect(consumeRemovedProductSurfaceFocus('management', 'TENANT:1:11')).toBeUndefined();
  });

  it('does not retarget connected provenance across a route or plane transition', () => {
    history.replaceState(null, '', '/approvals/admin/overview');
    const { container, control } = focusedSurfaceControl();
    recordProductSurfaceFocus(
      container,
      control,
      'management',
      'TENANT:1:11',
      '/approvals/admin/overview'
    );

    history.replaceState(null, '', '/approvals/home');
    synchronizeProductSurfaceFocus(container, 'work', 'TENANT:1:11', '/approvals/home');
    control.remove();
    history.replaceState(null, '', '/approvals/admin/overview');

    expect(consumeRemovedProductSurfaceFocus('management', 'TENANT:1:11')).toBeUndefined();
  });

  it('rejects stale provenance from another identity without stealing connected focus', () => {
    history.replaceState(null, '', '/approvals/admin/overview');
    const { container, control } = focusedSurfaceControl();
    recordProductSurfaceFocus(
      container,
      control,
      'management',
      'TENANT:1:11',
      '/approvals/admin/overview'
    );
    control.remove();
    const persistent = document.createElement('button');
    document.body.append(persistent);
    persistent.focus();

    expect(consumeRemovedProductSurfaceFocus('management', 'TENANT:1:12')).toBeUndefined();
    expect(document.activeElement).toBe(persistent);
  });

  it('preserves provenance when an authority transition emits a null-target blur', () => {
    history.replaceState(null, '', '/approvals/admin/overview');
    const { container, control } = focusedSurfaceControl();
    recordProductSurfaceFocus(
      container,
      control,
      'management',
      'TENANT:1:11',
      '/approvals/admin/overview'
    );
    deferProductSurfaceFocusClear(container, control, null);
    container.remove();

    expect(consumeRemovedProductSurfaceFocus('management', 'TENANT:1:11')).toBe('management');
  });

  it('clears provenance after a real blur to connected content outside the shell', () => {
    history.replaceState(null, '', '/approvals/admin/overview');
    const { container, control } = focusedSurfaceControl();
    const persistent = document.createElement('button');
    document.body.append(persistent);
    recordProductSurfaceFocus(
      container,
      control,
      'management',
      'TENANT:1:11',
      '/approvals/admin/overview'
    );
    deferProductSurfaceFocusClear(container, control, persistent);
    persistent.focus();
    control.remove();

    expect(consumeRemovedProductSurfaceFocus('management', 'TENANT:1:11')).toBeUndefined();
    expect(document.activeElement).toBe(persistent);
  });

  it('preserves provenance when an outside pointer does not move focus', () => {
    vi.useFakeTimers();
    history.replaceState(null, '', '/approvals/admin/overview');
    const { container, control } = focusedSurfaceControl();
    const outside = document.createElement('button');
    document.body.append(outside);
    recordProductSurfaceFocus(
      container,
      control,
      'management',
      'TENANT:1:11',
      '/approvals/admin/overview'
    );
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    vi.runAllTimers();
    container.remove();

    expect(consumeRemovedProductSurfaceFocus('management', 'TENANT:1:11')).toBe('management');
  });

  it('clears provenance after an outside pointer actually moves focus', () => {
    vi.useFakeTimers();
    history.replaceState(null, '', '/approvals/admin/overview');
    const { container, control } = focusedSurfaceControl();
    const outside = document.createElement('button');
    document.body.append(outside);
    recordProductSurfaceFocus(
      container,
      control,
      'management',
      'TENANT:1:11',
      '/approvals/admin/overview'
    );
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    outside.focus();
    vi.runAllTimers();
    control.remove();

    expect(consumeRemovedProductSurfaceFocus('management', 'TENANT:1:11')).toBeUndefined();
    expect(document.activeElement).toBe(outside);
  });

  it('clears provenance after an outside pointer actually returns focus to the document body', () => {
    vi.useFakeTimers();
    history.replaceState(null, '', '/approvals/admin/overview');
    const { container, control } = focusedSurfaceControl();
    recordProductSurfaceFocus(
      container,
      control,
      'management',
      'TENANT:1:11',
      '/approvals/admin/overview'
    );
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    control.blur();
    vi.runAllTimers();
    control.remove();

    expect(document.activeElement).toBe(document.body);
    expect(consumeRemovedProductSurfaceFocus('management', 'TENANT:1:11')).toBeUndefined();
  });
});
