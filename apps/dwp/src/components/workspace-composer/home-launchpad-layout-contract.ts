export type HomeAppGroupId = string;

export type HomeAppIconKey =
  | 'activity'
  | 'admin'
  | 'approvals'
  | 'ask'
  | 'collaboration'
  | 'calendar'
  | 'communications'
  | 'erp'
  | 'knowledge'
  | 'legacy'
  | 'mail'
  | 'meetings'
  | 'messaging'
  | 'notifications'
  | 'rooms'
  | 'spaces'
  | 'hcm'
  | 'hris'
  | 'people'
  | 'services'
  | 'workforce'
  | 'work';

export type HomeAppBadgeIntent = 'unread' | 'actionable' | 'urgent';

/**
 * Notification semantics retained alongside the classic, display-only badge string.
 * The exact total remains available to assistive UI even when the visual label is capped.
 */
export type HomeAppBadgeMetadata = Readonly<{
  totalUnread: number;
  actionableUnread: number;
  urgentUnread: number;
  intent: HomeAppBadgeIntent;
  accessibleLabel: string;
}>;

/** Count-only projections and the notification service counter are both supported. */
export type HomeAppNotificationBadgeValue =
  | number
  | Readonly<{
      totalUnread: number;
      actionableUnread: number;
      urgentUnread: number;
    }>;

export type HomeAppDefinition = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  groupId: HomeAppGroupId;
  route: string;
  iconKey: HomeAppIconKey;
  tone: string;
  resourceKey: string;
  /** Backward-compatible visual label consumed by Classic and Flow launchers. */
  badge?: string;
  /** Structured semantics for intent styling and an exact accessible announcement. */
  badgeMetadata?: HomeAppBadgeMetadata;
  /** Stable notification-platform owner key; never inferred from the app id. */
  notificationSourceKey?: string;
  requiredRoles?: readonly string[];
  /** Server-derived Pilot entry. Never populate from a raw MANAGE permission fallback. */
  managementRoute?: string;
  managementOnly?: boolean;
};

export type HomeAppGroup = {
  id: HomeAppGroupId;
  name: string;
  description: string;
};

export type LaunchpadFolder = {
  id: string;
  name: string;
  groupId: HomeAppGroupId;
  appIds: string[];
};

export type LaunchpadLayout = {
  version: 1;
  groups: Record<string, string[]>;
  folders: Record<string, LaunchpadFolder>;
  hiddenAppIds: string[];
};

export const HOME_LAUNCHPAD_VISIBLE_COLUMNS = 5;
export const HOME_LAUNCHPAD_VISIBLE_ROWS = 2;
export const HOME_LAUNCHPAD_TILE_WIDTH = 72;
export const HOME_LAUNCHPAD_TILE_HEIGHT = 84;
export const HOME_LAUNCHPAD_GROUP_ITEM_LIMIT =
  HOME_LAUNCHPAD_VISIBLE_COLUMNS * HOME_LAUNCHPAD_VISIBLE_ROWS;
export const HOME_LAUNCHPAD_TWO_COLUMN_DOCK_MIN_WIDTH = 520;
export const HOME_LAUNCHPAD_FOUR_COLUMN_DOCK_MIN_WIDTH = 1100;

// Four governed groups can each retain five 72px tiles beyond this Dock width
// without clipping panel padding or inter-tile gaps.
export const HOME_LAUNCHPAD_FIVE_COLUMN_DOCK_MIN_WIDTH = 1760;
