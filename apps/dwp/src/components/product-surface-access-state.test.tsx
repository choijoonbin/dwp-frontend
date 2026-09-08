import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ProductSurfaceAccessState } from './product-surface-access-state';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { correlationId?: string }) =>
      values?.correlationId ? `${key}: ${values.correlationId}` : key,
  }),
}));

describe('ProductSurfaceAccessState', () => {
  it('keeps the correlation id visible for permission states and exposes responsibility actions', () => {
    const markup = renderToStaticMarkup(
      <ProductSurfaceAccessState
        decision={{ state: 'route-denied', detail: { correlationId: 'correlation-route-1' } }}
        actions={{ 'request-responsibility': () => undefined, return: () => undefined }}
      />
    );

    expect(markup).toContain('productSurface.access.correlationId: correlation-route-1');
    expect(markup).toContain('productSurface.actions.requestResponsibility');
    expect(markup).toContain('productSurface.actions.return');
  });

  it('renders authority correlation ids through the stable local-error support slot', () => {
    const markup = renderToStaticMarkup(
      <ProductSurfaceAccessState
        decision={{
          state: 'authority-unavailable',
          detail: { correlationId: 'correlation-authority-1' },
        }}
        actions={{ retry: () => undefined, return: () => undefined }}
      />
    );

    expect(markup).toContain('productSurface.access.correlationId: correlation-authority-1');
    expect(markup).toContain('productSurface.actions.retry');
    expect(markup).toContain('productSurface.actions.return');
  });

  it('uses one stable main and H1 for a top-level permission state', () => {
    const markup = renderToStaticMarkup(
      <ProductSurfaceAccessState
        decision={{ state: 'surface-denied' }}
        plane="management"
        pageLevel
      />
    );

    expect(markup.match(/<main\b/gu)).toHaveLength(1);
    expect(markup).toContain('<main id="dwp-main-content"');
    expect(markup.match(/<h1\b/gu)).toHaveLength(1);
    expect(markup).not.toContain('<h2');
    expect(markup).toContain('productSurface.access.surfaceDenied.management.title');
  });

  it('uses one stable main and H1 for a top-level authority error', () => {
    const markup = renderToStaticMarkup(
      <ProductSurfaceAccessState decision={{ state: 'authority-unavailable' }} pageLevel />
    );

    expect(markup.match(/<main\b/gu)).toHaveLength(1);
    expect(markup).toContain('<main id="dwp-main-content"');
    expect(markup.match(/<h1\b/gu)).toHaveLength(1);
    expect(markup).not.toContain('<h2');
    expect(markup).toContain('role="alert"');
  });

  it('keeps item-level access states as H2 sections without nesting a main landmark', () => {
    const markup = renderToStaticMarkup(
      <ProductSurfaceAccessState decision={{ state: 'route-denied' }} />
    );

    expect(markup).not.toContain('<main');
    expect(markup).not.toContain('<h1');
    expect(markup.match(/<h2\b/gu)).toHaveLength(1);
  });
});
