import type { RouteObject } from 'react-router-dom';

import { accountRoutes } from './account-routes';
import { activityRoutes } from './activity-routes';
import { administrationRoutes } from './administration-routes';
import { approvalsRoutes } from './approvals-routes';
import { calendarRoutes } from './calendar-routes';
import { communicationsRoutes } from './communications-routes';
import { dwaionRoutes } from './dwaion-routes';
import { hcmRoutes } from './hcm-routes';
import { mailRoutes } from './mail-routes';
import { messagingRoutes } from './messaging-routes';
import { notificationRoutes } from './notification-routes';
import { platformRoutes } from './platform-routes';
import { providerRoutes } from './provider-routes';
import { roomsRoutes } from './rooms-routes';
import { servicesRoutes } from './services-routes';
import { spacesRoutes } from './spaces-routes';
import { workspaceRoutes } from './workspace-routes';
import { workRoutes } from './work-routes';

export const routesSection: RouteObject[] = [
  ...workRoutes,
  ...activityRoutes,
  ...approvalsRoutes,
  ...calendarRoutes,
  ...roomsRoutes,
  ...mailRoutes,
  ...messagingRoutes,
  ...notificationRoutes,
  ...spacesRoutes,
  ...servicesRoutes,
  ...communicationsRoutes,
  ...dwaionRoutes,
  ...hcmRoutes,
  ...workspaceRoutes,
  ...accountRoutes,
  ...administrationRoutes,
  ...providerRoutes,
  ...platformRoutes,
];
