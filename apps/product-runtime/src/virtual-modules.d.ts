declare module 'virtual:dwp-product-routes' {
  import type { RouteObject } from 'react-router-dom';
  import type { ProductSurfaceManifest } from '../../dwp/src/components/product-manifest';
  import type { ProductApplicationDescriptor } from '../../dwp/src/components/product-application-descriptor';

  export const productId: string;
  export const productRoutes: RouteObject[];
  export const productManifests: readonly ProductSurfaceManifest[];
  export const productApplicationDescriptor: ProductApplicationDescriptor;
}
