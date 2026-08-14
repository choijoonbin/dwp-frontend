import '@vitejs/plugin-react-swc/preamble';

import { useEffect } from 'react';
import type { RouteObject } from 'react-router-dom';
import { productId, productRoutes } from 'virtual:dwp-product-routes';

import { bootstrapApplication } from '../../dwp/src/bootstrap-application';
import { ShellBootScreen } from '../../dwp/src/components/shell-boot-screen';

function RouteHandoff() {
  useEffect(() => window.location.replace(window.location.href), []);
  return <ShellBootScreen />;
}

bootstrapApplication(
  [...(productRoutes as RouteObject[]), { path: '*', element: <RouteHandoff /> }],
  productId
);
