import type { HomeWidgetHeight, HomeWidgetKey, HomeWidgetSize } from '@dwp-frontend/shared-utils';

export type WorkspaceWidgetLifecycle = 'ACTIVE' | 'DEPRECATED' | 'BLOCKED';
export type WorkspaceWidgetRuntime = 'NATIVE';
export type WorkspaceWidgetPrivacyClass = 'INTERNAL' | 'CONFIDENTIAL';
export type WorkspaceWidgetPolicyClass = 'PERSONAL' | 'GOVERNED';

export type WorkspaceWidgetConfigurationContract = Readonly<{
  sourceKey: string;
  fieldKeys: readonly string[];
  filterPresets: readonly string[];
  itemLimit: Readonly<{ min: number; max: number }>;
}>;

export type WorkspaceWidgetCatalogDefinition = Readonly<{
  key: HomeWidgetKey;
  manifestVersion: 1;
  ownerProduct: string;
  sourceAppResourceKey: string;
  /** Apps whose authorized data can independently populate the Flow purpose surface. */
  contributorAppResourceKeys: readonly string[];
  dataSource: string;
  freshnessSeconds: number;
  privacyClass: WorkspaceWidgetPrivacyClass;
  retention: 'NONE';
  analyticsKey: string;
  runtime: WorkspaceWidgetRuntime;
  lifecycle: WorkspaceWidgetLifecycle;
  policyClass: WorkspaceWidgetPolicyClass;
  canHide: boolean;
  defaultSize: HomeWidgetSize;
  allowedSizes: readonly HomeWidgetSize[];
  defaultHeight: HomeWidgetHeight;
  allowedHeights: readonly HomeWidgetHeight[];
  configuration: WorkspaceWidgetConfigurationContract | null;
  recipientContextBinding: boolean;
  shareableAsPreset: boolean;
}>;

export type WorkspaceWidgetAccessDecision =
  'AVAILABLE' | 'PROVIDER_BLOCKED' | 'TENANT_BLOCKED' | 'APP_NOT_ENTITLED' | 'SOURCE_FORBIDDEN';

const ITEM_LIMIT = { min: 1, max: 20 } as const;

export const WORKSPACE_WIDGET_CATALOG: readonly WorkspaceWidgetCatalogDefinition[] = [
  {
    key: 'command-rail',
    manifestVersion: 1,
    ownerProduct: 'core.workspace',
    sourceAppResourceKey: 'APP.WORK',
    contributorAppResourceKeys: ['APP.WORK', 'APP.APPROVALS', 'APP.HCM', 'APP.WORKPLACE'],
    dataSource: 'DWP_HOME_OVERVIEW',
    freshnessSeconds: 30,
    privacyClass: 'CONFIDENTIAL',
    retention: 'NONE',
    analyticsKey: 'home.command-rail',
    runtime: 'NATIVE',
    lifecycle: 'ACTIVE',
    policyClass: 'PERSONAL',
    canHide: true,
    defaultSize: 'large',
    allowedSizes: ['large', 'full'],
    defaultHeight: 'short',
    allowedHeights: ['short', 'standard'],
    configuration: null,
    recipientContextBinding: true,
    shareableAsPreset: false,
  },
  {
    key: 'daily-brief',
    manifestVersion: 1,
    ownerProduct: 'core.workspace',
    sourceAppResourceKey: 'APP.WORK',
    contributorAppResourceKeys: ['APP.CALENDAR', 'APP.APPROVALS', 'APP.NOTIFICATIONS'],
    dataSource: 'DWP_HOME_OVERVIEW',
    freshnessSeconds: 30,
    privacyClass: 'INTERNAL',
    retention: 'NONE',
    analyticsKey: 'home.workday-insights',
    runtime: 'NATIVE',
    lifecycle: 'ACTIVE',
    policyClass: 'PERSONAL',
    canHide: true,
    defaultSize: 'full',
    allowedSizes: ['compact', 'large', 'full'],
    defaultHeight: 'standard',
    allowedHeights: ['short', 'standard', 'tall'],
    configuration: {
      sourceKey: 'RECOMMENDATION',
      fieldKeys: ['title', 'reason', 'action'],
      filterPresets: ['RECOMMENDED', 'NEXT_ACTIONS'],
      itemLimit: ITEM_LIMIT,
    },
    recipientContextBinding: true,
    shareableAsPreset: true,
  },
  {
    key: 'focus',
    manifestVersion: 1,
    ownerProduct: 'core.work',
    sourceAppResourceKey: 'APP.WORK',
    contributorAppResourceKeys: ['APP.APPROVALS', 'APP.EMPLOYEE_SERVICES'],
    dataSource: 'DWP_WORKSPACE',
    freshnessSeconds: 30,
    privacyClass: 'CONFIDENTIAL',
    retention: 'NONE',
    analyticsKey: 'home.focus',
    runtime: 'NATIVE',
    lifecycle: 'ACTIVE',
    policyClass: 'PERSONAL',
    canHide: true,
    defaultSize: 'medium',
    allowedSizes: ['quarter', 'compact', 'medium', 'large', 'full'],
    defaultHeight: 'tall',
    allowedHeights: ['short', 'standard', 'tall', 'expanded'],
    configuration: {
      sourceKey: 'WORK',
      fieldKeys: ['title', 'status', 'priority', 'dueAt'],
      filterPresets: ['ASSIGNED_TO_ME', 'DUE_SOON', 'HIGH_PRIORITY'],
      itemLimit: ITEM_LIMIT,
    },
    recipientContextBinding: true,
    shareableAsPreset: true,
  },
  {
    key: 'schedule',
    manifestVersion: 1,
    ownerProduct: 'core.calendar',
    sourceAppResourceKey: 'APP.CALENDAR',
    contributorAppResourceKeys: ['APP.CALENDAR', 'APP.WORKPLACE'],
    dataSource: 'DWP_CALENDAR',
    freshnessSeconds: 30,
    privacyClass: 'CONFIDENTIAL',
    retention: 'NONE',
    analyticsKey: 'home.schedule',
    runtime: 'NATIVE',
    lifecycle: 'ACTIVE',
    policyClass: 'PERSONAL',
    canHide: true,
    defaultSize: 'quarter',
    allowedSizes: ['fifth', 'quarter', 'compact', 'medium'],
    defaultHeight: 'standard',
    allowedHeights: ['short', 'standard', 'tall'],
    configuration: {
      sourceKey: 'CALENDAR',
      fieldKeys: ['title', 'startAt', 'endAt', 'location'],
      filterPresets: ['TODAY', 'NEXT_7_DAYS'],
      itemLimit: ITEM_LIMIT,
    },
    recipientContextBinding: true,
    shareableAsPreset: true,
  },
  {
    key: 'activity',
    manifestVersion: 1,
    ownerProduct: 'core.activity',
    sourceAppResourceKey: 'APP.ACTIVITY',
    contributorAppResourceKeys: [
      'APP.WORK',
      'APP.CALENDAR',
      'APP.ACTIVITY',
      'APP.APPROVALS',
      'APP.HCM',
      'APP.NOTIFICATIONS',
    ],
    dataSource: 'DWP_ACTIVITY',
    freshnessSeconds: 30,
    privacyClass: 'INTERNAL',
    retention: 'NONE',
    analyticsKey: 'home.activity',
    runtime: 'NATIVE',
    lifecycle: 'ACTIVE',
    policyClass: 'PERSONAL',
    canHide: true,
    defaultSize: 'quarter',
    allowedSizes: ['fifth', 'quarter', 'compact', 'medium'],
    defaultHeight: 'tall',
    allowedHeights: ['short', 'standard', 'tall'],
    configuration: {
      sourceKey: 'ACTIVITY',
      fieldKeys: ['eventType', 'title', 'occurredAt', 'actor'],
      filterPresets: ['RECENT', 'MY_ACTIVITY'],
      itemLimit: ITEM_LIMIT,
    },
    recipientContextBinding: true,
    shareableAsPreset: true,
  },
  {
    key: 'focus-balance',
    manifestVersion: 1,
    ownerProduct: 'core.calendar',
    sourceAppResourceKey: 'APP.CALENDAR',
    contributorAppResourceKeys: ['APP.CALENDAR'],
    dataSource: 'DWP_CALENDAR',
    freshnessSeconds: 30,
    privacyClass: 'CONFIDENTIAL',
    retention: 'NONE',
    analyticsKey: 'home.focus-balance',
    runtime: 'NATIVE',
    lifecycle: 'ACTIVE',
    policyClass: 'PERSONAL',
    canHide: true,
    defaultSize: 'medium',
    allowedSizes: ['quarter', 'compact', 'medium'],
    defaultHeight: 'short',
    allowedHeights: ['short', 'standard'],
    configuration: null,
    recipientContextBinding: true,
    shareableAsPreset: false,
  },
  {
    key: 'meeting-load',
    manifestVersion: 1,
    ownerProduct: 'core.calendar',
    sourceAppResourceKey: 'APP.CALENDAR',
    contributorAppResourceKeys: ['APP.CALENDAR'],
    dataSource: 'DWP_CALENDAR',
    freshnessSeconds: 30,
    privacyClass: 'CONFIDENTIAL',
    retention: 'NONE',
    analyticsKey: 'home.meeting-load',
    runtime: 'NATIVE',
    lifecycle: 'ACTIVE',
    policyClass: 'PERSONAL',
    canHide: true,
    defaultSize: 'medium',
    allowedSizes: ['quarter', 'compact', 'medium'],
    defaultHeight: 'short',
    allowedHeights: ['short', 'standard'],
    configuration: null,
    recipientContextBinding: true,
    shareableAsPreset: false,
  },
];

const definitionByKey = new Map(
  WORKSPACE_WIDGET_CATALOG.map((definition) => [definition.key, definition])
);

export function workspaceWidgetCatalogDefinition(
  widgetKey: string
): WorkspaceWidgetCatalogDefinition | null {
  return definitionByKey.get(widgetKey as HomeWidgetKey) ?? null;
}

export function resolveWorkspaceWidgetAccess({
  lifecycle,
  providerAllowed,
  tenantAllowed,
  appEntitled,
  sourceAuthorized,
}: {
  lifecycle: WorkspaceWidgetLifecycle;
  providerAllowed: boolean;
  tenantAllowed: boolean;
  appEntitled: boolean;
  sourceAuthorized: boolean;
}): WorkspaceWidgetAccessDecision {
  if (lifecycle !== 'ACTIVE' || !providerAllowed) return 'PROVIDER_BLOCKED';
  if (!tenantAllowed) return 'TENANT_BLOCKED';
  if (!appEntitled) return 'APP_NOT_ENTITLED';
  if (!sourceAuthorized) return 'SOURCE_FORBIDDEN';
  return 'AVAILABLE';
}
