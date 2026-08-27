import { Compass, FileClock, House, ListChecks, Settings2, ShieldCheck } from 'lucide-react';

import type {
  ProductNavigationGroup,
  ProductSurfaceNavigationGroup,
} from '../../components/product-manifest';

export type ServicesView =
  'home' | 'discover' | 'my' | 'drafts' | 'admin-catalog' | 'admin-operations';

export const SERVICES_WORK_NAVIGATION = [
  {
    id: 'overview',
    items: [
      {
        view: 'home',
        path: '/services/home',
        icon: House,
        taskKind: 'work',
        access: { type: 'policy', accessPolicyKey: 'services.work-access.v1' },
      },
    ],
  },
  {
    id: 'discover',
    items: [
      {
        view: 'discover',
        path: '/services/discover',
        icon: Compass,
        taskKind: 'work',
        access: { type: 'policy', accessPolicyKey: 'services.work-access.v1' },
      },
      {
        view: 'my',
        path: '/services/my',
        icon: ListChecks,
        taskKind: 'work',
        access: { type: 'policy', accessPolicyKey: 'services.work-access.v1' },
      },
      {
        view: 'drafts',
        path: '/services/drafts',
        icon: FileClock,
        taskKind: 'work',
        access: { type: 'policy', accessPolicyKey: 'services.work-access.v1' },
      },
    ],
  },
] as const satisfies readonly ProductSurfaceNavigationGroup[];

export const SERVICES_MANAGEMENT_NAVIGATION = [
  {
    id: 'administration',
    items: [
      {
        view: 'admin-catalog',
        path: '/services/admin/catalog',
        icon: Settings2,
        taskKind: 'administration',
        access: { type: 'capability', capabilityContractKey: 'services.catalog.read' },
      },
      {
        view: 'admin-operations',
        path: '/services/admin/operations',
        icon: ShieldCheck,
        taskKind: 'operations',
        access: { type: 'capability', capabilityContractKey: 'services.operations.read' },
      },
    ],
  },
] as const satisfies readonly ProductSurfaceNavigationGroup[];

export const SERVICES_NAVIGATION = [
  ...SERVICES_WORK_NAVIGATION,
  ...SERVICES_MANAGEMENT_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.map((item) => ({
      ...item,
      requiredResourceKey:
        item.view === 'admin-catalog' ? 'ADMIN.SERVICE_CATALOG' : 'ADMIN.SERVICE_OPERATIONS',
      requiredPermissionCode: 'VIEW',
    })),
  })),
] as const satisfies readonly ProductNavigationGroup[];

export const SERVICES_DEFAULT_PATH = '/services/home';
