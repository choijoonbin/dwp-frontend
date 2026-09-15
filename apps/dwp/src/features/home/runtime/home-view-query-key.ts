import type { HomeExperienceVariant, HomeSurfaceKey, HomeView } from '@dwp-frontend/shared-utils';

export type HomeViewQueryScope = Readonly<{
  tenantId?: number | null;
  userId?: number | null;
  surfaceKey: HomeSurfaceKey;
  modeKey: HomeExperienceVariant;
}>;

/**
 * Personal Home views are owner-, surface-, and mode-scoped data. Keeping every
 * identity axis in the cache key prevents a mode switch or sign-in transition
 * from reusing another layout while the authoritative request is in flight.
 */
export function homeViewQueryKey(scope: HomeViewQueryScope) {
  return [
    'home-personalization',
    'views',
    scope.tenantId ?? 'anonymous-tenant',
    scope.userId ?? 'anonymous-user',
    scope.surfaceKey,
    scope.modeKey,
  ] as const;
}

export function requireHomeViewMode<T extends Pick<HomeView, 'modeKey'>>(
  view: T,
  expectedMode: HomeExperienceVariant
): T {
  if (view.modeKey !== expectedMode) {
    throw new Error(
      `Home view mutation returned ${view.modeKey}, not requested mode ${expectedMode}.`
    );
  }
  return view;
}
