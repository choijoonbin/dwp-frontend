import { resolveMenuRouteCollaborationFixture } from './menu-route-collaboration-fixtures';
import { resolveMenuRouteControlFixture } from './menu-route-control-fixtures';
import { resolveMenuRouteWorkplaceFixture } from './menu-route-workplace-fixtures';

import type { MenuRouteFixtureResolution } from './menu-route-fixture-contract';
import type { Request } from '@playwright/test';

export const resolveMenuRouteProductFixture = (
  request: Request,
  path: string
): MenuRouteFixtureResolution | null => {
  const method = request.method();
  const body =
    path === '/api/platform/v1/personal-settings/activity/view'
      ? request.postDataJSON()
      : undefined;
  return (
    resolveMenuRouteCollaborationFixture(method, path) ??
    resolveMenuRouteWorkplaceFixture(method, path) ??
    resolveMenuRouteControlFixture(method, path, body)
  );
};
