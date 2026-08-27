import { describe, expect, it } from 'vitest';

import {
  findForeignProductRouteContractKeys,
  projectProductAuthorizationRoutes,
  type ProductAuthorizationRouteProjectionSource,
} from './product-application-artifact-policy';

const routes: readonly ProductAuthorizationRouteProjectionSource[] = [
  {
    routeContractKey: 'route.approvals.work.submit.action',
    routeKind: 'ACTION',
    subjectType: 'PRODUCT',
    productId: 'approvals',
    surfaceId: 'approvals.work',
  },
  {
    routeContractKey: 'route.services.work.submit.action',
    routeKind: 'ACTION',
    subjectType: 'PRODUCT',
    productId: 'services',
    surfaceId: 'services.work',
  },
  {
    routeContractKey: 'route.context.work__work.review-decision.action',
    routeKind: 'ACTION',
    subjectType: 'GOVERNED_CONTEXT',
    productId: null,
    surfaceId: null,
  },
];

describe('independent product artifact policy', () => {
  it('projects only the selected product authorization routes by default', () => {
    expect(
      projectProductAuthorizationRoutes(routes, {
        productIds: ['approvals'],
        includeGovernedContextRoutes: false,
      }).map((route) => route.routeContractKey)
    ).toEqual(['route.approvals.work.submit.action']);
  });

  it('keeps the Workspace governed-context exception explicit', () => {
    expect(
      projectProductAuthorizationRoutes(routes, {
        productIds: [],
        includeGovernedContextRoutes: true,
      }).map((route) => route.routeContractKey)
    ).toEqual(['route.context.work__work.review-decision.action']);
  });

  it('rejects foreign keys while allowing only exact Administration exceptions', () => {
    const emitted = [
      'route.approvals.admin.overview.page',
      'route.approvals.admin.workflow-publish.action',
      'route.services.work.home.page',
    ].join(' ');

    expect(
      findForeignProductRouteContractKeys(emitted, {
        productIds: [],
        exactRouteContractKeys: ['route.approvals.admin.overview.page'],
      })
    ).toEqual(['route.approvals.admin.workflow-publish.action', 'route.services.work.home.page']);
  });

  it('fails closed for malformed product authorization identities', () => {
    expect(() =>
      projectProductAuthorizationRoutes(
        [
          {
            routeContractKey: 'route.services.work.submit.action',
            routeKind: 'ACTION',
            subjectType: 'PRODUCT',
            productId: 'approvals',
            surfaceId: 'approvals.work',
          },
        ],
        { productIds: ['approvals'], includeGovernedContextRoutes: false }
      )
    ).toThrow(/invalid product identity/u);
  });
});
