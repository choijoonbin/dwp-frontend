import { useQuery } from '@tanstack/react-query';

import { createProductSurfaceQueryContract } from '../../../shell/product-surface-cache';

import {
  HRM007_ADAPTER_KIND,
  HRM007_QUERY_CONTRACTS,
  Hrm007ContractError,
  createHrm007QueryRequest,
  selectHrm007Projection,
} from './hrm-007-contract';

import type { Hrm007QueryAdapter } from './hrm-007-api';
import type { Hrm007QueryId, Hrm007QueryOptions, Hrm007TrustedScope } from './hrm-007-contract';

const ADAPTER_IDENTITIES = new WeakMap<object, number>();
let nextAdapterIdentity = 1;

function adapterIdentity(adapter: Hrm007QueryAdapter): number {
  const existing = ADAPTER_IDENTITIES.get(adapter);
  if (existing !== undefined) return existing;
  const identity = nextAdapterIdentity;
  nextAdapterIdentity += 1;
  ADAPTER_IDENTITIES.set(adapter, identity);
  return identity;
}

export function hrm007QueryContract(
  adapter: Hrm007QueryAdapter,
  queryId: Hrm007QueryId,
  scope: Hrm007TrustedScope,
  options: Hrm007QueryOptions = {}
) {
  const request = createHrm007QueryRequest(queryId, scope, options);
  const contract = HRM007_QUERY_CONTRACTS[queryId];
  return createProductSurfaceQueryContract(
    {
      tenantId: scope.tenantId,
      actorId: scope.actorId,
      accessMode: scope.accessMode,
      productId: contract.productId,
      surfaceId: contract.surfaceId,
      contextScopeKey: scope.contextScopeKey,
      decisionRevision: scope.decisionRevision,
    },
    'hris',
    'hrm-007',
    adapterIdentity(adapter),
    queryId,
    request.locale,
    request.timeZone,
    request.correlationId,
    request.asOf ?? 'current',
    request.cursor ?? 'first',
    request.limit,
    request.sort,
    request.filter
  );
}

export function hrm007QueryKey(
  adapter: Hrm007QueryAdapter,
  queryId: Hrm007QueryId,
  scope: Hrm007TrustedScope,
  options: Hrm007QueryOptions = {}
) {
  return hrm007QueryContract(adapter, queryId, scope, options).queryKey;
}

export function useHrm007WorkbenchQuery({
  adapter,
  queryId,
  scope,
  options,
}: Readonly<{
  adapter: Hrm007QueryAdapter;
  queryId: Hrm007QueryId;
  scope: Hrm007TrustedScope;
  options?: Hrm007QueryOptions;
}>) {
  const request = createHrm007QueryRequest(queryId, scope, options);
  const queryContract = hrm007QueryContract(adapter, queryId, scope, options);
  return useQuery({
    ...queryContract,
    queryFn: async ({ signal }) => {
      if (adapter.kind !== HRM007_ADAPTER_KIND) {
        throw new Error('The HRM-007 entry-query adapter is unavailable.');
      }
      const projection = selectHrm007Projection(
        queryId,
        await adapter.query(queryId, request, scope.contextScopeKey, signal)
      );
      if (projection.queryState.correlationId !== request.correlationId) {
        throw new Hrm007ContractError('queryState.correlationId');
      }
      if (
        projection.queryState.cachePolicy.authorizationDecisionRevision !== scope.decisionRevision
      ) {
        throw new Hrm007ContractError('queryState.cachePolicy.authorizationDecisionRevision');
      }
      return projection;
    },
    retry: false,
    staleTime: 0,
  });
}
