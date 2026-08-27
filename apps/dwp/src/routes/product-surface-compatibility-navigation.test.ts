import { describe, expect, it } from 'vitest';

import { APPROVAL_PRODUCT_MANIFEST } from '../features/approvals/approval-product-manifest';
import { CALENDAR_PRODUCT_MANIFEST } from '../features/calendar/calendar-product-manifest';
import { COMMUNICATIONS_PRODUCT_MANIFEST } from '../features/communications/communications-product-manifest';
import { DWAION_SURFACE_MANIFEST } from '../features/dwaion/dwaion-product-manifest';
import { HCM_PRODUCT_MANIFEST } from '../features/hcm/hcm-product-manifest';
import { MAIL_PRODUCT_MANIFEST } from '../features/mail/mail-product-manifest';
import { MEETINGS_PRODUCT_MANIFEST } from '../features/meetings/meetings-product-manifest';
import { MESSAGING_PRODUCT_MANIFEST } from '../features/messaging/messaging-product-manifest';
import { NOTIFICATION_PRODUCT_MANIFEST } from '../features/notifications/notification-product-manifest';
import { WORKPLACE_PRODUCT_MANIFEST } from '../features/rooms/workplace-product-manifest';
import { SERVICES_PRODUCT_MANIFEST } from '../features/services/services-product-manifest';
import { SPACE_PRODUCT_MANIFEST } from '../features/spaces/space-product-manifest';
import {
  buildProductCompatibilityNavigationTargets,
  resolveProductCompatibilityNavigationLocation,
} from '../features/shell/product-surface-compatibility-navigation';
import type { ProductCompatibilityNavigationTarget } from '../features/shell/product-surface-compatibility-navigation';
import { REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG } from './product-page-route-contracts';
import { resolveConfiguredProductSurfacePresentation } from './configured-product-surface-shell';
import { buildProductCanaryLayoutRuntime } from './product-surface-canary-routes';
import { resolveProductRoot } from '../features/shell/product-root-resolver';

import type {
  ProductNavigationAccess,
  ProductSurfaceDefinition,
  ProductSurfaceManifest,
} from '../components/product-manifest';
import type { ProductSurfaceCanaryAuthority } from '../features/shell/product-surface-canary-runtime';
import type {
  EffectiveCapabilityGrant,
  EffectivePolicyGrant,
  EffectiveProductSurfaceContext,
  EffectiveScope,
  SurfaceDecision,
} from '../features/shell/product-surface-context';

const SERVER_NOW_MS = Date.parse('2029-01-01T00:00:00Z');
const REVALIDATE_AT = '2030-01-01T00:00:00Z';
const PRODUCTS = [
  { product: 'Approvals', manifest: APPROVAL_PRODUCT_MANIFEST },
  { product: 'Communications', manifest: COMMUNICATIONS_PRODUCT_MANIFEST },
  { product: 'Services', manifest: SERVICES_PRODUCT_MANIFEST },
  { product: 'HCM', manifest: HCM_PRODUCT_MANIFEST },
  { product: 'Dwaion', manifest: DWAION_SURFACE_MANIFEST },
  { product: 'Calendar', manifest: CALENDAR_PRODUCT_MANIFEST },
  { product: 'Mail', manifest: MAIL_PRODUCT_MANIFEST },
  { product: 'Meetings', manifest: MEETINGS_PRODUCT_MANIFEST },
  { product: 'Messaging', manifest: MESSAGING_PRODUCT_MANIFEST },
  { product: 'Notifications', manifest: NOTIFICATION_PRODUCT_MANIFEST },
  { product: 'Workplace', manifest: WORKPLACE_PRODUCT_MANIFEST },
  { product: 'Spaces', manifest: SPACE_PRODUCT_MANIFEST },
] as const;

function allowedTargetScope(target: ProductCompatibilityNavigationTarget | undefined): string {
  expect(target).toMatchObject({ state: 'allowed' });
  if (!target || target.state !== 'allowed') throw new Error('Expected an allowed target scope.');
  return target.targetScopeKey;
}

function contractKeys(access: ProductNavigationAccess): readonly string[] {
  if (access.type === 'policy') return [access.accessPolicyKey];
  if (access.type === 'capability') return [access.capabilityContractKey];
  return access.capabilityContractKeys;
}

function scopeFor(surface: ProductSurfaceDefinition): EffectiveScope {
  return {
    key: `${surface.id}-scope`,
    kind: surface.supportedScopeKinds[0],
    displayName: `${surface.id} scope`,
    isDefault: true,
    readOnly: false,
  };
}

function contextFor(
  manifest: ProductSurfaceManifest,
  surface: ProductSurfaceDefinition,
  multipleScopes = false
): EffectiveProductSurfaceContext {
  const primaryScope = scopeFor(surface);
  const scopes = multipleScopes
    ? [
        { ...primaryScope, key: `${surface.id}-scope-a`, isDefault: false },
        { ...primaryScope, key: `${surface.id}-scope-b`, isDefault: false },
      ]
    : [primaryScope];
  const capabilityKeys = new Set<string>();
  const policyKeys = new Set<string>();
  for (const item of surface.navigation.flatMap((group) => group.items)) {
    const target = item.access.type === 'policy' ? policyKeys : capabilityKeys;
    contractKeys(item.access).forEach((key) => target.add(key));
  }
  const capabilityGrants: EffectiveCapabilityGrant[] = [...capabilityKeys].map((key) => ({
    grantKind: 'CAPABILITY',
    capabilityContractKey: key,
    resolvedCapabilityCode: `resolved.${key}`,
    authorityMode: 'PERMISSION',
    responsibilityRequirement: 'NOT_REQUIRED',
    scopeKeys: scopes.map((scope) => scope.key),
    requiresProductEntitlement: false,
    readOnly: false,
    activationState: 'ACTIVE',
  }));
  const policyGrants: EffectivePolicyGrant[] = [...policyKeys].map((key) => ({
    grantKind: 'POLICY',
    accessPolicyKey: key,
    authorityMode: 'ENTITLEMENT',
    policyDecisionRef: `decision.${key}`,
    scopeKeys: scopes.map((scope) => scope.key),
    requiresProductEntitlement: false,
    readOnly: false,
  }));
  return {
    contextKey: `${surface.id}-context`,
    productKey: manifest.id,
    surfaceKey: surface.id,
    plane: surface.plane,
    accessMode: 'NORMAL',
    accessSource: surface.plane === 'work' ? 'ENTITLEMENT' : 'MANAGEMENT',
    appResourceKey: manifest.appKey,
    effectiveGrants: [...capabilityGrants, ...policyGrants],
    scopes,
    revalidateAt: REVALIDATE_AT,
  };
}

function authorityFor(
  manifest: ProductSurfaceManifest,
  options: {
    surfaces?: readonly ProductSurfaceDefinition[];
    deniedPaths?: readonly string[];
    expiredPaths?: readonly string[];
    scopeSelectionPaths?: readonly string[];
  } = {}
): ProductSurfaceCanaryAuthority {
  const surfaces = options.surfaces ?? manifest.surfaces;
  const deniedPaths = new Set(options.deniedPaths ?? []);
  const expiredPaths = new Set(options.expiredPaths ?? []);
  const scopeSelectionPaths = new Set(options.scopeSelectionPaths ?? []);
  const contexts = surfaces.map((surface) =>
    contextFor(
      manifest,
      surface,
      surface.navigation
        .flatMap((group) => group.items)
        .some((item) => scopeSelectionPaths.has(item.path))
    )
  );
  const routeDecisions: Record<string, SurfaceDecision> = {};
  for (const surface of surfaces) {
    const context = contexts.find((candidate) => candidate.surfaceKey === surface.id)!;
    for (const item of surface.navigation.flatMap((group) => group.items)) {
      const routes = REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.filter(
        (route) =>
          route.routeKind === 'PAGE' &&
          route.productId === manifest.id &&
          route.surfaceId === surface.id &&
          route.pattern === item.path
      );
      expect(routes, `${manifest.id}/${item.path} PAGE contract`).toHaveLength(1);
      const route = routes[0]!;
      routeDecisions[route.routeContractKey] = deniedPaths.has(item.path)
        ? { state: 'route-denied' }
        : scopeSelectionPaths.has(item.path)
          ? {
              state: 'scope-selection-required',
              detail: { decisionRevision: 'direct-revision' },
            }
          : {
              state: 'allowed',
              context,
              routeGrantRef: contractKeys(item.access)[0]!,
              scope: context.scopes[0]!,
              effectiveReadOnly: false,
              revalidateAt: expiredPaths.has(item.path) ? '2028-01-01T00:00:00Z' : REVALIDATE_AT,
              decisionRevision: 'direct-revision',
            };
    }
  }
  return {
    flags: {
      contextShadow: true,
      capabilityEnforcement: true,
      surfaceUi: false,
      surfaceUiEvaluation: 'resolved',
    },
    serverNowMs: SERVER_NOW_MS,
    envelope: {
      contractVersion: 'product-surfaces/v3',
      decisionRevision: 'list-revision',
      sourceRevisions: {},
      activeAccessMode: 'NORMAL',
      generatedAt: '2029-01-01T00:00:00Z',
      contexts,
    },
    routeDecisions,
  };
}

function mutateSurfaceContext(
  authority: ProductSurfaceCanaryAuthority,
  surfaceId: string,
  mutate: (context: EffectiveProductSurfaceContext) => EffectiveProductSurfaceContext
): ProductSurfaceCanaryAuthority {
  const envelope = authority.envelope!;
  return {
    ...authority,
    envelope: {
      ...envelope,
      contexts: envelope.contexts.map((context) =>
        context.surfaceKey === surfaceId ? mutate(context) : context
      ),
    },
  };
}

describe('rollout 110/111 exact navigation targets', () => {
  it('projects all six Approvals management items from their exact PAGE decisions in 111', () => {
    const managementPaths = APPROVAL_PRODUCT_MANIFEST.surfaces
      .find((surface) => surface.id === 'approvals.admin')!
      .navigation.flatMap((group) => group.items.map((item) => item.path));
    const targets = buildProductCompatibilityNavigationTargets({
      authority: authorityFor(APPROVAL_PRODUCT_MANIFEST),
      manifest: APPROVAL_PRODUCT_MANIFEST,
      registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
      rolloutMode: 'surface-ui',
    });

    expect(managementPaths).toHaveLength(6);
    expect(managementPaths.filter((path) => targets?.has(path))).toEqual(managementPaths);
  });

  it('projects all nine Work and six Management Approvals PAGEs from exact 111 decisions', () => {
    const authority = authorityFor(APPROVAL_PRODUCT_MANIFEST);
    const routeDecisions = { ...authority.routeDecisions };
    authority.routeDecisions = routeDecisions;
    const workSurface = APPROVAL_PRODUCT_MANIFEST.surfaces.find(
      (surface) => surface.id === 'approvals.work'
    )!;
    authority.envelope = {
      ...authority.envelope!,
      contexts: authority.envelope!.contexts.map((context) =>
        context.surfaceKey === workSurface.id
          ? {
              ...context,
              scopes: context.scopes.map((scope) => ({ ...scope, readOnly: true })),
            }
          : context
      ),
    };
    for (const item of workSurface.navigation.flatMap((group) => group.items)) {
      const route = REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.find(
        (candidate) =>
          candidate.routeKind === 'PAGE' &&
          candidate.productId === 'approvals' &&
          candidate.surfaceId === workSurface.id &&
          candidate.pattern === item.path
      )!;
      const existing = authority.routeDecisions?.[route.routeContractKey];
      expect(existing?.state).toBe('allowed');
      if (!existing || existing.state !== 'allowed') continue;
      const context: EffectiveProductSurfaceContext = {
        ...existing.context,
        contextKey: `ctx-direct-${route.routeId}`,
        appResourceKey:
          item.path === '/approvals/home'
            ? 'APP.APPROVALS'
            : item.path === '/approvals/inbox' || item.path === '/approvals/completed'
              ? 'ACTION.APPROVAL_TASK'
              : 'ACTION.APPROVAL_REQUEST',
      };
      routeDecisions[route.routeContractKey] = {
        ...existing,
        context,
      };
    }

    const targets = buildProductCompatibilityNavigationTargets({
      authority,
      manifest: APPROVAL_PRODUCT_MANIFEST,
      registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
      rolloutMode: 'surface-ui',
    });

    const workPaths = workSurface.navigation.flatMap((group) =>
      group.items.map((item) => item.path)
    );
    const managementPaths = APPROVAL_PRODUCT_MANIFEST.surfaces
      .find((surface) => surface.id === 'approvals.admin')!
      .navigation.flatMap((group) => group.items.map((item) => item.path));
    expect(workPaths).toHaveLength(9);
    expect(managementPaths).toHaveLength(6);
    expect(workPaths.filter((path) => targets?.has(path))).toEqual(workPaths);
    expect(managementPaths.filter((path) => targets?.has(path))).toEqual(managementPaths);
  });

  it('accepts HCM aggregate mixed scopes across root, header, and exact PAGE navigation', () => {
    const authority = authorityFor(HCM_PRODUCT_MANIFEST);
    const routeDecisions = { ...authority.routeDecisions };
    const mixedSurfaceIds = new Set(['hcm.team', 'hcm.operations']);
    const canonicalContexts = authority.envelope!.contexts.map((context) => {
      if (!mixedSurfaceIds.has(context.surfaceKey)) return context;
      return {
        ...context,
        scopes: [
          context.scopes[0]!,
          {
            key: `${context.surfaceKey}-target-population`,
            kind: 'TARGET_POPULATION' as const,
            displayName: `${context.surfaceKey} target population`,
            isDefault: false,
            readOnly: false,
          },
        ],
      };
    });
    authority.envelope = { ...authority.envelope!, contexts: canonicalContexts };

    for (const surfaceId of mixedSurfaceIds) {
      const canonical = canonicalContexts.find((context) => context.surfaceKey === surfaceId)!;
      const targetScope = canonical.scopes.find((scope) => scope.kind === 'TARGET_POPULATION')!;
      for (const route of REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.filter(
        (candidate) =>
          candidate.routeKind === 'PAGE' &&
          candidate.productId === 'hcm' &&
          candidate.surfaceId === surfaceId
      )) {
        const existing = routeDecisions[route.routeContractKey];
        expect(existing?.state, route.routeContractKey).toBe('allowed');
        if (!existing || existing.state !== 'allowed') continue;
        routeDecisions[route.routeContractKey] = {
          ...existing,
          context: {
            ...existing.context,
            contextKey: `direct-${route.routeId}`,
            appResourceKey: `PAGE.${route.routeId}`,
            scopes: [targetScope],
            effectiveGrants: existing.context.effectiveGrants.map((grant) => ({
              ...grant,
              scopeKeys: [targetScope.key],
            })),
          },
          scope: targetScope,
        };
      }
    }
    authority.routeDecisions = routeDecisions;

    expect(
      resolveProductRoot(HCM_PRODUCT_MANIFEST, authority.envelope!, { nowMs: SERVER_NOW_MS })
    ).toMatchObject({ type: 'redirect', surfaceId: 'hcm.personal' });

    const targetPaths = HCM_PRODUCT_MANIFEST.surfaces
      .filter((surface) => mixedSurfaceIds.has(surface.id))
      .flatMap((surface) =>
        surface.navigation.flatMap((group) => group.items.map((item) => item.path))
      );
    const targets = buildProductCompatibilityNavigationTargets({
      authority,
      manifest: HCM_PRODUCT_MANIFEST,
      registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
      rolloutMode: 'surface-ui',
    });
    expect(targetPaths).toHaveLength(11);
    expect(targetPaths.filter((path) => targets?.has(path))).toEqual(targetPaths);

    const personalRoute = REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.find(
      (route) => route.routeKind === 'PAGE' && route.pattern === '/hr/home'
    )!;
    const personalDecision = routeDecisions[personalRoute.routeContractKey];
    expect(personalDecision?.state).toBe('allowed');
    if (!personalDecision || personalDecision.state !== 'allowed') return;
    const runtime = buildProductCanaryLayoutRuntime({
      authority,
      manifest: HCM_PRODUCT_MANIFEST,
      decision: personalDecision,
      label: 'HCM',
      returnLabels: { work: 'Back to work', catalog: 'Back to apps' },
      registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
      rolloutMode: 'surface-ui',
    });
    expect(
      runtime.entryPoints?.filter((entry) => entry.entryKind === 'management-entry')
    ).toHaveLength(1);
  });

  it('keeps denied and unregistered 111 PAGE items undisclosed', () => {
    const managementPaths = APPROVAL_PRODUCT_MANIFEST.surfaces
      .find((surface) => surface.id === 'approvals.admin')!
      .navigation.flatMap((group) => group.items.map((item) => item.path));
    const [deniedPath, unregisteredPath] = managementPaths;
    const targets = buildProductCompatibilityNavigationTargets({
      authority: authorityFor(APPROVAL_PRODUCT_MANIFEST, { deniedPaths: [deniedPath!] }),
      manifest: APPROVAL_PRODUCT_MANIFEST,
      registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.filter(
        (route) => route.routeKind !== 'PAGE' || route.pattern !== unregisteredPath
      ),
      rolloutMode: 'surface-ui',
    });

    expect(targets).toBeDefined();
    expect(targets?.has(deniedPath!)).toBe(false);
    expect(targets?.has(unregisteredPath!)).toBe(false);
  });

  it.each(PRODUCTS)('$product shows authorized Work and Management items', ({ manifest }) => {
    const visible = buildProductCompatibilityNavigationTargets({
      authority: authorityFor(manifest),
      manifest,
      registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
      rolloutMode: 'enforced-compatibility',
    })!;

    for (const surface of manifest.surfaces) {
      const firstPath = surface.navigation.flatMap((group) => group.items)[0]?.path;
      expect(firstPath, `${surface.id} navigation`).toBeDefined();
      expect(visible.has(firstPath!), `${surface.id}/${firstPath}`).toBe(true);
      expect(visible.get(firstPath!)).toEqual({
        state: 'allowed',
        targetScopeKey: `${surface.id}-scope`,
      });
    }
  });

  it.each(PRODUCTS)('$product excludes an unauthorized exact PAGE item', ({ manifest }) => {
    const unauthorizedPath = manifest.surfaces
      .find((surface) => surface.plane === 'management')!
      .navigation.flatMap((group) => group.items)[0]!.path;
    const visible = buildProductCompatibilityNavigationTargets({
      authority: authorityFor(manifest, { deniedPaths: [unauthorizedPath] }),
      manifest,
      registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
      rolloutMode: 'enforced-compatibility',
    })!;

    expect(visible.has(unauthorizedPath)).toBe(false);
  });

  it.each(PRODUCTS)('$product excludes an expired exact PAGE item', ({ manifest }) => {
    const expiredPath = manifest.surfaces
      .find((surface) => surface.plane === 'management')!
      .navigation.flatMap((group) => group.items)[0]!.path;
    const visible = buildProductCompatibilityNavigationTargets({
      authority: authorityFor(manifest, { expiredPaths: [expiredPath] }),
      manifest,
      registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
      rolloutMode: 'enforced-compatibility',
    })!;

    expect(visible.has(expiredPath)).toBe(false);
  });

  it.each(PRODUCTS)(
    '$product supports a scoped-duty-only administrator without inventing Work access',
    ({ manifest }) => {
      const managementSurfaces = manifest.surfaces.filter(
        (surface) => surface.plane === 'management'
      );
      const visible = buildProductCompatibilityNavigationTargets({
        authority: authorityFor(manifest, { surfaces: managementSurfaces }),
        manifest,
        registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
        rolloutMode: 'enforced-compatibility',
      })!;

      expect(
        managementSurfaces
          .flatMap((surface) => surface.navigation)
          .flatMap((group) => group.items)
          .some((item) => visible.has(item.path))
      ).toBe(true);
      expect(
        manifest.surfaces
          .filter((surface) => surface.plane === 'work')
          .flatMap((surface) => surface.navigation)
          .flatMap((group) => group.items)
          .some((item) => visible.has(item.path))
      ).toBe(false);
    }
  );

  it.each(PRODUCTS)(
    '$product disables exact navigation targets before enforcement',
    ({ manifest }) => {
      const authority = authorityFor(manifest);
      for (const [state, rolloutMode] of [
        ['000', 'baseline'],
        ['100', 'shadow'],
      ] as const) {
        expect(
          buildProductCompatibilityNavigationTargets({
            authority,
            manifest,
            registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
            rolloutMode,
          }),
          state
        ).toBeUndefined();
      }
    }
  );

  it.each(PRODUCTS)(
    '$product exposes a trusted no-default multi-scope target and removes the source scope',
    ({ manifest }) => {
      const targetSurface = manifest.surfaces.find((surface) => surface.plane === 'management')!;
      const targetPath = targetSurface.navigation.flatMap((group) => group.items)[0]!.path;
      const targets = buildProductCompatibilityNavigationTargets({
        authority: authorityFor(manifest, { scopeSelectionPaths: [targetPath] }),
        manifest,
        registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
        rolloutMode: 'enforced-compatibility',
      })!;

      expect(targets.get(targetPath)).toEqual({
        state: 'scope-selection-required',
        targetScopeKeys: [`${targetSurface.id}-scope-a`, `${targetSurface.id}-scope-b`],
      });
      const destination = resolveProductCompatibilityNavigationLocation(
        targetPath,
        targets.get(targetPath)!,
        { search: '?scope=source-work-scope&view=exceptions', hash: '#queue' }
      );
      const search = new URLSearchParams(destination.search);
      expect(search.has('scope')).toBe(false);
      expect(search.get('view')).toBe('exceptions');
      expect(destination.hash).toBe('#queue');

      const sameSurfaceDestination = resolveProductCompatibilityNavigationLocation(
        targetPath,
        targets.get(targetPath)!,
        {
          search: `?scope=${targetSurface.id}-scope-b&view=exceptions`,
          hash: '#queue',
        }
      );
      const sameSurfaceSearch = new URLSearchParams(sameSurfaceDestination.search);
      expect(sameSurfaceSearch.get('scope')).toBe(`${targetSurface.id}-scope-b`);
      expect(sameSurfaceSearch.get('view')).toBe('exceptions');
      expect(sameSurfaceDestination.hash).toBe('#queue');
    }
  );

  it('fails closed for forged or incomplete HCM no-default scope-selection authority', () => {
    const targetSurface = HCM_PRODUCT_MANIFEST.surfaces.find(
      (surface) => surface.plane === 'management'
    )!;
    const targetPath = targetSurface.navigation.flatMap((group) => group.items)[0]!.path;
    const base = authorityFor(HCM_PRODUCT_MANIFEST, {
      scopeSelectionPaths: [targetPath],
    });
    const envelope = base.envelope!;
    const targetContext = envelope.contexts.find(
      (context) => context.surfaceKey === targetSurface.id
    )!;
    const targetRoute = REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG.find(
      (route) =>
        route.routeKind === 'PAGE' &&
        route.productId === HCM_PRODUCT_MANIFEST.id &&
        route.surfaceId === targetSurface.id &&
        route.pattern === targetPath
    )!;
    const cases: readonly { name: string; authority: ProductSurfaceCanaryAuthority }[] = [
      { name: 'missing envelope', authority: { ...base, envelope: undefined } },
      {
        name: 'missing decision revision',
        authority: { ...base, envelope: { ...envelope, decisionRevision: ' ' } },
      },
      {
        name: 'missing direct decision revision',
        authority: {
          ...base,
          routeDecisions: {
            ...base.routeDecisions,
            [targetRoute.routeContractKey]: { state: 'scope-selection-required' },
          },
        },
      },
      {
        name: 'non-string direct decision revision',
        authority: {
          ...base,
          routeDecisions: {
            ...base.routeDecisions,
            [targetRoute.routeContractKey]: {
              state: 'scope-selection-required',
              detail: { decisionRevision: 42 as unknown as string },
            },
          },
        },
      },
      {
        name: 'missing target context',
        authority: {
          ...base,
          envelope: {
            ...envelope,
            contexts: envelope.contexts.filter(
              (context) => context.surfaceKey !== targetSurface.id
            ),
          },
        },
      },
      {
        name: 'duplicate target context',
        authority: {
          ...base,
          envelope: { ...envelope, contexts: [...envelope.contexts, targetContext] },
        },
      },
      {
        name: 'wrong product identity',
        authority: mutateSurfaceContext(base, targetSurface.id, (context) => ({
          ...context,
          productKey: 'forged-product',
        })),
      },
      {
        name: 'missing canonical context key',
        authority: mutateSurfaceContext(base, targetSurface.id, (context) => ({
          ...context,
          contextKey: ' ',
        })),
      },
      {
        name: 'wrong owning plane',
        authority: mutateSurfaceContext(base, targetSurface.id, (context) => ({
          ...context,
          plane: 'work',
        })),
      },
      {
        name: 'wrong active access mode',
        authority: mutateSurfaceContext(base, targetSurface.id, (context) => ({
          ...context,
          accessMode: 'ELEVATED',
        })),
      },
      {
        name: 'another product context has a mixed access mode',
        authority: mutateSurfaceContext(base, 'hcm.personal', (context) => ({
          ...context,
          accessMode: 'ELEVATED',
        })),
      },
      {
        name: 'missing context revalidation',
        authority: mutateSurfaceContext(base, targetSurface.id, (context) => ({
          ...context,
          revalidateAt: undefined as unknown as string,
        })),
      },
      {
        name: 'invalid context revalidation',
        authority: mutateSurfaceContext(base, targetSurface.id, (context) => ({
          ...context,
          revalidateAt: 'invalid',
        })),
      },
      {
        name: 'expired context',
        authority: mutateSurfaceContext(base, targetSurface.id, (context) => ({
          ...context,
          revalidateAt: '2028-01-01T00:00:00Z',
        })),
      },
      {
        name: 'expired scope',
        authority: mutateSurfaceContext(base, targetSurface.id, (context) => ({
          ...context,
          scopes: context.scopes.map((scope) => ({
            ...scope,
            validUntil: '2028-01-01T00:00:00Z',
          })),
        })),
      },
      {
        name: 'default scope exists',
        authority: mutateSurfaceContext(base, targetSurface.id, (context) => ({
          ...context,
          scopes: context.scopes.map((scope, index) => ({
            ...scope,
            isDefault: index === 0,
          })),
        })),
      },
      {
        name: 'scope selection is not actually ambiguous',
        authority: mutateSurfaceContext(base, targetSurface.id, (context) => ({
          ...context,
          scopes: context.scopes.slice(0, 1),
        })),
      },
      {
        name: 'item access has no effective grant',
        authority: mutateSurfaceContext(base, targetSurface.id, (context) => ({
          ...context,
          effectiveGrants: [],
        })),
      },
    ];

    for (const candidate of cases) {
      const targets = buildProductCompatibilityNavigationTargets({
        authority: candidate.authority,
        manifest: HCM_PRODUCT_MANIFEST,
        registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
        rolloutMode: 'enforced-compatibility',
      })!;
      expect(targets.has(targetPath), candidate.name).toBe(false);
    }
  });

  it('propagates exact Work and Management scopes without losing other URL state', () => {
    const targets = buildProductCompatibilityNavigationTargets({
      authority: authorityFor(HCM_PRODUCT_MANIFEST),
      manifest: HCM_PRODUCT_MANIFEST,
      registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
      rolloutMode: 'enforced-compatibility',
    })!;
    const workPath = HCM_PRODUCT_MANIFEST.surfaces
      .find((surface) => surface.plane === 'work')!
      .navigation.flatMap((group) => group.items)[0]!.path;
    const managementPath = HCM_PRODUCT_MANIFEST.surfaces
      .find((surface) => surface.plane === 'management')!
      .navigation.flatMap((group) => group.items)[0]!.path;
    const workScope = allowedTargetScope(targets.get(workPath));
    const managementScope = allowedTargetScope(targets.get(managementPath));

    const toManagement = resolveProductCompatibilityNavigationLocation(
      managementPath,
      targets.get(managementPath)!,
      { search: `?scope=${workScope}&view=exceptions`, hash: '#queue' }
    );
    expect(toManagement).toEqual({
      pathname: managementPath,
      search: `?scope=${managementScope}&view=exceptions`,
      hash: '#queue',
    });

    const toWork = resolveProductCompatibilityNavigationLocation(workPath, targets.get(workPath)!, {
      search: `?view=team&scope=${managementScope}`,
      hash: '#summary',
    });
    expect(new URLSearchParams(toWork.search).get('scope')).toBe(workScope);
    expect(new URLSearchParams(toWork.search).get('view')).toBe('team');
    expect(toWork.hash).toBe('#summary');
  });
});

describe('configured product shell rollout presentation', () => {
  it.each(PRODUCTS)(
    '$product preserves legacy authorization at 000/100 and separates every enforced shell',
    ({ manifest }) => {
      for (const surface of manifest.surfaces) {
        expect(resolveConfiguredProductSurfacePresentation('baseline', surface.plane)).toBe(
          'legacy'
        );
        expect(resolveConfiguredProductSurfacePresentation('shadow', surface.plane)).toBe('legacy');
        expect(
          resolveConfiguredProductSurfacePresentation('enforced-compatibility', surface.plane)
        ).toBe(surface.plane === 'management' ? 'compatibility-management' : 'compatibility-work');
        expect(resolveConfiguredProductSurfacePresentation('surface-ui', surface.plane)).toBe(
          surface.plane === 'management' ? 'separated-management' : 'separated-work'
        );
      }
    }
  );

  it('fails closed for an invalid configured rollout', () => {
    expect(resolveConfiguredProductSurfacePresentation('invalid', 'work')).toBe('unavailable');
  });
});
