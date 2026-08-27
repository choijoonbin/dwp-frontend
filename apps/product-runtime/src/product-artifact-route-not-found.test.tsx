import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { ProductApplicationRuntime } from '../../dwp/src/components/product-application-runtime';
import {
  ProductArtifactRouteNotFound,
  resolveProductArtifactHomePath,
} from './product-artifact-route-not-found';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

function runtime(
  applicationId: string,
  productManifests: ProductApplicationRuntime['productManifests'] = []
): ProductApplicationRuntime {
  return { applicationId, productManifests } as ProductApplicationRuntime;
}

describe('product artifact not-found recovery', () => {
  it('resolves shell applications and mounted work surfaces to canonical homes', () => {
    expect(resolveProductArtifactHomePath(runtime('workspace'))).toBe('/work/home');
    expect(resolveProductArtifactHomePath(runtime('account'))).toBe('/account');
    expect(
      resolveProductArtifactHomePath({
        applicationId: 'hcm',
        productManifests: [
          {
            surfaces: [
              { plane: 'management', indexPath: '/hr/admin' },
              { plane: 'work', indexPath: '/hr/home' },
            ],
          },
        ],
      })
    ).toBe('/hr/home');
  });

  it('renders a skip-link target, primary heading, and canonical recovery actions', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <ProductArtifactRouteNotFound runtime={runtime('workspace')} />
      </MemoryRouter>
    );

    expect(markup).toContain('<main id="dwp-main-content" tabindex="-1"');
    expect(markup).toContain('<h1');
    expect(markup).toContain('productSurface.notFound.title');
    expect(markup).toContain('productSurface.notFound.productHome');
    expect(markup).toContain('productSurface.notFound.dwpHome');
  });
});
