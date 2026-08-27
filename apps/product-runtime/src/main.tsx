import '@vitejs/plugin-react-swc/preamble';

import type { RouteObject } from 'react-router-dom';
import {
  productApplicationDescriptor,
  productManifests,
  productRoutes,
} from 'virtual:dwp-product-routes';

import { bootstrapApplication } from '../../dwp/src/bootstrap-application';
import { createProductApplicationRuntime } from '../../dwp/src/components/create-product-application-runtime';
import { ProductArtifactRouteNotFound } from './product-artifact-route-not-found';

const runtime = createProductApplicationRuntime(productApplicationDescriptor, productManifests);

bootstrapApplication(
  [
    ...(productRoutes as RouteObject[]),
    { path: '*', element: <ProductArtifactRouteNotFound runtime={runtime} /> },
  ],
  runtime
);
