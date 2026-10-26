import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { RouteObject } from 'react-router-dom';

import { HCM_PRODUCT_MANIFEST } from '../features/hcm/hcm-product-manifest';
import { MESSAGING_PRODUCT_MANIFEST } from '../features/messaging/messaging-product-manifest';

import {
  ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE,
  PRODUCT_LEGACY_ROUTE_SOURCE,
  PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE,
  REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
} from './product-page-route-contracts';
import { DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE } from './draft-product-page-route-contracts';
import { buildProductPageRouteContractSource } from './draft-product-page-route-contract-source';
import { hcmRoutes } from './hcm-routes';
import {
  PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS,
  PRODUCT_AUTHORIZATION_REGISTRY_REVISION,
  PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS,
  PRODUCT_SURFACE_ROLLOUT_PRODUCTS,
} from './product-surface-authorization.generated';
import { resolveProductLegacyRoute } from './product-route-contract-source';

const MAIL_ORGANIZATION_PAGE_ROUTE_KEYS = [
  'route.mail.work.archive.page',
  'route.mail.work.spam.page',
  'route.mail.work.trash.page',
  'route.mail.work.folders.page',
  'route.mail.work.organization.page',
] as const;

const R7_BATCH_01_HCM_PAGE_ROUTES = [
  {
    routeContractKey: 'route.hcm.configuration.settings-operations.page',
    routeId: 'hcm.management.settings-operations',
    pattern: '/hr/settings/operations',
    productId: 'hcm',
    surfaceId: 'hcm.management',
  },
  {
    routeContractKey: 'route.hcm.operations.organization-positions.page',
    routeId: 'hcm.operations.organization-positions',
    pattern: '/hr/operations/people/organization-positions',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
  },
  {
    routeContractKey: 'route.hcm.operations.payroll-population.page',
    routeId: 'hcm.operations.payroll-population',
    pattern: '/hr/operations/payroll/population',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
  },
  {
    routeContractKey: 'route.hcm.operations.time-command-center.page',
    routeId: 'hcm.operations.time-command-center',
    pattern: '/hr/operations/time/command-center',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
  },
  {
    routeContractKey: 'route.hcm.operations.time-daily-close.page',
    routeId: 'hcm.operations.time-daily-close',
    pattern: '/hr/operations/time/daily-close',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
  },
  {
    routeContractKey: 'route.hcm.operations.time-monthly-close.page',
    routeId: 'hcm.operations.time-monthly-close',
    pattern: '/hr/operations/time/monthly-close',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
  },
] as const;

const R7_BATCH_02_HCM_PAGE_ROUTES = [
  {
    routeContractKey: 'route.hcm.configuration.people-employment.page',
    routeId: 'hcm.management.people-employment',
    pattern: '/hr/settings/people-employment',
    productId: 'hcm',
    surfaceId: 'hcm.management',
  },
  {
    routeContractKey: 'route.hcm.configuration.workflow.page',
    routeId: 'hcm.management.workflow',
    pattern: '/hr/settings/workflow',
    productId: 'hcm',
    surfaceId: 'hcm.management',
  },
  {
    routeContractKey: 'route.hcm.operations.people-appointments.page',
    routeId: 'hcm.operations.people-appointments',
    pattern: '/hr/operations/people/appointments',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
  },
  {
    routeContractKey: 'route.hcm.team.delegation.page',
    routeId: 'hcm.team.delegation',
    pattern: '/hr/team/delegation',
    productId: 'hcm',
    surfaceId: 'hcm.team',
  },
  {
    routeContractKey: 'route.hcm.team.people-changes.page',
    routeId: 'hcm.team.people-changes',
    pattern: '/hr/team/people-changes',
    productId: 'hcm',
    surfaceId: 'hcm.team',
  },
] as const;

const R7_BATCH_03_HCM_PAGE_ROUTES = [
  {
    routeContractKey: 'route.hcm.operations.certificates-documents.page',
    routeId: 'hcm.operations.certificates-documents',
    pattern: '/hr/operations/people/certificates-documents',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
  },
  {
    routeContractKey: 'route.hcm.personal.requests.page',
    routeId: 'hcm.personal.requests',
    pattern: '/hr/me/requests',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
  },
] as const;

const R7_BATCH_04_05_HCM_PAGE_ROUTES = [
  {
    routeContractKey: 'route.hcm.configuration.settings-performance.page',
    routeId: 'hcm.management.settings-performance',
    pattern: '/hr/settings/performance',
    productId: 'hcm',
    surfaceId: 'hcm.management',
  },
  {
    routeContractKey: 'route.hcm.configuration.statutory.page',
    routeId: 'hcm.configuration.statutory',
    pattern: '/hr/settings/statutory',
    productId: 'hcm',
    surfaceId: 'hcm.management',
  },
  {
    routeContractKey: 'route.hcm.operations.contracts-compensation-basis.page',
    routeId: 'hcm.operations.contracts-compensation-basis',
    pattern: '/hr/operations/people/contracts-compensation-basis',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
  },
  {
    routeContractKey: 'route.hcm.operations.pay-retirement.page',
    routeId: 'hcm.operations.pay-retirement',
    pattern: '/hr/operations/payroll/retirement',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
  },
  {
    routeContractKey: 'route.hcm.operations.pay-tax-social-insurance.page',
    routeId: 'hcm.operations.pay-tax-social-insurance',
    pattern: '/hr/operations/payroll/tax-social-insurance',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
  },
  {
    routeContractKey: 'route.hcm.operations.people-data-quality.page',
    routeId: 'hcm.operations.people-data-quality',
    pattern: '/hr/operations/people/data-quality',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
  },
  {
    routeContractKey: 'route.hcm.operations.performance-forms-scales.page',
    routeId: 'hcm.operations.performance-forms-scales',
    pattern: '/hr/operations/performance/forms-scales',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
  },
] as const;

const R7_BATCH_05_PER008_HCM_PAGE_ROUTES = [
  {
    routeContractKey: 'route.hcm.personal.performance-feedback.page',
    routeId: 'hcm.personal.performance-feedback',
    pattern: '/hr/me/performance/feedback',
    productId: 'hcm',
    surfaceId: 'hcm.personal',
  },
  {
    routeContractKey: 'route.hcm.team.performance.page',
    routeId: 'hcm.team.performance',
    pattern: '/hr/team/performance',
    productId: 'hcm',
    surfaceId: 'hcm.team',
  },
] as const;

const SYS008_CATALOG_ONLY_HCM_PAGE_ROUTES = [
  {
    routeContractKey: 'route.hcm.configuration.settings-integrations.page',
    routeId: 'hcm.management.settings-integrations',
    pattern: '/hr/settings/integrations',
    productId: 'hcm',
    surfaceId: 'hcm.management',
  },
] as const;

const HRM013_CATALOG_ONLY_HCM_PAGE_ROUTES = [
  {
    routeContractKey: 'route.hcm.operations.exit-return.page',
    routeId: 'hcm.operations.exit-return',
    pattern: '/hr/operations/people/exit-return',
    productId: 'hcm',
    surfaceId: 'hcm.operations',
  },
] as const;

const CATALOG_ONLY_HCM_PAGE_ROUTES = [
  ...SYS008_CATALOG_ONLY_HCM_PAGE_ROUTES,
  ...HRM013_CATALOG_ONLY_HCM_PAGE_ROUTES,
  ...R7_BATCH_05_PER008_HCM_PAGE_ROUTES,
] as const;

type PageRouteTuple = {
  routeContractKey: string;
  routeId: string;
  pattern: string;
  productId: string;
  surfaceId: string;
};

const pageRouterSource = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'architecture/product-page-routes.v1.json'), 'utf8')
) as {
  pageRoutes: PageRouteTuple[];
  catalogOnlyPageContracts: PageRouteTuple[];
};

function mountedRouteContractKeys(routes: readonly RouteObject[]): string[] {
  return routes.flatMap((route) => {
    const handle = route.handle as { routeContractKey?: string } | undefined;
    return [
      ...(handle?.routeContractKey ? [handle.routeContractKey] : []),
      ...mountedRouteContractKeys(route.children ?? []),
    ];
  });
}

const authorizationSnapshot = JSON.parse(
  fs.readFileSync(
    path.resolve(process.cwd(), 'architecture/product-surface-authorization.v1.json'),
    'utf8'
  )
) as {
  index: { indexChecksum: string };
  latestAlias: { bundleKey: string; version: number; checksum: string };
  bundles: Array<{
    bundleKey: string;
    version: number;
    routes: Array<{
      routeContractKey: string;
      routeKind: 'PAGE' | 'DATA' | 'ACTION';
      bindingMode?: 'AUTHORIZATION_ONLY';
      purposeCode?: string;
      gatewayApiBindings: unknown[];
      servicePepBindings: unknown[];
      accessProfiles: Array<{
        requiredAccess: { capabilityContractKey: string };
        responseProjectionBindings?: unknown[];
      }>;
    }>;
  }>;
};
const latestAuthorizationBundles = authorizationSnapshot.bundles.filter(
  (bundle) =>
    bundle.bundleKey === authorizationSnapshot.latestAlias.bundleKey &&
    bundle.version === authorizationSnapshot.latestAlias.version
);
if (latestAuthorizationBundles.length !== 1) {
  throw new Error('Latest product authorization bundle is not exact');
}
const latestAuthorizationBundle = latestAuthorizationBundles[0]!;

describe('generated product route authorization contracts', () => {
  it('closes the PAGE authorization catalog over runtime and catalog-only metadata', () => {
    const router = [...PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE].sort((left, right) =>
      left.routeContractKey.localeCompare(right.routeContractKey)
    );
    const catalogOnly = [...pageRouterSource.catalogOnlyPageContracts].sort((left, right) =>
      left.routeContractKey.localeCompare(right.routeContractKey)
    );
    const registry = PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS.map((route) => ({
      routeContractKey: route.routeContractKey,
      routeId: route.routeId,
      pattern: route.pattern,
      productId: route.productId,
      surfaceId: route.surfaceId,
    })).sort((left, right) => left.routeContractKey.localeCompare(right.routeContractKey));

    expect(PRODUCT_AUTHORIZATION_REGISTRY_REVISION).toEqual({
      bundleKey: authorizationSnapshot.latestAlias.bundleKey,
      version: authorizationSnapshot.latestAlias.version,
      checksum: authorizationSnapshot.latestAlias.checksum,
      indexChecksum: authorizationSnapshot.index.indexChecksum,
    });
    expect(PRODUCT_SURFACE_ROLLOUT_PRODUCTS).toEqual([
      'approvals',
      'calendar',
      'communications',
      'dwaion',
      'hcm',
      'mail',
      'meetings',
      'messaging',
      'notifications',
      'services',
      'spaces',
      'workplace',
    ]);
    expect(router).toHaveLength(158);
    expect(catalogOnly).toEqual([...CATALOG_ONLY_HCM_PAGE_ROUTES]);
    expect(registry).toEqual(
      [...router, ...catalogOnly].sort((left, right) =>
        left.routeContractKey.localeCompare(right.routeContractKey)
      )
    );
    expect(
      router.filter((route) =>
        R7_BATCH_01_HCM_PAGE_ROUTES.some(
          (expected) => expected.routeContractKey === route.routeContractKey
        )
      )
    ).toEqual([...R7_BATCH_01_HCM_PAGE_ROUTES]);
    expect(
      router.filter((route) =>
        R7_BATCH_02_HCM_PAGE_ROUTES.some(
          (expected) => expected.routeContractKey === route.routeContractKey
        )
      )
    ).toEqual([...R7_BATCH_02_HCM_PAGE_ROUTES]);
    expect(
      router.filter((route) =>
        R7_BATCH_03_HCM_PAGE_ROUTES.some(
          (expected) => expected.routeContractKey === route.routeContractKey
        )
      )
    ).toEqual([...R7_BATCH_03_HCM_PAGE_ROUTES]);
    expect(
      router.filter((route) =>
        R7_BATCH_04_05_HCM_PAGE_ROUTES.some(
          (expected) => expected.routeContractKey === route.routeContractKey
        )
      )
    ).toEqual([...R7_BATCH_04_05_HCM_PAGE_ROUTES]);
    expect(
      catalogOnly.filter((route) =>
        R7_BATCH_05_PER008_HCM_PAGE_ROUTES.some(
          (expected) => expected.routeContractKey === route.routeContractKey
        )
      )
    ).toEqual([...R7_BATCH_05_PER008_HCM_PAGE_ROUTES]);
    expect(() =>
      buildProductPageRouteContractSource(
        [HCM_PRODUCT_MANIFEST],
        PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE
      )
    ).not.toThrow();
    expect(() =>
      buildProductPageRouteContractSource(
        [HCM_PRODUCT_MANIFEST],
        PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.map((route) =>
          route.routeContractKey === 'route.hcm.audit.evidence.page'
            ? { ...route, routeId: 'hcm.audit.hris-alias' }
            : route
        )
      )
    ).toThrow(/outside its surface boundary/u);
  });

  it('keeps both PER-008 PAGE contracts out of every executable Router catalog', () => {
    const catalogOnlyKeys = new Set(
      R7_BATCH_05_PER008_HCM_PAGE_ROUTES.map((route) => route.routeContractKey)
    );
    const mountedKeys = new Set(mountedRouteContractKeys(hcmRoutes));

    expect(
      PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter((route) => route.productId === 'hcm')
    ).toHaveLength(65);
    for (const routeContractKey of catalogOnlyKeys) {
      expect(
        pageRouterSource.pageRoutes.some((route) => route.routeContractKey === routeContractKey)
      ).toBe(false);
      expect(
        PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.some(
          (route) => route.routeContractKey === routeContractKey
        )
      ).toBe(false);
      expect(
        ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.some(
          (route) => route.routeContractKey === routeContractKey
        )
      ).toBe(false);
      expect(
        REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.some(
          (route) => route.routeContractKey === routeContractKey
        )
      ).toBe(false);
      expect(mountedKeys.has(routeContractKey)).toBe(false);
    }
  });

  it('keeps the SYS-008 settings projection cataloged but unmounted', () => {
    const routeContractKey = 'route.hcm.configuration.settings-integrations.page';
    const mountedKeys = new Set(mountedRouteContractKeys(hcmRoutes));

    expect(pageRouterSource.catalogOnlyPageContracts).toContainEqual(
      SYS008_CATALOG_ONLY_HCM_PAGE_ROUTES[0]
    );
    expect(
      pageRouterSource.pageRoutes.some((route) => route.routeContractKey === routeContractKey)
    ).toBe(false);
    expect(
      PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.some(
        (route) => route.routeContractKey === routeContractKey
      )
    ).toBe(false);
    expect(
      ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.some(
        (route) => route.routeContractKey === routeContractKey
      )
    ).toBe(false);
    expect(
      REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.some(
        (route) => route.routeContractKey === routeContractKey
      )
    ).toBe(false);
    expect(mountedKeys.has(routeContractKey)).toBe(false);
  });

  it('keeps the HRM-013 exit-return projection cataloged but unmounted', () => {
    const routeContractKey = 'route.hcm.operations.exit-return.page';
    const mountedKeys = new Set(mountedRouteContractKeys(hcmRoutes));

    expect(pageRouterSource.catalogOnlyPageContracts).toContainEqual(
      HRM013_CATALOG_ONLY_HCM_PAGE_ROUTES[0]
    );
    expect(
      pageRouterSource.pageRoutes.some((route) => route.routeContractKey === routeContractKey)
    ).toBe(false);
    expect(
      PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.some(
        (route) => route.routeContractKey === routeContractKey
      )
    ).toBe(false);
    expect(
      ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.some(
        (route) => route.routeContractKey === routeContractKey
      )
    ).toBe(false);
    expect(
      REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.some(
        (route) => route.routeContractKey === routeContractKey
      )
    ).toBe(false);
    expect(mountedKeys.has(routeContractKey)).toBe(false);
  });

  it('never turns DATA or ACTION registry records into browser routes', () => {
    const nonPages = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter(
      (route) => route.routeKind !== 'PAGE'
    );
    const countByKind = PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.reduce<Record<string, number>>(
      (counts, route) => ({ ...counts, [route.routeKind]: (counts[route.routeKind] ?? 0) + 1 }),
      {}
    );

    const latestCountByKind = latestAuthorizationBundle.routes.reduce<Record<string, number>>(
      (counts, route) => ({ ...counts, [route.routeKind]: (counts[route.routeKind] ?? 0) + 1 }),
      {}
    );
    expect(PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS).toHaveLength(
      latestAuthorizationBundle.routes.length
    );
    expect(countByKind).toEqual(latestCountByKind);
    expect(nonPages).toHaveLength(
      latestAuthorizationBundle.routes.filter((route) => route.routeKind !== 'PAGE').length
    );
    expect(nonPages.every((route) => route.routeId === null && route.pattern === null)).toBe(true);
    expect(DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE).toHaveLength(71);
    expect(ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE).toHaveLength(229);
    expect(REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG).toHaveLength(229);
    expect(REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.every((route) => route.routeKind === 'PAGE')).toBe(
      true
    );
    expect(
      PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
        (route) => route.routeContractKey === 'route.dwaion.work.activity.page'
      )
    ).toEqual([
      {
        routeId: 'dwaion.work.activity',
        pattern: '/dwaion/activity',
        productId: 'dwaion',
        surfaceId: 'dwaion.work',
        routeContractKey: 'route.dwaion.work.activity.page',
      },
    ]);
    expect(
      DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
        (route) => route.routeContractKey === 'route.dwaion.work.activity.page'
      )
    ).toEqual([]);
    for (const view of ['routines', 'personal-controls', 'artifacts']) {
      const expected = {
        routeId: `dwaion.work.${view}`,
        pattern: `/dwaion/${view}`,
        productId: 'dwaion',
        surfaceId: 'dwaion.work',
        routeContractKey: `route.dwaion.work.${view}.page`,
      };
      expect(
        PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
          (route) => route.routeContractKey === `route.dwaion.work.${view}.page`
        )
      ).toEqual([expected]);
      expect(
        DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
          (route) => route.routeContractKey === `route.dwaion.work.${view}.page`
        )
      ).toEqual([]);
      expect(
        PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS.filter(
          (route) => route.routeContractKey === `route.dwaion.work.${view}.page`
        )
      ).toEqual([expect.objectContaining(expected)]);
    }
  });

  it('keeps SYS authorization-only PAGE evidence outside network catalogs', () => {
    const expected = [
      {
        routeContractKey: 'route.hcm.configuration.workflow.page',
        capabilityContractKey: 'hcm.configuration.workflow.view',
        purposeCode: 'HRIS_CONFIGURATION',
      },
      {
        routeContractKey: 'route.hcm.team.delegation.page',
        capabilityContractKey: 'hcm.team.members.view',
        purposeCode: 'TEAM_MANAGEMENT',
      },
    ] as const;

    for (const contract of expected) {
      expect(
        PRODUCT_AUTHORIZATION_PAGE_PROJECTIONS.find(
          (route) => route.routeContractKey === contract.routeContractKey
        )
      ).toMatchObject({ gatewayBindings: [] });
      expect(
        latestAuthorizationBundle.routes.find(
          (route) => route.routeContractKey === contract.routeContractKey
        )
      ).toMatchObject({
        routeKind: 'PAGE',
        bindingMode: 'AUTHORIZATION_ONLY',
        purposeCode: contract.purposeCode,
        gatewayApiBindings: [],
        servicePepBindings: [],
        accessProfiles: [
          {
            requiredAccess: {
              capabilityContractKey: contract.capabilityContractKey,
            },
          },
        ],
      });
      expect(
        latestAuthorizationBundle.routes
          .find((route) => route.routeContractKey === contract.routeContractKey)
          ?.accessProfiles.some((profile) => 'responseProjectionBindings' in profile)
      ).toBe(false);
    }
  });

  it('keeps Mail contacts and Meeting follow-ups/templates/preferences DRAFT without registry promotion', () => {
    for (const [productId, view] of [
      ['mail', 'contacts'],
      ['meetings', 'follow-ups'],
      ['meetings', 'templates'],
      ['meetings', 'preferences'],
    ]) {
      const routeContractKey = `route.${productId}.work.${view}.page`;
      const expected = {
        routeId: `${productId}.work.${view}`,
        pattern: `/${productId}/${view}`,
        productId,
        surfaceId: `${productId}.work`,
        routeContractKey,
      };
      expect(
        DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
          (route) => route.routeContractKey === routeContractKey
        )
      ).toEqual([expected]);
      expect(
        ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
          (route) => route.routeContractKey === routeContractKey
        )
      ).toEqual([expected]);
      expect(
        REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.filter(
          (route) => route.routeContractKey === routeContractKey
        )
      ).toEqual([expect.objectContaining({ ...expected, routeKind: 'PAGE' })]);
      expect(
        PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.some(
          (route) => route.routeContractKey === routeContractKey
        )
      ).toBe(false);
      expect(
        PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.some(
          (route) => route.routeContractKey === routeContractKey
        )
      ).toBe(false);
    }
  });

  it('mounts a representative official PAGE without hiding the remaining product routes', () => {
    const messagingRoutes = buildProductPageRouteContractSource(
      [MESSAGING_PRODUCT_MANIFEST],
      PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE
    );

    expect(
      messagingRoutes.filter((route) => route.routeContractKey === 'route.messaging.work.home.page')
    ).toEqual([
      {
        routeContractKey: 'route.messaging.work.home.page',
        routeId: 'messaging.work.home',
        pattern: '/messages/home',
        productId: 'messaging',
        surfaceId: 'messaging.work',
      },
    ]);
    expect(messagingRoutes.some((route) => route.pattern === '/messages/inbox')).toBe(true);
    expect(messagingRoutes.some((route) => route.pattern === '/messages/admin/overview')).toBe(
      true
    );
  });

  it('keeps the five Mail organization routes as frontend-owned PAGE records only', () => {
    const mailRouteKeys = new Set<string>(MAIL_ORGANIZATION_PAGE_ROUTE_KEYS);
    const draftRoutes = DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter((route) =>
      mailRouteKeys.has(route.routeContractKey)
    );
    const registeredRoutes = REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.filter((route) =>
      mailRouteKeys.has(route.routeContractKey)
    );

    expect(draftRoutes.map((route) => route.routeContractKey).sort()).toEqual(
      [...MAIL_ORGANIZATION_PAGE_ROUTE_KEYS].sort()
    );
    expect(registeredRoutes.map((route) => route.routeContractKey).sort()).toEqual(
      [...MAIL_ORGANIZATION_PAGE_ROUTE_KEYS].sort()
    );
    expect(registeredRoutes.every((route) => route.routeKind === 'PAGE')).toBe(true);
    expect(
      PRODUCT_AUTHORIZATION_ROUTE_PROJECTIONS.filter((route) =>
        mailRouteKeys.has(route.routeContractKey)
      )
    ).toEqual([]);
  });

  it('owns only the exact Canary dynamic PAGE 4+2 allowlist', () => {
    const dynamic = PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.filter(
      (route) => route.productId === 'communications' || route.productId === 'services'
    )
      .filter((route) => route.pattern.includes(':'))
      .map((route) => route.pattern)
      .sort();

    expect(dynamic).toEqual([
      '/communications/all/:storyId',
      '/communications/for-you/:storyId',
      '/communications/required/:storyId',
      '/communications/saved/:storyId',
      '/services/drafts/:requestId',
      '/services/my/:requestId',
    ]);
  });

  it('keeps all 14 central aliases registry-owned, URL-preserving, and one-hop only', () => {
    expect(PRODUCT_LEGACY_ROUTE_SOURCE).toHaveLength(14);
    expect(
      PRODUCT_LEGACY_ROUTE_SOURCE.every(
        (redirect) => redirect.maxHops === 1 && redirect.preserveQuery && redirect.preserveHash
      )
    ).toBe(true);
    for (const redirect of PRODUCT_LEGACY_ROUTE_SOURCE) {
      const target = ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.find(
        (route) => route.routeContractKey === redirect.targetRouteContractKey
      );
      expect(target, redirect.redirectId).toBeDefined();
      const draftTarget = DRAFT_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE.some(
        (route) => route.routeContractKey === redirect.targetRouteContractKey
      );
      expect(redirect.targetLifecycle === 'DRAFT', redirect.redirectId).toBe(draftTarget);
      expect(redirect.targetPath, redirect.redirectId).toBe(
        draftTarget ? target!.pattern : undefined
      );
      expect(
        resolveProductLegacyRoute(
          redirect.sourcePath,
          '?scope=scope-1',
          '#history',
          PRODUCT_LEGACY_ROUTE_SOURCE,
          ALL_PRODUCT_PAGE_ROUTE_CONTRACT_SOURCE
        ),
        redirect.redirectId
      ).toEqual({
        redirectId: redirect.redirectId,
        target: `${target!.pattern}?scope=scope-1#history`,
        maxHops: 1,
      });
    }
  });
});
