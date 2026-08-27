import {
  Activity,
  Bot,
  ChartNoAxesCombined,
  DatabaseZap,
  FlaskConical,
  History,
  House,
  Inbox,
  ListChecks,
  MessageSquarePlus,
  ScrollText,
  ShieldAlert,
  Workflow,
} from 'lucide-react';

import { defineProductManifest } from '../../components/product-manifest';

export const DWAION_NAVIGATION = [
  {
    id: 'start',
    items: [{ path: '/dwaion/home', view: 'home', icon: House }],
  },
  {
    id: 'conversations',
    items: [
      { path: '/dwaion/new', view: 'new', icon: MessageSquarePlus },
      { path: '/dwaion/conversations', view: 'conversations', icon: History },
    ],
  },
  {
    id: 'activity',
    items: [{ path: '/dwaion/activity', view: 'activity', icon: Activity }],
  },
  {
    id: 'proactive',
    items: [{ path: '/dwaion/proposals', view: 'proposals', icon: Inbox }],
  },
  {
    id: 'discover',
    items: [
      { path: '/dwaion/agents', view: 'agents', icon: Bot },
      {
        path: '/dwaion/actions',
        view: 'actions',
        icon: Workflow,
        requiredAnyAuthorities: [
          { resourceKey: 'APP.CALENDAR', permissionCode: 'CREATE' },
          { resourceKey: 'APP.MAIL', permissionCode: 'CREATE' },
          { resourceKey: 'APP.EMPLOYEE_SERVICES', permissionCode: 'VIEW' },
          { resourceKey: 'ACTION.APPROVAL_REQUEST', permissionCode: 'CREATE' },
        ],
      },
    ],
  },
  {
    id: 'admin',
    items: [
      {
        path: '/dwaion/admin/overview',
        view: 'admin-overview',
        icon: ChartNoAxesCombined,
        requiredResourceKey: 'ADMIN.DWAION_OPERATIONS',
        requiredPermissionCode: 'VIEW',
      },
      {
        path: '/dwaion/admin/agents',
        view: 'admin-agents',
        icon: Bot,
        requiredResourceKey: 'ADMIN.DWAION_AGENTS',
        requiredPermissionCode: 'VIEW',
      },
      {
        path: '/dwaion/admin/sources',
        view: 'admin-sources',
        icon: DatabaseZap,
        requiredResourceKey: 'ADMIN.DWAION_SOURCES',
        requiredPermissionCode: 'VIEW',
      },
      {
        path: '/dwaion/admin/actions',
        view: 'admin-actions',
        icon: Workflow,
        requiredResourceKey: 'ADMIN.DWAION_ACTIONS',
        requiredPermissionCode: 'VIEW',
      },
      {
        path: '/dwaion/admin/safety',
        view: 'admin-safety',
        icon: ShieldAlert,
        requiredResourceKey: 'ADMIN.DWAION_SAFETY',
        requiredPermissionCode: 'VIEW',
      },
      {
        path: '/dwaion/admin/evaluation',
        view: 'admin-evaluation',
        icon: FlaskConical,
        requiredResourceKey: 'ADMIN.DWAION_EVALUATION',
        requiredPermissionCode: 'VIEW',
      },
      {
        path: '/dwaion/admin/gates',
        view: 'admin-gates',
        icon: ListChecks,
        requiredResourceKey: 'ADMIN.DWAION_GATES',
        requiredPermissionCode: 'VIEW',
      },
      {
        path: '/dwaion/admin/audit',
        view: 'admin-audit',
        icon: ScrollText,
        requiredAnyAuthorities: [
          { resourceKey: 'ADMIN.DWAION_RETENTION', permissionCode: 'VIEW' },
          { resourceKey: 'ADMIN.DWAION_AUDIT', permissionCode: 'VIEW' },
        ],
      },
    ],
  },
] as const;

export const DWAION_PRODUCT_MANIFEST = defineProductManifest({
  id: 'dwaion',
  appKey: 'APP.ASK',
  basePath: '/dwaion',
  homePath: '/dwaion/home',
  shellKey: 'dwaion',
  adminMode: 'embedded',
  navigation: DWAION_NAVIGATION,
  legacyPaths: ['/ask'],
});
