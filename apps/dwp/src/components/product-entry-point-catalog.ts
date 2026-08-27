import type {
  NonEmptyReadonlyArray,
  ProductPlane,
  ProductScopeKind,
  ProductTaskKind,
} from './product-manifest';

export type ProductEntrySurfaceDescriptor = Readonly<{
  id: string;
  plane: ProductPlane;
  labelKey: string;
  taskKinds: NonEmptyReadonlyArray<ProductTaskKind>;
  indexPath: `/${string}`;
  supportedScopeKinds: NonEmptyReadonlyArray<ProductScopeKind>;
  returnSurfaceId?: string;
}>;

export type ProductEntryManifest = Readonly<{
  id: string;
  appKey: string;
  surfaces: NonEmptyReadonlyArray<ProductEntrySurfaceDescriptor>;
}>;

/** Platform-shared, render-free projection used by Workspace and Administration. */
export const GOVERNED_PRODUCT_ENTRY_CATALOG: readonly ProductEntryManifest[] = [
  {
    id: 'approvals',
    appKey: 'APP.APPROVALS',
    surfaces: [
      {
        id: 'approvals.work',
        plane: 'work',
        labelKey: 'surfaces.work',
        taskKinds: ['work'],
        indexPath: '/approvals/home',
        supportedScopeKinds: ['SELF'],
      },
      {
        id: 'approvals.admin',
        plane: 'management',
        labelKey: 'surfaces.management',
        taskKinds: ['operations', 'administration'],
        indexPath: '/approvals/admin',
        supportedScopeKinds: ['RESOURCE_SET'],
        returnSurfaceId: 'approvals.work',
      },
    ],
  },
  {
    id: 'calendar',
    appKey: 'APP.CALENDAR',
    surfaces: [
      {
        id: 'calendar.work',
        plane: 'work',
        labelKey: 'navigation.groups.calendar.start',
        taskKinds: ['work'],
        indexPath: '/calendar/home',
        supportedScopeKinds: ['SELF'],
      },
      {
        id: 'calendar.management',
        plane: 'management',
        labelKey: 'navigation.groups.calendar.admin',
        taskKinds: ['operations', 'administration'],
        indexPath: '/calendar/admin/overview',
        supportedScopeKinds: ['RESOURCE_SET'],
        returnSurfaceId: 'calendar.work',
      },
    ],
  },
  {
    id: 'communications',
    appKey: 'APP.COMMUNICATIONS',
    surfaces: [
      {
        id: 'communications.work',
        plane: 'work',
        labelKey: 'surfaces.work',
        taskKinds: ['work'],
        indexPath: '/communications/home',
        supportedScopeKinds: ['SELF'],
      },
      {
        id: 'communications.management',
        plane: 'management',
        labelKey: 'surfaces.management',
        taskKinds: ['operations'],
        indexPath: '/communications/admin/content',
        supportedScopeKinds: ['RESOURCE_SET', 'SUPPORT_SESSION'],
        returnSurfaceId: 'communications.work',
      },
    ],
  },
  {
    id: 'dwaion',
    appKey: 'APP.ASK',
    surfaces: [
      {
        id: 'dwaion.work',
        plane: 'work',
        labelKey: 'navigation.groups.dwaion.start',
        taskKinds: ['work'],
        indexPath: '/dwaion/home',
        supportedScopeKinds: ['SELF'],
      },
      {
        id: 'dwaion.management',
        plane: 'management',
        labelKey: 'navigation.groups.dwaion.admin',
        taskKinds: ['operations', 'administration'],
        indexPath: '/dwaion/admin/overview',
        supportedScopeKinds: ['RESOURCE_SET'],
        returnSurfaceId: 'dwaion.work',
      },
    ],
  },
  {
    id: 'hcm',
    appKey: 'APP.HCM',
    surfaces: [
      {
        id: 'hcm.personal',
        plane: 'work',
        labelKey: 'navigation.groups.hcm.personal',
        taskKinds: ['work'],
        indexPath: '/hr/home',
        supportedScopeKinds: ['SELF'],
      },
      {
        id: 'hcm.team',
        plane: 'work',
        labelKey: 'navigation.groups.hcm.team',
        taskKinds: ['team'],
        indexPath: '/hr/team',
        supportedScopeKinds: ['TEAM', 'ORG_UNIT', 'TARGET_POPULATION'],
      },
      {
        id: 'hcm.operations',
        plane: 'management',
        labelKey: 'navigation.groups.hcm.operate',
        taskKinds: ['operations'],
        indexPath: '/hr/operations',
        supportedScopeKinds: ['ORG_UNIT', 'LEGAL_ENTITY', 'TARGET_POPULATION', 'SUPPORT_SESSION'],
        returnSurfaceId: 'hcm.personal',
      },
      {
        id: 'hcm.management',
        plane: 'management',
        labelKey: 'navigation.groups.hcm.foundation',
        taskKinds: ['operations', 'administration'],
        indexPath: '/hr/manage',
        supportedScopeKinds: ['RESOURCE_SET', 'RESOURCE', 'LEGAL_ENTITY', 'POLICY_NODE'],
        returnSurfaceId: 'hcm.personal',
      },
    ],
  },
  {
    id: 'mail',
    appKey: 'APP.MAIL',
    surfaces: [
      {
        id: 'mail.work',
        plane: 'work',
        labelKey: 'navigation.groups.mail.start',
        taskKinds: ['work'],
        indexPath: '/mail/home',
        supportedScopeKinds: ['SELF'],
      },
      {
        id: 'mail.management',
        plane: 'management',
        labelKey: 'navigation.groups.mail.admin',
        taskKinds: ['operations', 'administration'],
        indexPath: '/mail/admin/overview',
        supportedScopeKinds: ['RESOURCE_SET'],
        returnSurfaceId: 'mail.work',
      },
    ],
  },
  {
    id: 'meetings',
    appKey: 'APP.MEETINGS',
    surfaces: [
      {
        id: 'meetings.work',
        plane: 'work',
        labelKey: 'surfaces.work',
        taskKinds: ['work'],
        indexPath: '/meetings/home',
        supportedScopeKinds: ['SELF'],
      },
      {
        id: 'meetings.management',
        plane: 'management',
        labelKey: 'surfaces.management',
        taskKinds: ['operations', 'administration'],
        indexPath: '/meetings/admin/operations',
        supportedScopeKinds: ['RESOURCE_SET'],
        returnSurfaceId: 'meetings.work',
      },
    ],
  },
  {
    id: 'messaging',
    appKey: 'APP.MESSAGING',
    surfaces: [
      {
        id: 'messaging.work',
        plane: 'work',
        labelKey: 'navigation.groups.messaging.start',
        taskKinds: ['work'],
        indexPath: '/messages/home',
        supportedScopeKinds: ['SELF'],
      },
      {
        id: 'messaging.management',
        plane: 'management',
        labelKey: 'navigation.groups.messaging.admin',
        taskKinds: ['operations', 'administration'],
        indexPath: '/messages/admin/overview',
        supportedScopeKinds: ['RESOURCE_SET'],
        returnSurfaceId: 'messaging.work',
      },
    ],
  },
  {
    id: 'notifications',
    appKey: 'APP.NOTIFICATIONS',
    surfaces: [
      {
        id: 'notifications.work',
        plane: 'work',
        labelKey: 'navigation.groups.notifications.overview',
        taskKinds: ['work'],
        indexPath: '/notifications/home',
        supportedScopeKinds: ['SELF'],
      },
      {
        id: 'notifications.management',
        plane: 'management',
        labelKey: 'navigation.groups.notifications.administration',
        taskKinds: ['operations', 'administration'],
        indexPath: '/notifications/admin/overview',
        supportedScopeKinds: ['RESOURCE_SET'],
        returnSurfaceId: 'notifications.work',
      },
    ],
  },
  {
    id: 'services',
    appKey: 'APP.EMPLOYEE_SERVICES',
    surfaces: [
      {
        id: 'services.work',
        plane: 'work',
        labelKey: 'surfaces.work',
        taskKinds: ['work'],
        indexPath: '/services/home',
        supportedScopeKinds: ['SELF'],
      },
      {
        id: 'services.management',
        plane: 'management',
        labelKey: 'surfaces.management',
        taskKinds: ['operations', 'administration'],
        indexPath: '/services/admin',
        supportedScopeKinds: ['RESOURCE_SET'],
        returnSurfaceId: 'services.work',
      },
    ],
  },
  {
    id: 'spaces',
    appKey: 'APP.SPACES',
    surfaces: [
      {
        id: 'spaces.work',
        plane: 'work',
        labelKey: 'navigation.groups.spaces.overview',
        taskKinds: ['work'],
        indexPath: '/spaces/home',
        supportedScopeKinds: ['SELF'],
      },
      {
        id: 'spaces.management',
        plane: 'management',
        labelKey: 'navigation.groups.spaces.administration',
        taskKinds: ['operations', 'administration'],
        indexPath: '/spaces/admin/overview',
        supportedScopeKinds: ['RESOURCE_SET'],
        returnSurfaceId: 'spaces.work',
      },
    ],
  },
  {
    id: 'workplace',
    appKey: 'APP.WORKPLACE',
    surfaces: [
      {
        id: 'workplace.work',
        plane: 'work',
        labelKey: 'navigation.groups.rooms.booking',
        taskKinds: ['work'],
        indexPath: '/workplace/home',
        supportedScopeKinds: ['SELF'],
      },
      {
        id: 'workplace.management',
        plane: 'management',
        labelKey: 'navigation.groups.rooms.workplaceAdministration',
        taskKinds: ['operations', 'administration'],
        indexPath: '/workplace/admin/overview',
        supportedScopeKinds: ['RESOURCE_SET', 'RESOURCE'],
        returnSurfaceId: 'workplace.work',
      },
    ],
  },
];
