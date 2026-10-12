import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { HOME_APPS } from '../../apps/dwp/src/components/workspace-composer/app-launchpad-model';

import type { Page, Route } from '@playwright/test';

type ContractApp = Readonly<{
  appId: string;
  resourceKey: string;
  sortOrder: number;
  route: string;
  iconKey: string;
  badgeSourceKey: string | null;
  requiredPermissionCode: string;
}>;

type ContractGroup = Readonly<{
  groupKey: string;
  sortOrder: number;
  apps: readonly ContractApp[];
}>;

type HomeLaunchpadContract = Readonly<{
  contractVersion: string;
  schemaVersion: number;
  groups: readonly ContractGroup[];
}>;

export const HOME_LAUNCHPAD_CONTRACT = JSON.parse(
  readFileSync(resolve(process.cwd(), 'architecture/home-launchpad-contract.v1.json'), 'utf8')
) as HomeLaunchpadContract;

const CATEGORY_BY_GROUP = {
  work: 'PRODUCTIVITY',
  connect: 'PRODUCTIVITY',
  services: 'PEOPLE',
  systems: 'BUSINESS',
} as const;

const APPROVED_APP_PRESENTATION_BY_ID = new Map(
  HOME_APPS.map((app) => [app.id, { name: app.name, description: app.description }])
);

export const CANONICAL_HOME_WORKSPACE_APPS = HOME_LAUNCHPAD_CONTRACT.groups.flatMap((group) =>
  group.apps.map((app) => {
    const presentation = APPROVED_APP_PRESENTATION_BY_ID.get(app.appId);
    if (!presentation) throw new Error(`Missing approved app presentation: ${app.appId}`);
    return {
      id: app.appId,
      ...presentation,
      owner: 'DWP Platform',
      category:
        CATEGORY_BY_GROUP[group.groupKey as keyof typeof CATEGORY_BY_GROUP] ?? 'PRODUCTIVITY',
      launchMode: 'NATIVE',
      launchTarget: app.route,
      iconKey: app.iconKey,
      resourceKey: app.resourceKey,
      requiredPermissionCode: app.requiredPermissionCode,
      badgeSourceKey: app.badgeSourceKey,
      health: 'HEALTHY',
      pinned: false,
      lastUsedAt: null,
      launchCount: 0,
      version: 1,
      accessState: 'AVAILABLE',
      accessRequestId: null,
      accessRequestState: null,
      accessRequestUpdatedAt: null,
      accessRequestVersion: null,
    };
  })
);

export const CANONICAL_HOME_APP_IDS_BY_GROUP = HOME_LAUNCHPAD_CONTRACT.groups.map((group) => ({
  groupKey: group.groupKey,
  appIds: group.apps.map((app) => app.appId),
}));

function fulfillContract(route: Route, data: unknown) {
  return route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ status: 'SUCCESS', message: 'OK', data }),
  });
}

/** Overrides the generic three-app shell fixture with the approved Wave 1 authority catalog. */
export async function routeCanonicalHomeWorkspaceApps(page: Page) {
  await page.route('**/api/platform/v1/workspace/apps', (route) =>
    fulfillContract(route, CANONICAL_HOME_WORKSPACE_APPS)
  );
  await page.route('**/api/platform/v1/workspace/apps/*/launch', (route) => {
    const appId = decodeURIComponent(new URL(route.request().url()).pathname.split('/').at(-2)!);
    const app = CANONICAL_HOME_WORKSPACE_APPS.find((candidate) => candidate.id === appId);
    return app
      ? fulfillContract(route, {
          appId,
          launchMode: app.launchMode,
          launchTarget: app.launchTarget,
          launchedAt: '2026-08-11T00:10:00Z',
        })
      : route.fulfill({ status: 404, json: { errorCode: 'WORKSPACE_APP_NOT_FOUND' } });
  });
}
