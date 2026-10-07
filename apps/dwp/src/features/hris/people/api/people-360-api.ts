import { axiosInstance } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import type { ApiResponse } from '@dwp-frontend/shared-utils';
import type {
  People360DataSource,
  People360ListRequest,
  People360SelfDataSource,
  People360TeamDataSource,
} from '../model/people-360-view-model';

const PEOPLE_360_PATH = '/api/people/v1/workforce/people';
const SELF_PEOPLE_360_PATH = '/api/people/v1/hr/home';
const TEAM_PEOPLE_360_PATH = '/api/people/v1/hr/team';

export async function listPeople360(request: People360ListRequest): Promise<unknown> {
  const search = new URLSearchParams({
    projection: request.projection,
    asOf: request.asOf,
    size: String(request.size ?? 50),
  });
  if (request.query?.trim()) search.set('query', request.query.trim());
  if (request.status) search.set('status', request.status);
  if (request.cursor) search.set('cursor', request.cursor);
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${PEOPLE_360_PATH}?${search.toString()}`,
    productSurfaceReadScopeConfig(request.contextScopeKey, request.signal)
  );
  return response.data.data;
}

export async function getPeople360(
  personId: string,
  asOf: string,
  projection: 'people360',
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<unknown> {
  const search = new URLSearchParams({ projection, asOf });
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${PEOPLE_360_PATH}/${encodeURIComponent(personId)}?${search.toString()}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getSelfPeople360(
  asOf: string,
  projection: 'people360',
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<unknown> {
  const search = new URLSearchParams({ projection, asOf });
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${SELF_PEOPLE_360_PATH}?${search.toString()}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export async function getTeamPeople360(
  personId: string,
  asOf: string,
  projection: 'people360',
  contextScopeKey?: string,
  signal?: AbortSignal
): Promise<unknown> {
  const search = new URLSearchParams({ projection, personId, asOf });
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${TEAM_PEOPLE_360_PATH}?${search.toString()}`,
    productSurfaceReadScopeConfig(contextScopeKey, signal)
  );
  return response.data.data;
}

export const people360DataSource: People360DataSource = {
  list: listPeople360,
  detail: getPeople360,
};

export const people360SelfDataSource: People360SelfDataSource = {
  self: getSelfPeople360,
};

export const people360TeamDataSource: People360TeamDataSource = {
  detail: getTeamPeople360,
};
