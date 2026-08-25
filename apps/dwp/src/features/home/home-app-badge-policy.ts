import { useMemo } from 'react';

import { applyHomeAppNotificationBadges } from '../../components/workspace-composer/app-launchpad-model';
import { isAppReadEntitled } from '@dwp-frontend/shared-utils/auth/app-entitlements';
import { isHcmReadEntitled } from '@dwp-frontend/shared-utils/auth/hcm-access';

import type { AppNotificationSummary } from '@dwp-frontend/shared-utils';
import type {
  AppEntitlementPermission,
  HomeAppDefinition,
  HomeAppNotificationBadgeValue,
} from '../../components/workspace-composer/app-launchpad-model';

export type ResolveHomeAppsWithBadgesInput = {
  apps: readonly HomeAppDefinition[];
  roles: readonly string[];
  permissions: readonly AppEntitlementPermission[];
  legacyRoleFallbackAllowed?: boolean;
  notificationSummary?: AppNotificationSummary;
  notificationSummaryAuthorized: boolean;
  notificationSummaryHealthy: boolean;
  notificationSummaryNow: Date;
};

export const HOME_NOTIFICATION_BADGE_FRESHNESS_MS = 30_000;

export function isHomeNotificationSummaryFresh(
  summary: AppNotificationSummary | undefined,
  now: Date,
  freshnessMs = HOME_NOTIFICATION_BADGE_FRESHNESS_MS
): boolean {
  if (!summary?.generatedAt) return false;
  const generatedAt = Date.parse(summary.generatedAt);
  if (!Number.isFinite(generatedAt)) return false;
  const ageMs = now.getTime() - generatedAt;
  return ageMs >= -freshnessMs && ageMs <= freshnessMs;
}

export function resolveHomeAppsWithBadges({
  apps,
  roles,
  permissions,
  legacyRoleFallbackAllowed = false,
  notificationSummary,
  notificationSummaryAuthorized,
  notificationSummaryHealthy,
  notificationSummaryNow,
}: ResolveHomeAppsWithBadgesInput): HomeAppDefinition[] {
  const badgeCounts = new Map<string, HomeAppNotificationBadgeValue>();
  if (
    notificationSummaryAuthorized &&
    notificationSummaryHealthy &&
    isHomeNotificationSummaryFresh(notificationSummary, notificationSummaryNow)
  ) {
    for (const summary of notificationSummary?.apps ?? []) {
      badgeCounts.set(String(summary.appKey), {
        totalUnread: summary.totalUnread,
        actionableUnread: summary.actionableUnread,
        urgentUnread: summary.urgentUnread,
      });
    }
  }

  return applyHomeAppNotificationBadges(
    apps.filter((app) => {
      if (app.requiredRoles && !app.requiredRoles.some((role) => roles.includes(role)))
        return false;
      return app.resourceKey === 'APP.HCM' || app.resourceKey === 'APP.HRIS'
        ? isHcmReadEntitled(permissions, roles, legacyRoleFallbackAllowed)
        : isAppReadEntitled(app.resourceKey, permissions);
    }),
    badgeCounts.size > 0 ? badgeCounts : null
  );
}

export function useHomeAppsWithBadges({
  apps,
  roles,
  permissions,
  legacyRoleFallbackAllowed,
  notificationSummary,
  notificationSummaryAuthorized,
  notificationSummaryHealthy,
  notificationSummaryNow,
}: ResolveHomeAppsWithBadgesInput): HomeAppDefinition[] {
  return useMemo(
    () =>
      resolveHomeAppsWithBadges({
        apps,
        roles,
        permissions,
        legacyRoleFallbackAllowed,
        notificationSummary,
        notificationSummaryAuthorized,
        notificationSummaryHealthy,
        notificationSummaryNow,
      }),
    [
      apps,
      legacyRoleFallbackAllowed,
      notificationSummary,
      notificationSummaryAuthorized,
      notificationSummaryHealthy,
      notificationSummaryNow,
      permissions,
      roles,
    ]
  );
}
