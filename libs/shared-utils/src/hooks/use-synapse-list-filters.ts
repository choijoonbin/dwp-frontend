/**
 * Synapse 리스트 페이지 공통 필터 훅
 * URL query ↔ filters state 양방향 동기화
 *
 * @see docs/backend-src/docs/api-spec/COMMON_FILTER_DTO_STANDARD.md
 */

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { parseQuery, serializeQuery } from '../contracts/synapse-filters';

export type SynapseRouteKey = 'cases' | 'anomalies' | 'actions';

const ROUTE_ALLOWED_KEYS: Record<SynapseRouteKey, readonly string[]> = {
  cases: [
    'range',
    'from',
    'to',
    'severity',
    'status',
    'q',
    'page',
    'size',
    'sort',
    'caseId',
    'caseKey',
    'driverType',
    'assigneeUserId',
    'assignee',
    'slaRisk',
    'approvalState',
    'ids',
    'company',
    'currency',
  ],
  anomalies: [
    'range',
    'from',
    'to',
    'severity',
    'status',
    'q',
    'page',
    'size',
    'sort',
    'type',
    'driverType',
    'entityId',
    'documentId',
    'bukrs',
    'waers',
  ],
  actions: [
    'range',
    'from',
    'to',
    'severity',
    'status',
    'q',
    'page',
    'size',
    'sort',
    'requiresApproval',
    'actionType',
    'resourceType',
    'resourceId',
    'assignee',
    'assigneeUserId',
    'focus',
    'caseId',
  ],
};

export type ParsedFilters = Record<string, string | string[]>;

/**
 * URL search params를 파싱하여 필터 객체 반환
 * 허용된 키만 추출
 */
function parseFiltersFromParams(
  searchParams: URLSearchParams,
  allowedKeys: readonly string[]
): ParsedFilters {
  const parsed = parseQuery(searchParams);
  const allowedSet = new Set(allowedKeys);
  const result: ParsedFilters = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (allowedSet.has(key)) result[key] = value;
  }
  return result;
}

/**
 * Synapse 리스트 페이지 공통 필터 훅
 * - URL → filters 파싱
 * - filters 변경 → URL push (shallow)
 * - Reset 시 URL query 제거
 */
export const useSynapseListFilters = (routeKey: SynapseRouteKey) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedKeys = ROUTE_ALLOWED_KEYS[routeKey];

  const filters = useMemo(
    () => parseFiltersFromParams(searchParams, allowedKeys),
    [searchParams, allowedKeys]
  );

  const setFilters = useCallback(
    (updates: ParsedFilters) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (!allowedKeys.includes(key)) continue;
        if (value === undefined || value === null || value === '') {
          next.delete(key);
        } else if (Array.isArray(value)) {
          if (value.length) next.set(key, value.join(','));
          else next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams, allowedKeys]
  );

  const setFilter = useCallback(
    (key: string, value: string | string[] | undefined) => {
      setFilters({ ...filters, [key]: value } as ParsedFilters);
    },
    [filters, setFilters]
  );

  const reset = useCallback(() => {
    const next = new URLSearchParams();
    setSearchParams(next, { replace: true });
  }, [setSearchParams]);

  const hasActiveFilters = useMemo(() => {
    const keys = Object.keys(filters);
    return keys.some((k) => {
      const v = filters[k];
      if (Array.isArray(v)) return v.length > 0;
      return v !== undefined && v !== null && String(v).trim() !== '';
    });
  }, [filters]);

  return { filters, setFilters, setFilter, reset, hasActiveFilters };
};
