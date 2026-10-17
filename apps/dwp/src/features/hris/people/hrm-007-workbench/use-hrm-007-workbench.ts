import { useQuery } from '@tanstack/react-query';

import {
  HRM007_ADAPTER_KIND,
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

export function hrm007QueryKey(
  adapter: Hrm007QueryAdapter,
  queryId: Hrm007QueryId,
  scope: Hrm007TrustedScope,
  options: Hrm007QueryOptions = {}
) {
  const request = createHrm007QueryRequest(queryId, scope, options);
  return Object.freeze([
    'hris',
    'hrm-007',
    adapterIdentity(adapter),
    queryId,
    scope.contextScopeKey,
    scope.decisionRevision,
    request.locale,
    request.timeZone,
    request.correlationId,
    request.asOf ?? 'current',
    request.cursor ?? 'first',
    request.limit,
    request.sort,
    request.filter,
  ] as const);
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
  return useQuery({
    queryKey: hrm007QueryKey(adapter, queryId, scope, options),
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
