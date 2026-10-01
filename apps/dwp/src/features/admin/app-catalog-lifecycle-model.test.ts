import { describe, expect, it } from 'vitest';

import type {
  AppGovernanceDashboard,
  CatalogEntity,
  ProductSurfaceContextListData,
} from '@dwp-frontend/shared-utils';

import {
  buildAppLifecycleCatalog,
  buildAppLifecycleProvenance,
} from './app-catalog-lifecycle-model';

const manifest = {
  id: 'mail',
  appKey: 'APP.MAIL',
  surfaces: [
    {
      id: 'mail.work',
      plane: 'work',
      labelKey: 'surfaces.work',
      taskKinds: ['work'],
      indexPath: '/mail/home',
      supportedScopeKinds: ['SELF'],
    },
    {
      id: 'mail.management',
      plane: 'management',
      labelKey: 'surfaces.management',
      taskKinds: ['administration'],
      indexPath: '/mail/admin/overview',
      supportedScopeKinds: ['RESOURCE_SET'],
    },
  ],
} as const;

const registry: CatalogEntity = {
  ref: 'catalog:mail',
  kind: 'APP',
  key: 'APP.MAIL',
  name: 'Mail',
  lifecycleState: 'ACTIVE',
  riskTier: 'OPERATIONAL',
  scope: 'TENANT',
  revision: 7,
  metadata: {},
};

const governance = {
  metrics: {
    activeAssignments: 1,
    pendingApprovals: 0,
    reviewsDueSoon: 0,
    resourcesWithoutOwner: 0,
  },
  responsibilities: [],
  principals: [],
  resourceSets: [
    {
      resourceSetId: 'rs-mail',
      key: 'RS_MAIL',
      name: 'Mail administrators',
      lifecycleState: 'ACTIVE',
      version: 1,
      resources: [{ resourceType: 'APP', resourceKey: 'APP.MAIL', resourceName: 'Mail' }],
    },
  ],
  assignments: [
    {
      assignmentId: 'assignment-1',
      resourceSetId: 'rs-mail',
      lifecycleState: 'ACTIVE',
    },
  ],
} as unknown as AppGovernanceDashboard;

const authority = {
  contexts: [
    {
      contextKey: 'mail-work',
      productKey: 'mail',
      surfaceKey: 'mail.work',
      plane: 'work',
      accessMode: 'NORMAL',
      accessSource: 'ENTITLEMENT',
      appResourceKey: 'APP.MAIL',
      effectiveGrants: [],
      scopes: [],
      revalidateAt: '2026-09-18T00:00:00Z',
    },
  ],
} as unknown as ProductSurfaceContextListData;

describe('application lifecycle catalog', () => {
  it('joins tenant installation and workforce assignment owners without inferring runnability', () => {
    const [item] = buildAppLifecycleCatalog({
      catalogEntities: [registry],
      catalogStatus: 'ready',
      manifests: [manifest],
      governance,
      governanceStatus: 'ready',
      authority,
      authorityStatus: 'ready',
      adoption: {
        observedAt: '2026-09-29T00:00:00Z',
        coverageState: 'COMPLETE_INTERNAL_OWNERS',
        includedOwners: ['AUTH_TENANT_APP_INSTALLATION'],
        exclusions: ['EXTERNAL_SAAS_PROVISIONING'],
        requestableAppResourceKeys: ['APP.MAIL'],
        installations: [
          {
            installationId: 'installation-mail',
            productKey: 'mail',
            appResourceKey: 'APP.MAIL',
            installationKind: 'INTERNAL_AUTH_CONTROLLED',
            lifecycleState: 'ENABLED',
            externalExecutorState: 'NOT_REQUIRED',
            seatCapacity: 50,
            reservedSeats: 2,
            activeSeats: 1,
            justification: 'Adopt Mail for the tenant workforce.',
            requestedBy: 10,
            version: 3,
            createdAt: '2026-09-29T00:00:00Z',
            updatedAt: '2026-09-29T00:00:00Z',
            allowedActions: ['REQUEST_ASSIGNMENT'],
          },
        ],
      },
      adoptionStatus: 'ready',
      workforceAssignments: [
        {
          assignmentId: 'assignment-mail',
          installationId: 'installation-mail',
          productKey: 'mail',
          userId: 40,
          userDisplayName: 'Mail administrator',
          lifecycleState: 'ACTIVE',
          seatQuantity: 1,
          sourceType: 'TENANT_DIRECT',
          externalSettlementState: 'NOT_REQUIRED',
          justification: 'Assign Mail for tenant administration.',
          requestedBy: 10,
          version: 3,
          createdAt: '2026-09-29T00:00:00Z',
          updatedAt: '2026-09-29T00:00:00Z',
          allowedActions: [],
        },
      ],
      workforceAssignmentsStatus: 'ready',
    });

    expect(item).toMatchObject({
      registry: { state: 'OBSERVED', lifecycleState: 'ACTIVE', revision: 7 },
      tenantAdminBoundary: { state: 'OBSERVED', count: 1 },
      currentActorEntitlement: { state: 'OBSERVED', sources: ['ENTITLEMENT'] },
      installation: {
        state: 'OBSERVED',
        lifecycleState: 'ENABLED',
        activeSeats: 1,
        reservedSeats: 2,
        seatCapacity: 50,
      },
      workforceAssignment: { state: 'OBSERVED', active: 1, pending: 0 },
      runnable: { state: 'OBSERVED', surfaceCount: 1 },
      adminAssignments: { state: 'OBSERVED', active: 1, pending: 0 },
      managementPath: '/mail/admin/overview',
      managementAccess: 'NOT_OBSERVED',
    });
  });

  it('does not turn an owner read failure into a negative tenant or actor state', () => {
    const [item] = buildAppLifecycleCatalog({
      catalogEntities: [registry],
      catalogStatus: 'ready',
      manifests: [manifest],
      governanceStatus: 'unavailable',
      authorityStatus: 'unavailable',
    });

    expect(item?.tenantAdminBoundary.state).toBe('UNAVAILABLE');
    expect(item?.currentActorEntitlement.state).toBe('UNAVAILABLE');
    expect(item?.runnable.state).toBe('UNAVAILABLE');
    expect(item?.adminAssignments.state).toBe('UNAVAILABLE');
  });

  it('does not turn a catalog owner read failure into a not-registered state', () => {
    const [item] = buildAppLifecycleCatalog({
      catalogEntities: [],
      catalogStatus: 'unavailable',
      manifests: [manifest],
      governanceStatus: 'unavailable',
      authorityStatus: 'unavailable',
    });

    expect(item?.registry.state).toBe('UNAVAILABLE');
  });

  it('keeps loading distinct from an unavailable owner and a confirmed negative', () => {
    const [item] = buildAppLifecycleCatalog({
      catalogEntities: [],
      catalogStatus: 'loading',
      manifests: [manifest],
      governanceStatus: 'loading',
      authorityStatus: 'loading',
      adoptionStatus: 'loading',
      workforceAssignmentsStatus: 'loading',
    });

    expect(item?.registry.state).toBe('LOADING');
    expect(item?.tenantAdminBoundary.state).toBe('LOADING');
    expect(item?.currentActorEntitlement.state).toBe('LOADING');
    expect(item?.installation.state).toBe('LOADING');
    expect(item?.workforceAssignment.state).toBe('LOADING');
    expect(item?.runnable.state).toBe('LOADING');
    expect(item?.adminAssignments.state).toBe('LOADING');
    expect(item?.managementAccess).toBe('LOADING');
  });

  it('counts a preset aggregate and its underlying responsibility assignment once', () => {
    const dashboard = {
      ...governance,
      presetAssignments: [
        {
          presetAssignmentId: 'preset-assignment-1',
          responsibilityAssignmentId: 'assignment-1',
          resourceSetId: 'rs-mail',
          lifecycleState: 'ACTIVE',
        },
      ],
    } as unknown as AppGovernanceDashboard;

    const [item] = buildAppLifecycleCatalog({
      catalogEntities: [registry],
      catalogStatus: 'ready',
      manifests: [manifest],
      governance: dashboard,
      governanceStatus: 'ready',
      authority,
      authorityStatus: 'ready',
    });

    expect(item?.adminAssignments).toEqual({ state: 'OBSERVED', active: 1, pending: 0 });
  });

  it('preserves authority revision and tenant-owner coverage provenance', () => {
    const provenance = buildAppLifecycleProvenance({
      authority: {
        ...authority,
        generatedAt: '2026-09-29T01:00:00Z',
        decisionRevision: 'decision-7',
        sourceRevisions: { auth: 'auth-7', policy: 'policy-4' },
      } as ProductSurfaceContextListData,
      authorityStatus: 'ready',
      adoption: {
        observedAt: '2026-09-29T01:01:00Z',
        coverageState: 'COMPLETE_INTERNAL_OWNERS',
        includedOwners: ['AUTH_TENANT_APP_INSTALLATION'],
        exclusions: ['EXTERNAL_SAAS_PROVISIONING'],
        requestableAppResourceKeys: [],
        installations: [],
      },
      adoptionStatus: 'ready',
    });

    expect(provenance).toEqual({
      authority: {
        state: 'OBSERVED',
        generatedAt: '2026-09-29T01:00:00Z',
        decisionRevision: 'decision-7',
        sourceRevisionCount: 2,
      },
      adoption: {
        state: 'OBSERVED',
        observedAt: '2026-09-29T01:01:00Z',
        coverageState: 'COMPLETE_INTERNAL_OWNERS',
        ownerCount: 1,
        exclusionCount: 1,
      },
    });
  });

  it('keeps an authority-only internal app key out of the display name', () => {
    const [item] = buildAppLifecycleCatalog({
      catalogEntities: [],
      catalogStatus: 'ready',
      manifests: [],
      governanceStatus: 'ready',
      authority: {
        ...authority,
        contexts: [
          {
            ...authority.contexts[0],
            productKey: 'internal-product',
            appResourceKey: 'APP.INTERNAL_ONLY',
          },
        ],
      } as ProductSurfaceContextListData,
      authorityStatus: 'ready',
    });

    expect(item?.appKey).toBe('APP.INTERNAL_ONLY');
    expect(item?.displayName).toBeUndefined();
  });
});
