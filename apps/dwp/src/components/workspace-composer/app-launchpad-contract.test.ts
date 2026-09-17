import { describe, expect, it } from 'vitest';

import approvedLaunchpadContract from '../../../../../architecture/home-launchpad-contract.v1.json';

import {
  APPROVED_HOME_LAUNCHPAD_GROUP_ORDER,
  APPROVED_HOME_LAUNCHPAD_RESOURCE_KEYS,
  APPROVED_HOME_LAUNCHPAD_RESOURCE_ORDER,
  HOME_APP_GROUPS,
  HOME_APPS,
  filterHomeAppsByWorkspaceCatalog,
  resolveHomeLaunchpadCatalog,
} from './app-launchpad-model';

import type { TenantHomeLaunchpadConfiguration } from './app-launchpad-model';

describe('tenant launchpad policy', () => {
  const canonicalConfiguration = (): TenantHomeLaunchpadConfiguration => ({
    schemaVersion: 1,
    groups: APPROVED_HOME_LAUNCHPAD_GROUP_ORDER.map((groupKey, index) => ({
      groupKey,
      labels: { ko: `${groupKey}-ko`, en: `${groupKey}-en` },
      descriptions: { ko: `${groupKey}-description-ko`, en: `${groupKey}-description-en` },
      sortOrder: (index + 1) * 10,
      enabled: true,
    })),
    placements: APPROVED_HOME_LAUNCHPAD_GROUP_ORDER.flatMap((groupKey) =>
      APPROVED_HOME_LAUNCHPAD_RESOURCE_ORDER[groupKey].map((resourceKey, index) => ({
        resourceKey,
        groupKey,
        sortOrder: (index + 1) * 10,
      }))
    ),
  });

  const resourceProjection = (catalog: ReturnType<typeof resolveHomeLaunchpadCatalog>) =>
    catalog.apps.map((app) => [app.groupId, app.resourceKey]);

  it('pins the approved 5/7/2/4 groups, exact resource order, and unique app identity', () => {
    expect(HOME_APP_GROUPS.map((group) => group.id)).toEqual(APPROVED_HOME_LAUNCHPAD_GROUP_ORDER);
    expect(
      APPROVED_HOME_LAUNCHPAD_GROUP_ORDER.map(
        (groupKey) => APPROVED_HOME_LAUNCHPAD_RESOURCE_ORDER[groupKey].length
      )
    ).toEqual([5, 7, 2, 4]);
    expect(HOME_APPS.map((app) => app.resourceKey)).toEqual(APPROVED_HOME_LAUNCHPAD_RESOURCE_KEYS);
    expect(new Set(HOME_APPS.map((app) => app.id)).size).toBe(18);
    expect(new Set(HOME_APPS.map((app) => app.resourceKey)).size).toBe(18);
  });

  it('keeps the canonical route, icon, permission, and badge owner metadata stable', () => {
    const frontendContract = HOME_APPS.map(
      ({
        id,
        resourceKey,
        route,
        iconKey,
        requiredPermissionCode,
        notificationSourceKey,
        groupId,
      }) => ({
        id,
        resourceKey,
        route,
        iconKey,
        groupId,
        requiredPermissionCode,
        notificationSourceKey: notificationSourceKey ?? null,
      })
    );
    const machineReadableContract = approvedLaunchpadContract.groups.flatMap((group) =>
      group.apps.map((app) => ({
        id: app.appId,
        resourceKey: app.resourceKey,
        route: app.route,
        iconKey: app.iconKey,
        groupId: group.groupKey,
        requiredPermissionCode: app.requiredPermissionCode,
        notificationSourceKey: app.badgeSourceKey,
      }))
    );

    expect(frontendContract).toEqual(machineReadableContract);
  });

  it('makes a migrated server catalog and the explicit no-configuration bridge identical', () => {
    const fallback = resolveHomeLaunchpadCatalog(HOME_APPS, null, 'ko-KR', (key) => key);
    const migrated = resolveHomeLaunchpadCatalog(
      HOME_APPS,
      canonicalConfiguration(),
      'ko-KR',
      (key) => key
    );

    expect(fallback).toMatchObject({
      source: 'CANONICAL_FALLBACK',
      contractStatus: 'MISSING_SERVER_CONFIGURATION',
    });
    expect(migrated).toMatchObject({ source: 'SERVER', contractStatus: 'ALIGNED' });
    expect(resourceProjection(migrated)).toEqual(resourceProjection(fallback));
  });

  it('does not pad a partial existing-tenant response with frontend-only apps', () => {
    const partial = canonicalConfiguration();
    partial.placements = partial.placements.slice(0, 15);

    const catalog = resolveHomeLaunchpadCatalog(HOME_APPS, partial, 'ko-KR', (key) => key);

    expect(catalog).toMatchObject({ source: 'SERVER', contractStatus: 'SERVER_CONTRACT_DRIFT' });
    expect(catalog.apps).toHaveLength(15);
    expect(catalog.apps.map((app) => app.resourceKey)).toEqual(
      APPROVED_HOME_LAUNCHPAD_RESOURCE_KEYS.slice(0, 15)
    );
  });

  it('does not pad a partial successful workspace catalog with local apps', () => {
    const completeServerApps = HOME_APPS.map((app) => ({ id: app.id }));
    const serverApps = [
      ...HOME_APPS.slice(0, 15).map((app) => ({ id: app.id })),
      { id: HOME_APPS[0]!.id },
      { id: 'unknown-server-app' },
    ];

    expect(filterHomeAppsByWorkspaceCatalog(HOME_APPS, completeServerApps)).toEqual(HOME_APPS);
    expect(filterHomeAppsByWorkspaceCatalog(HOME_APPS, serverApps)).toEqual(HOME_APPS.slice(0, 15));
    expect(filterHomeAppsByWorkspaceCatalog(HOME_APPS, undefined)).toEqual(HOME_APPS);
  });

  it('canonicalizes legacy resource aliases while preserving the approved order', () => {
    const configuration = canonicalConfiguration();
    const aliases = new Map([
      ['APP.MAIL', 'APP.MAIL_CALENDAR'],
      ['APP.MESSAGING', 'APP.COLLABORATION'],
      ['APP.WORKPLACE', 'APP.ROOMS'],
      ['APP.HCM', 'APP.HRIS'],
    ]);
    configuration.placements = configuration.placements.map((placement) => ({
      ...placement,
      resourceKey: aliases.get(placement.resourceKey) ?? placement.resourceKey,
    }));

    const catalog = resolveHomeLaunchpadCatalog(HOME_APPS, configuration, 'en', (key) => key);

    expect(catalog).toMatchObject({ source: 'SERVER', contractStatus: 'ALIGNED' });
    expect(catalog.apps.map((app) => app.resourceKey)).toEqual(
      APPROVED_HOME_LAUNCHPAD_RESOURCE_KEYS
    );
  });

  it('deduplicates canonical and legacy aliases deterministically', () => {
    const configuration = canonicalConfiguration();
    const mail = configuration.placements.find(
      (placement) => placement.resourceKey === 'APP.MAIL'
    )!;
    configuration.placements.push({
      ...mail,
      resourceKey: 'APP.MAIL_CALENDAR',
      sortOrder: mail.sortOrder + 1,
    });

    const catalog = resolveHomeLaunchpadCatalog(HOME_APPS, configuration, 'en', (key) => key);

    expect(catalog.contractStatus).toBe('SERVER_CONTRACT_DRIFT');
    expect(catalog.apps.map((app) => app.resourceKey)).toEqual(
      APPROVED_HOME_LAUNCHPAD_RESOURCE_KEYS
    );
    expect(catalog.apps.filter((app) => app.resourceKey === 'APP.MAIL')).toHaveLength(1);
  });

  it.each([
    [
      'duplicate',
      (configuration: ReturnType<typeof canonicalConfiguration>) => {
        configuration.placements[1] = { ...configuration.placements[0]! };
      },
      17,
    ],
    [
      'wrong group',
      (configuration: ReturnType<typeof canonicalConfiguration>) => {
        configuration.placements[0] = {
          ...configuration.placements[0]!,
          groupKey: 'connect',
        };
      },
      17,
    ],
    [
      'wrong order',
      (configuration: ReturnType<typeof canonicalConfiguration>) => {
        configuration.placements[0]!.sortOrder = 30;
        configuration.placements[2]!.sortOrder = 10;
      },
      18,
    ],
    [
      'unknown resource',
      (configuration: ReturnType<typeof canonicalConfiguration>) => {
        configuration.placements[0] = {
          ...configuration.placements[0]!,
          resourceKey: 'APP.UNKNOWN',
        };
      },
      17,
    ],
  ])(
    'reports %s server contract drift without inventing a replacement placement',
    (_label, edit, expectedCount) => {
      const configuration = canonicalConfiguration();
      edit(configuration);

      const catalog = resolveHomeLaunchpadCatalog(HOME_APPS, configuration, 'en', (key) => key);

      expect(catalog.contractStatus).toBe('SERVER_CONTRACT_DRIFT');
      expect(catalog.source).toBe('SERVER');
      expect(catalog.apps).toHaveLength(expectedCount);
    }
  );
});
