import { describe, expect, it } from 'vitest';

import type {
  AppGovernanceDashboard,
  CatalogEntity,
  ProductSurfaceContextListData,
} from '@dwp-frontend/shared-utils';

import { buildAppLifecycleCatalog } from './app-catalog-lifecycle-model';

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
  it('keeps installation and workforce assignment unconfirmed even when admin data exists', () => {
    const [item] = buildAppLifecycleCatalog({
      catalogEntities: [registry],
      catalogStatus: 'ready',
      manifests: [manifest],
      governance,
      governanceStatus: 'ready',
      authority,
      authorityStatus: 'ready',
    });

    expect(item).toMatchObject({
      registry: { state: 'OBSERVED', lifecycleState: 'ACTIVE', revision: 7 },
      tenantAdminBoundary: { state: 'OBSERVED', count: 1 },
      currentActorEntitlement: { state: 'OBSERVED', sources: ['ENTITLEMENT'] },
      installation: { state: 'UNAVAILABLE' },
      workforceAssignment: { state: 'UNAVAILABLE' },
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
});
