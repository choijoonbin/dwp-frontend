import type { RouteObject } from 'react-router-dom';

import { accountRoutes } from './account-routes';
import { administrationRoutes } from './administration-routes';
import { approvalsRoutes } from './approvals-routes';
import { calendarRoutes } from './calendar-routes';
import { communicationsRoutes } from './communications-routes';
import { hcmRoutes } from './hcm-routes';
import { mailRoutes } from './mail-routes';
import { platformRoutes } from './platform-routes';
import { providerRoutes } from './provider-routes';
import { servicesRoutes } from './services-routes';
import { spacesRoutes } from './spaces-routes';
import { workspaceRoutes } from './workspace-routes';

export const routesSection: RouteObject[] = [
  ...approvalsRoutes,
  ...calendarRoutes,
  ...mailRoutes,
  ...spacesRoutes,
  ...servicesRoutes,
  ...communicationsRoutes,
  ...hcmRoutes,
  ...workspaceRoutes,
  ...accountRoutes,
  ...administrationRoutes,
  ...providerRoutes,
  ...platformRoutes,
];
