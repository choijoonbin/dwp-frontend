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
});
