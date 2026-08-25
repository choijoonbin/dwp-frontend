import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export const NOTIFICATION_APP_SUMMARY_PATH = '/api/notifications/v1/summary/by-app';

const STABLE_APP_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/u;
const DECIMAL_VERSION_PATTERN = /^(?:0|[1-9]\d*)$/u;

declare const stableNotificationAppKey: unique symbol;
declare const notificationFreshnessInstant: unique symbol;

/** Notification Type owner key, validated against the server's stable key contract. */
export type StableNotificationAppKey = string & {
  readonly [stableNotificationAppKey]: true;
};

/** ISO-8601 server timestamp used to expose summary and per-app freshness. */
export type NotificationFreshnessInstant = string & {
  readonly [notificationFreshnessInstant]: true;
};

export type AppNotificationCounter = {
  appKey: StableNotificationAppKey;
  totalUnread: number;
  actionableUnread: number;
  urgentUnread: number;
  lastActivityAt: NotificationFreshnessInstant;
};

export type AppNotificationSummary = {
  partial: boolean;
  unavailableSources: string[];
  apps: AppNotificationCounter[];
  changeVersion: string;
  counterVersion: string;
  generatedAt: NotificationFreshnessInstant;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStableAppKey(value: unknown): StableNotificationAppKey {
  if (typeof value !== 'string' || !STABLE_APP_KEY_PATTERN.test(value)) {
    throw new Error('Notification app summary contains an invalid stable appKey.');
  }
  return value as StableNotificationAppKey;
}

function parseFreshnessInstant(value: unknown, field: string): NotificationFreshnessInstant {
  if (typeof value !== 'string' || !value.includes('T') || Number.isNaN(Date.parse(value))) {
    throw new Error(`Notification app summary contains an invalid ${field}.`);
  }
  return value as NotificationFreshnessInstant;
}

function parseCounter(value: unknown): AppNotificationCounter {
  if (!isRecord(value)) throw new Error('Notification app summary contains an invalid app row.');

  const appKey = parseStableAppKey(value.appKey);
  const totalUnread = parseCount(value.totalUnread, 'totalUnread');
  const actionableUnread = parseCount(value.actionableUnread, 'actionableUnread');
  const urgentUnread = parseCount(value.urgentUnread, 'urgentUnread');
  if (actionableUnread > totalUnread || urgentUnread > totalUnread) {
    throw new Error('Notification app summary subsets cannot exceed totalUnread.');
  }

  return {
    appKey,
    totalUnread,
    actionableUnread,
    urgentUnread,
    lastActivityAt: parseFreshnessInstant(value.lastActivityAt, 'lastActivityAt'),
  };
}

function parseCount(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Notification app summary contains an invalid ${field}.`);
  }
  return value;
}

function parseVersion(value: unknown, field: string): string {
  if (typeof value !== 'string' || !DECIMAL_VERSION_PATTERN.test(value)) {
    throw new Error(`Notification app summary contains an invalid ${field}.`);
  }
  return value;
}

export function parseAppNotificationSummary(value: unknown): AppNotificationSummary {
  if (!isRecord(value)) throw new Error('Notification app summary response is invalid.');
  if (typeof value.partial !== 'boolean') {
    throw new Error('Notification app summary contains an invalid partial state.');
  }
  if (
    !Array.isArray(value.unavailableSources) ||
    value.unavailableSources.some((source) => typeof source !== 'string')
  ) {
    throw new Error('Notification app summary contains invalid unavailableSources.');
  }
  if (!value.partial && value.unavailableSources.length > 0) {
    throw new Error('Notification app summary unavailableSources require partial=true.');
  }
  if (!Array.isArray(value.apps) || value.apps.length > 100) {
    throw new Error('Notification app summary contains an invalid apps collection.');
  }

  const apps = value.apps.map(parseCounter);
  if (new Set(apps.map((app) => app.appKey)).size !== apps.length) {
    throw new Error('Notification app summary contains duplicate appKey rows.');
  }

  return {
    partial: value.partial,
    unavailableSources: [...value.unavailableSources] as string[],
    apps,
    changeVersion: parseVersion(value.changeVersion, 'changeVersion'),
    counterVersion: parseVersion(value.counterVersion, 'counterVersion'),
    generatedAt: parseFreshnessInstant(value.generatedAt, 'generatedAt'),
  };
}

export async function getNotificationSummaryByApp(
  signal?: AbortSignal
): Promise<AppNotificationSummary> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(NOTIFICATION_APP_SUMMARY_PATH, {
    signal,
  });
  return parseAppNotificationSummary(response.data.data);
}
