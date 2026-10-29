import { lazy, Suspense } from 'react';

import { HomeRouteFallback } from '../components/home-loading-skeleton';

const HomeLayoutRuntime = lazy(() =>
  import('./home-layout').then((module) => ({ default: module.HomeLayout }))
);

/** Keeps the personal Home shell out of unrelated product and administration entries. */
export function HomeLayout() {
  return (
    <Suspense fallback={<HomeRouteFallback />}>
      <HomeLayoutRuntime />
    </Suspense>
  );
}
