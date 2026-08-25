import { lazy } from 'react';

export const LazyHomePersonalizationStudio = lazy(() =>
  import('./home-personalization-studio').then((module) => ({
    default: module.HomePersonalizationStudio,
  }))
);
