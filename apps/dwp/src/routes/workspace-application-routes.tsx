import type { RouteObject } from 'react-router-dom';

import { activityRoutes } from './activity-routes';
import { notificationRoutes } from './notification-routes';
import { workRoutes } from './work-routes';
import { workspaceRoutes } from './workspace-routes';

/** Complete independently deployed workspace route composition. */
export const workspaceApplicationRoutes: RouteObject[] = [
  ...workRoutes,
  ...activityRoutes,
  ...notificationRoutes,
  ...workspaceRoutes,
];
