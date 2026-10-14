// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'productSurface.expiry.warning': 'Management access will be revalidated within 5 minutes',
        'productSurface.expiry.warningCompact': '≤5 min',
        'productSurface.expiry.revalidating': 'Management access is being revalidated',
        'productSurface.expiry.revalidatingCompact': 'Checking',
        'productSurface.labels.managementScope': 'Management scope',
        'productSurface.contextBar.label': 'Product context',
      })[key] ?? key,
  }),
}));

import {
  ProductSurfaceContextBar,
  SurfaceExpiryIndicator,
  type ProductSurfaceLayoutRuntime,
} from './product-surface-controls';
import type { EffectiveScope } from '../features/shell/product-surface-context';

let host!: HTMLDivElement;
let root!: Root;

function runtime({
  decisionRevision,
  serverNow,
  revalidateAt,
}: {
  decisionRevision: string;
  serverNow: string;
  revalidateAt: string;
}): ProductSurfaceLayoutRuntime {
  return {
    decision: {
      context: { plane: 'management' },
      decisionRevision,
      revalidateAt,
    },
    label: 'Approvals management',
    serverNowMs: Date.parse(serverNow),
  } as ProductSurfaceLayoutRuntime;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe('mounted management surface expiry indicator', () => {
  it('drops inherited elapsed time immediately after an authority clock refresh', () => {
    act(() =>
      root.render(
        createElement(SurfaceExpiryIndicator, {
          compact: true,
          runtime: runtime({
            decisionRevision: 'revision-1',
            serverNow: '2026-08-24T01:00:00Z',
            revalidateAt: '2026-08-24T01:10:00Z',
          }),
        })
      )
    );

    expect(host.querySelector('[data-testid="product-surface-expiry-status"]')).toBeNull();
    act(() => vi.advanceTimersByTime(5 * 60_000));
    expect(host.querySelector('[data-testid="product-surface-expiry-status"]')).not.toBeNull();

    act(() =>
      root.render(
        createElement(SurfaceExpiryIndicator, {
          compact: true,
          runtime: runtime({
            decisionRevision: 'revision-2',
            serverNow: '2026-08-24T01:08:00Z',
            revalidateAt: '2026-08-24T01:18:00Z',
          }),
        })
      )
    );

    expect(host.querySelector('[data-testid="product-surface-expiry-status"]')).toBeNull();
  });
});

describe('mounted management scope control', () => {
  const serverNowMs = Date.parse('2026-10-13T05:00:00Z');
  const scopes: readonly EffectiveScope[] = [
    {
      key: 'tenant',
      kind: 'TENANT',
      displayName: 'TENANT',
      isDefault: true,
      readOnly: false,
    },
    {
      key: 'division-a',
      kind: 'TARGET_POPULATION',
      displayName: 'Division A',
      isDefault: false,
      readOnly: false,
    },
    {
      key: 'expired',
      kind: 'TARGET_POPULATION',
      displayName: 'Expired division',
      isDefault: false,
      readOnly: true,
      validUntil: '2026-10-13T04:59:59Z',
    },
  ];

  function contextRuntime(
    availableScopes: readonly EffectiveScope[],
    onScopeChange?: (scopeKey: string) => void
  ): ProductSurfaceLayoutRuntime {
    const selectedScope = availableScopes[0]!;
    const revalidateAt = '2026-10-13T05:30:00Z';
    return {
      decision: {
        state: 'allowed',
        context: {
          contextKey: 'hcm-management',
          productKey: 'hcm',
          surfaceKey: 'hcm.management',
          plane: 'management',
          accessMode: 'NORMAL',
          accessSource: 'MANAGEMENT',
          appResourceKey: 'APP.HRIS',
          effectiveGrants: [],
          scopes: availableScopes,
          revalidateAt,
        },
        routeGrantRef: 'route.hcm.management',
        scope: selectedScope,
        effectiveReadOnly: false,
        revalidateAt,
        decisionRevision: 'revision-scope-control',
      },
      label: 'HRIS management',
      serverNowMs,
      availableScopes,
      onScopeChange,
    };
  }

  it('presents multiple scopes as a compact labelled selector and preserves exact switching', () => {
    const onScopeChange = vi.fn();
    act(() =>
      root.render(
        createElement(ProductSurfaceContextBar, {
          runtime: contextRuntime(scopes, onScopeChange),
        })
      )
    );

    const wrapper = host.querySelector('[data-testid="product-surface-multi-scope"]');
    const selector = wrapper?.querySelector('select');
    expect(wrapper?.textContent).toContain('Management scope:');
    expect(selector?.getAttribute('aria-label')).toBe('Management scope');
    expect(selector?.getAttribute('title')).toBe('TENANT');
    expect(selector?.value).toBe('tenant');
    expect(selector?.querySelector<HTMLOptionElement>('option[value="expired"]')?.disabled).toBe(
      true
    );

    act(() => {
      if (!selector) throw new Error('Expected management scope selector.');
      selector.value = 'division-a';
      selector.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onScopeChange).toHaveBeenCalledOnce();
    expect(onScopeChange).toHaveBeenCalledWith('division-a');
  });

  it('keeps the single-scope header label non-selectable and semantically consistent', () => {
    act(() =>
      root.render(
        createElement(ProductSurfaceContextBar, {
          runtime: contextRuntime(scopes.slice(0, 1)),
        })
      )
    );

    const disclosure = host.querySelector('[data-testid="product-surface-single-scope"]');
    expect(disclosure?.getAttribute('aria-label')).toBe('Management scope: TENANT');
    expect(disclosure?.textContent).toBe('Management scope: TENANT');
    expect(host.querySelector('select')).toBeNull();
  });
});
