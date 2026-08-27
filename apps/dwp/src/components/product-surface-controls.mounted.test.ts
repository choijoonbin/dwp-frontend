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
      })[key] ?? key,
  }),
}));

import {
  SurfaceExpiryIndicator,
  type ProductSurfaceLayoutRuntime,
} from './product-surface-controls';

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
