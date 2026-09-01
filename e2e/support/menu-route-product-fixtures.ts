import { resolveMenuRouteCollaborationFixture } from './menu-route-collaboration-fixtures';
import { resolveMenuRouteWorkplaceFixture } from './menu-route-workplace-fixtures';

import type { MenuRouteFixtureResolution } from './menu-route-fixture-contract';

export const resolveMenuRouteProductFixture = (
  method: string,
  path: string
): MenuRouteFixtureResolution | null =>
  resolveMenuRouteCollaborationFixture(method, path) ??
  resolveMenuRouteWorkplaceFixture(method, path);
