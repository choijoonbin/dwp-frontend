import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { GuidedEmptyState } from '@dwp-frontend/design-system/components/states/state-panels';

import type { ProductApplicationRuntime } from '../../dwp/src/components/product-application-runtime';

const APPLICATION_HOME_PATHS: Readonly<Record<string, `/${string}`>> = {
  workspace: '/work/home',
  administration: '/admin',
  provider: '/provider',
  account: '/account',
  'platform-shell': '/',
};

type ProductArtifactRouteRuntime = Readonly<{
  applicationId: string;
  productManifests: readonly Readonly<{
    surfaces: readonly Readonly<{
      plane: 'work' | 'management';
      indexPath: `/${string}`;
    }>[];
  }>[];
}>;

export function resolveProductArtifactHomePath(runtime: ProductArtifactRouteRuntime): `/${string}` {
  const configured = APPLICATION_HOME_PATHS[runtime.applicationId];
  if (configured) return configured;

  const mountedSurface = runtime.productManifests
    .flatMap((manifest) => manifest.surfaces)
    .find((surface) => surface.plane === 'work');
  return mountedSurface?.indexPath ?? runtime.productManifests[0]?.surfaces[0]?.indexPath ?? '/';
}

/** Stable catch-all for a deployment URL that is not owned by this product artifact. */
export function ProductArtifactRouteNotFound({ runtime }: { runtime: ProductApplicationRuntime }) {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const productHomePath = resolveProductArtifactHomePath(runtime);
  return (
    <main
      id="dwp-main-content"
      tabIndex={-1}
      data-testid="product-artifact-route-not-found"
      style={{ minHeight: '100dvh', display: 'grid', alignItems: 'center' }}
    >
      <GuidedEmptyState
        kind="empty"
        title={t('productSurface.notFound.title')}
        description={t('productSurface.notFound.description')}
        titleComponent="h1"
        actionLabel={t('productSurface.notFound.productHome')}
        onAction={() => navigate(productHomePath, { replace: true })}
        secondaryActionLabel={
          productHomePath === '/' ? undefined : t('productSurface.notFound.dwpHome')
        }
        onSecondaryAction={
          productHomePath === '/' ? undefined : () => navigate('/', { replace: true })
        }
        size="page"
      />
    </main>
  );
}
