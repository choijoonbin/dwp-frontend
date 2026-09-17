import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

const BASE = '/api/platform/v1/workplace';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

export type WorkplaceResourceFavorite = Readonly<{
  resourceId: string;
  favorite: boolean;
  version: number;
  updatedAt: string | null;
}>;

export type WorkplaceResourceFavoriteReceipt = Readonly<{
  commandId: string;
  favorite: WorkplaceResourceFavorite;
  auditEventId: string;
  correlationId: string | null;
  completedAt: string;
}>;

type SetFavoriteInput = Readonly<{
  favorite: boolean;
  expectedVersion: number;
}>;

type CommandOptions = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
}>;

function invalid(label: string): never {
  throw new Error(`Invalid Workplace resource favorite response: ${label}.`);
}

function object(value: unknown, label: string): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : invalid(label);
}

function identifier(value: unknown, label: string) {
  return typeof value === 'string' && uuid.test(value) ? value : invalid(label);
}

function instant(value: unknown, label: string) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : invalid(label);
}

function parseFavorite(value: unknown): WorkplaceResourceFavorite {
  const row = object(value, 'favorite');
  if (typeof row.favorite !== 'boolean') return invalid('favorite.favorite');
  if (!Number.isSafeInteger(row.version) || Number(row.version) < 0)
    return invalid('favorite.version');
  if (row.updatedAt !== null && row.updatedAt !== undefined)
    instant(row.updatedAt, 'favorite.updatedAt');
  if (Number(row.version) === 0 && row.updatedAt !== null) return invalid('favorite.updatedAt');
  return {
    resourceId: identifier(row.resourceId, 'favorite.resourceId'),
    favorite: row.favorite,
    version: Number(row.version),
    updatedAt: row.updatedAt == null ? null : String(row.updatedAt),
  };
}

function parseReceipt(value: unknown): WorkplaceResourceFavoriteReceipt {
  const row = object(value, 'receipt');
  return {
    commandId: identifier(row.commandId, 'receipt.commandId'),
    favorite: parseFavorite(row.favorite),
    auditEventId: identifier(row.auditEventId, 'receipt.auditEventId'),
    correlationId:
      row.correlationId === null || row.correlationId === undefined
        ? null
        : typeof row.correlationId === 'string' && row.correlationId.length <= 160
          ? row.correlationId
          : invalid('receipt.correlationId'),
    completedAt: instant(row.completedAt, 'receipt.completedAt'),
  };
}

function resourceId(value: string) {
  if (!uuid.test(value)) throw new Error('A valid Workplace resource id is required.');
  return encodeURIComponent(value);
}

export async function getWorkplaceResourceFavorites(
  resourceIds: readonly string[] = []
): Promise<readonly WorkplaceResourceFavorite[]> {
  if (resourceIds.length > 200) throw new Error('At most 200 resource ids may be queried.');
  const query = new URLSearchParams();
  resourceIds.forEach((value) => query.append('resourceIds', resourceId(value)));
  const suffix = query.size ? `?${query}` : '';
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${BASE}/resource-favorites${suffix}`
  );
  if (!Array.isArray(response.data.data)) return invalid('favorites');
  return response.data.data.map(parseFavorite);
}

export async function setWorkplaceResourceFavorite(
  id: string,
  input: SetFavoriteInput,
  options: CommandOptions
): Promise<WorkplaceResourceFavoriteReceipt> {
  if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 0)
    throw new Error('A valid favorite version is required.');
  if (!options.idempotencyKey.match(/^[!-~]{1,160}$/u))
    throw new Error('A valid favorite idempotency key is required.');
  const response = await axiosInstance.put<ApiResponse<unknown>>(
    `${BASE}/resources/${resourceId(id)}/favorite`,
    input,
    {
      headers: {
        'Idempotency-Key': options.idempotencyKey,
        ...(options.correlationId ? { 'X-Correlation-ID': options.correlationId } : {}),
      },
    }
  );
  return parseReceipt(response.data.data);
}
