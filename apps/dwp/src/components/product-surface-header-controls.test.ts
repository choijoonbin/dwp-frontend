import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import ProductSurfaceHeaderControls from './product-surface-header-controls';

import type { ProductSurfaceNavigationEntry } from './product-surface-header-control-model';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => {
      const copy: Record<string, string> = {
        'productSurface.labels.appManagement': 'App management',
        'productSurface.labels.appManagementForProduct': 'App management: {{product}}',
        'productSurface.labels.currentSurface': 'Current area: {{surface}}',
        'productSurface.labels.managementAreas': 'Management areas',
        'productSurface.labels.managementMode': 'Management mode',
        'productSurface.labels.managementModeCompact': 'Manage',
        'productSurface.labels.returnToWork': 'Return to work',
        'productSurface.labels.returnToWorkForProduct': 'Return to work: {{product}}',
        'productSurface.labels.work': 'Work',
        'productSurface.labels.workAreas': 'Work areas',
      };
      return (copy[key] ?? key).replace(/\{\{(\w+)\}\}/gu, (_, token: string) =>
        String(values?.[token] ?? '')
      );
    },
  }),
}));

const work: ProductSurfaceNavigationEntry = {
  productId: 'approvals',
  surfaceId: 'approvals.work',
  plane: 'work',
  labelKey: 'navigation.groups.approvals.work',
  path: '/approvals/home',
};

const management: ProductSurfaceNavigationEntry = {
  productId: 'approvals',
  surfaceId: 'approvals.admin',
  plane: 'management',
  labelKey: 'navigation.groups.approvals.management',
  path: '/approvals/admin/overview',
};

function renderControls({
  variant,
  currentSurfaceId,
  entries,
}: {
  variant: 'desktop' | 'compact';
  currentSurfaceId: string;
  entries: readonly ProductSurfaceNavigationEntry[];
}) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(ProductSurfaceHeaderControls, {
        variant,
        currentSurfaceId,
        entries,
        label: 'App area switcher',
        productLabel: 'Approvals',
        resolveLabel: (labelKey) => labelKey,
      })
    )
  );
}

describe('ProductSurfaceHeaderControls', () => {
  it('keeps a compact Management token without exposing an empty navigation group', () => {
    const markup = renderControls({
      variant: 'compact',
      currentSurfaceId: management.surfaceId,
      entries: [management],
    });

    expect(markup).toContain('data-testid="product-surface-management-mode"');
    expect(markup).toContain('data-testid="product-surface-management-mode-compact-label"');
    expect(markup).toContain('>Manage</span>');
    expect(markup).not.toContain('role="group"');
    expect(markup).not.toContain('role="navigation"');
    expect(markup).not.toContain('aria-label="App area switcher"');
    expect(markup).not.toContain('data-testid="product-surface-work-return"');
  });

  it('labels compact navigation only when a Work return actually exists', () => {
    const markup = renderControls({
      variant: 'compact',
      currentSurfaceId: management.surfaceId,
      entries: [{ ...work, entryKind: 'work-return' }, management],
    });

    expect(markup).toContain('<nav');
    expect(markup).toContain('aria-label="App area switcher"');
    expect(markup).toContain('data-testid="product-surface-management-mode-compact-label"');
    expect(markup).toContain('data-testid="product-surface-work-return"');
    expect(markup).toContain('aria-label="Return to work: Approvals"');
    expect(markup).toContain('>Work</span>');
    expect(markup).toContain('href="/approvals/home"');
  });

  it('keeps Work free of Management state and exposes one direct App management link', () => {
    const markup = renderControls({
      variant: 'compact',
      currentSurfaceId: work.surfaceId,
      entries: [work, { ...management, entryKind: 'management-entry' }],
    });

    expect(markup).toContain('<nav');
    expect(markup).toContain('aria-label="App area switcher"');
    expect(markup).not.toContain('data-testid="product-surface-management-mode"');
    expect(markup).toContain('data-testid="product-surface-management-entry"');
    expect(markup).toContain('aria-label="App management: Approvals"');
    expect(markup).toContain('>Manage</span>');
    expect(markup).toContain('href="/approvals/admin/overview"');
    expect(markup).not.toContain('data-testid="product-surface-mobile-disclosure"');
  });

  it('keeps the full Management mode label in desktop navigation', () => {
    const markup = renderControls({
      variant: 'desktop',
      currentSurfaceId: management.surfaceId,
      entries: [{ ...work, entryKind: 'work-return' }, management],
    });

    expect(markup).toContain('<nav');
    expect(markup).toContain('aria-label="App area switcher"');
    expect(markup).toContain('>Management mode</span>');
    expect(markup).not.toContain('product-surface-management-mode-compact-label');
  });
});
