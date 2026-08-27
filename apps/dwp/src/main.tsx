import '@vitejs/plugin-react-swc/preamble';

import { bootstrapApplication } from './bootstrap-application';
import { createGlobalProductApplicationRuntime } from './components/create-global-product-application-runtime';
import { GOVERNED_PRODUCT_MANIFESTS } from './components/product-manifest-registry';
import { routesSection } from './routes/sections';

bootstrapApplication(
  routesSection,
  createGlobalProductApplicationRuntime('shell', GOVERNED_PRODUCT_MANIFESTS)
);
