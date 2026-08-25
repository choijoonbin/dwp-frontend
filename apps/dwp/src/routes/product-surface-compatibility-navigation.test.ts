import { describe, expect, it } from 'vitest';

import { APPROVAL_PRODUCT_MANIFEST } from '../features/approvals/approval-product-manifest';
import { CALENDAR_PRODUCT_MANIFEST } from '../features/calendar/calendar-product-manifest';
import { COMMUNICATIONS_PRODUCT_MANIFEST } from '../features/communications/communications-product-manifest';
import { DWAION_SURFACE_MANIFEST } from '../features/dwaion/dwaion-product-manifest';
import { HCM_PRODUCT_MANIFEST } from '../features/hcm/hcm-product-manifest';
import { MAIL_PRODUCT_MANIFEST } from '../features/mail/mail-product-manifest';
import { MESSAGING_PRODUCT_MANIFEST } from '../features/messaging/messaging-product-manifest';
import { NOTIFICATION_PRODUCT_MANIFEST } from '../features/notifications/notification-product-manifest';
import { WORKPLACE_PRODUCT_MANIFEST } from '../features/rooms/workplace-product-manifest';
import { SERVICES_PRODUCT_MANIFEST } from '../features/services/services-product-manifest';
import { SPACE_PRODUCT_MANIFEST } from '../features/spaces/space-product-manifest';
import {
  buildProductCompatibilityNavigation,
  buildProductCompatibilityNavigationTargets,
  resolveProductCompatibilityNavigationLocation,
} from '../features/shell/product-surface-compatibility-navigation';
import type { ProductCompatibilityNavigationTarget } from '../features/shell/product-surface-compatibility-navigation';
import { REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG } from './product-page-route-contracts';
import { resolveConfiguredProductSurfacePresentation } from './configured-product-surface-shell';

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

describe('rollout 110 exact combined navigation', () => {
  it.each(PRODUCTS)('$product combines every manifest-owned Surface menu', ({ manifest }) => {
    const combined = buildProductCompatibilityNavigation(manifest);
    const combinedPaths = combined.flatMap((group) => group.items.map((item) => item.path));
    const manifestPaths = manifest.surfaces.flatMap((surface) =>
      surface.navigation.flatMap((group) => group.items.map((item) => item.path))
    );

    expect(combinedPaths).toEqual(manifestPaths);
    expect(new Set(combinedPaths).size).toBe(manifestPaths.length);
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

  it.each(PRODUCTS)('$product limits the compatibility projection to state 110', ({ manifest }) => {
    const authority = authorityFor(manifest);
    for (const [state, rolloutMode] of [
      ['000', 'baseline'],
      ['100', 'shadow'],
      ['111', 'surface-ui'],
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
  });

  it.each(PRODUCTS)(
    '$product exposes a trusted no-default multi-scope target and removes the source scope',
    ({ manifest }) => {
      const targetPath = manifest.surfaces
        .find((surface) => surface.plane === 'management')!
        .navigation.flatMap((group) => group.items)[0]!.path;
      const targets = buildProductCompatibilityNavigationTargets({
        authority: authorityFor(manifest, { scopeSelectionPaths: [targetPath] }),
        manifest,
        registeredRoutes: REGISTERED_PRODUCT_PAGE_ROUTE_CATALOG,
        rolloutMode: 'enforced-compatibility',
      })!;

      expect(targets.get(targetPath)).toEqual({ state: 'scope-selection-required' });
      const destination = resolveProductCompatibilityNavigationLocation(
        targetPath,
        targets.get(targetPath)!,
        { search: '?scope=source-work-scope&view=exceptions', hash: '#queue' }
      );
      const search = new URLSearchParams(destination.search);
      expect(search.has('scope')).toBe(false);
      expect(search.get('view')).toBe('exceptions');
      expect(destination.hash).toBe('#queue');
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
    '$product preserves 000/100 legacy, 110 compatibility, and 111 plane separation',
    ({ manifest }) => {
      for (const surface of manifest.surfaces) {
        expect(resolveConfiguredProductSurfacePresentation('baseline', surface.plane)).toBe(
          'legacy'
        );
        expect(resolveConfiguredProductSurfacePresentation('shadow', surface.plane)).toBe('legacy');
        expect(
          resolveConfiguredProductSurfacePresentation('enforced-compatibility', surface.plane)
        ).toBe('compatibility');
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
