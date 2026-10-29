import { lazy, Suspense } from 'react';

import { routeFallback } from './route-support';

import type { RouteObject } from 'react-router-dom';

const HcmProductRouteRuntime = lazy(() =>
  import('./hcm-routes').then((module) => ({ default: module.HcmProductRouteRuntime }))
);
const HcmPeopleLegacyRouteRuntime = lazy(() =>
  import('./hcm-routes').then((module) => ({ default: module.HcmPeopleLegacyRouteRuntime }))
);
const HcmWorkforceLegacyRouteRuntime = lazy(() =>
  import('./hcm-routes').then((module) => ({ default: module.HcmWorkforceLegacyRouteRuntime }))
);

function hcmRuntime(element: React.ReactNode) {
  return <Suspense fallback={routeFallback}>{element}</Suspense>;
}

/**
 * A lightweight discovery tree for the platform shell. The full HCM route tree is
 * loaded as one feature boundary only when one of the HCM-owned paths is matched.
 */
export const hcmRouteEntries: RouteObject[] = [
  {
    path: 'hr/*',
    element: hcmRuntime(<HcmProductRouteRuntime />),
  },
  {
    path: 'people/*',
    element: hcmRuntime(<HcmPeopleLegacyRouteRuntime />),
  },
  {
    path: 'workforce/*',
    element: hcmRuntime(<HcmWorkforceLegacyRouteRuntime />),
  },
];
