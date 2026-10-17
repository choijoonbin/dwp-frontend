import { axiosInstance } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  HRIS_ORGANIZATION_GRAPH_PATH,
  HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND,
  organizationGraphQueryString,
  selectOrganizationGraphWithPositionsV2,
} from './organization-positions-contract';

import type {
  HrisOrganizationPositionsQueryAdapter,
  OrganizationGraphWithPositionsV2,
  OrganizationGraphWithPositionsV2Query,
} from './organization-positions-contract';

export async function queryHrisOrganizationGraph(
  request: OrganizationGraphWithPositionsV2Query,
  signal: AbortSignal,
  contextScopeKey?: string
): Promise<OrganizationGraphWithPositionsV2> {
  const response = await axiosInstance.get<unknown>(
    `${HRIS_ORGANIZATION_GRAPH_PATH}?${organizationGraphQueryString(request)}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return selectOrganizationGraphWithPositionsV2(response.data, request);
}

export function createHrisOrganizationPositionsQueryAdapter(
  contextScopeKey?: string
): HrisOrganizationPositionsQueryAdapter {
  return Object.freeze({
    kind: HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND,
    query: (request: OrganizationGraphWithPositionsV2Query, signal: AbortSignal) =>
      queryHrisOrganizationGraph(request, signal, contextScopeKey),
  });
}
