export const SPACE_ADMIN_NAVIGATION_CONTRACTS = [
  {
    view: 'admin-overview',
    path: '/spaces/admin/overview',
    requiredResourceKey: 'ADMIN.SPACE_GOVERNANCE',
    requiredPermissionCode: 'VIEW',
  },
  {
    view: 'admin-directory',
    path: '/spaces/admin/directory',
    requiredResourceKey: 'ADMIN.SPACE_GOVERNANCE',
    requiredPermissionCode: 'VIEW',
  },
  {
    view: 'admin-requests',
    path: '/spaces/admin/requests',
    requiredResourceKey: 'ADMIN.SPACE_GOVERNANCE',
    requiredPermissionCode: 'VIEW',
  },
  {
    view: 'admin-templates',
    path: '/spaces/admin/templates',
    requiredResourceKey: 'ADMIN.SPACE_TEMPLATES',
    requiredPermissionCode: 'VIEW',
  },
  {
    view: 'admin-content-reviews',
    path: '/spaces/admin/content-reviews',
    requiredResourceKey: 'ADMIN.SPACE_COMPLIANCE',
    requiredPermissionCode: 'VIEW',
  },
  {
    view: 'admin-lifecycle',
    path: '/spaces/admin/lifecycle',
    requiredResourceKey: 'ADMIN.SPACE_ACCESS_REVIEW',
    requiredPermissionCode: 'VIEW',
  },
  {
    view: 'admin-operations',
    path: '/spaces/admin/operations',
    requiredResourceKey: 'ADMIN.SPACE_GOVERNANCE',
    requiredPermissionCode: 'VIEW',
  },
] as const;

export type SpaceAdminView = (typeof SPACE_ADMIN_NAVIGATION_CONTRACTS)[number]['view'];

export const SPACE_ADMIN_AUTHORITIES = Array.from(
  new Map(
    SPACE_ADMIN_NAVIGATION_CONTRACTS.map((item) => [
      item.requiredResourceKey,
      {
        resourceKey: item.requiredResourceKey,
        permissionCode: item.requiredPermissionCode,
      },
    ])
  ).values()
);
