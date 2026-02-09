/**
 * 감사 추적 로그 필터 — URLSearchParams 단일 소스
 * 새로고침/공유 시 동일 상태 재현
 */

import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getDateRangeFromPreset } from '../utils/audit-date-utils';

import type {
  AuditFilters,
  AuditOutcome,
  AuditActorType,
  AuditApiParams,
  AuditDatePreset,
  AuditBasicFilters,
  AuditEventCategory,
} from '../types';

// ----------------------------------------------------------------------

const DEFAULT_BASIC: AuditBasicFilters = {
  datePreset: '24h',
  from: '',
  to: '',
  eventCategory: '',
  eventTypeFilter: '',
  outcome: '',
  actorType: '',
  q: '',
};

const DEFAULT_ADVANCED = {
  eventType: [] as string[],
  severity: [] as string[],
  resourceType: [] as string[],
  resourceId: '',
  actorUserId: '',
  actorAgentId: '',
  traceId: '',
  spanId: '',
  gatewayRequestId: '',
  ipAddress: '',
  userAgent: '',
  tags: [] as string[],
};

/** URL → filters */
const paramsToFilters = (params: URLSearchParams): AuditFilters => {
  const get = (k: string) => params.get(k) ?? '';
  const getArray = (k: string) => {
    const v = params.get(k);
    return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
  };

  const presetVal = get('datePreset') || get('range') || '24h';
  const validPresets: AuditDatePreset[] = ['today', '1h', '6h', '24h', '7d', '30d', '90d', 'custom'];
  const datePreset = (validPresets.includes(presetVal as AuditDatePreset) ? presetVal : '24h') as AuditDatePreset;
  const { from, to } = getDateRangeFromPreset(
    datePreset,
    get('from') || undefined,
    get('to') || undefined
  );

  return {
    ...DEFAULT_BASIC,
    datePreset,
    from: get('from') || from,
    to: get('to') || to,
    eventCategory: get('eventCategory') as AuditEventCategory,
    eventTypeFilter: get('eventTypeFilter'),
    outcome: get('outcome') as AuditOutcome,
    actorType: get('actorType') as AuditActorType,
    q: get('q'),
    ...DEFAULT_ADVANCED,
    eventType: getArray('eventType'),
    severity: getArray('severity'),
    resourceType: getArray('resourceType'),
    resourceId: get('resourceId'),
    actorUserId: get('actorUserId'),
    actorAgentId: get('actorAgentId'),
    traceId: get('traceId'),
    spanId: get('spanId'),
    gatewayRequestId: get('gatewayRequestId'),
    ipAddress: get('ipAddress'),
    userAgent: get('userAgent'),
    tags: getArray('tags'),
  };
};

/** filters → URL (빈값 제거, 멀티 정렬) */
const filtersToParams = (f: AuditFilters): URLSearchParams => {
  const p = new URLSearchParams();
  if (f.datePreset) p.set('datePreset', f.datePreset);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.eventCategory) p.set('eventCategory', f.eventCategory);
  if (f.eventTypeFilter?.trim()) p.set('eventTypeFilter', f.eventTypeFilter.trim());
  if (f.outcome) p.set('outcome', f.outcome);
  if (f.actorType) p.set('actorType', f.actorType);
  if (f.q?.trim()) p.set('q', f.q.trim());
  if (f.eventType?.length) p.set('eventType', [...f.eventType].sort().join(','));
  if (f.severity?.length) p.set('severity', [...f.severity].sort().join(','));
  if (f.resourceType?.length) p.set('resourceType', [...f.resourceType].sort().join(','));
  if (f.resourceId?.trim()) p.set('resourceId', f.resourceId.trim());
  if (f.actorUserId?.trim()) p.set('actorUserId', f.actorUserId.trim());
  if (f.actorAgentId?.trim()) p.set('actorAgentId', f.actorAgentId.trim());
  if (f.traceId?.trim()) p.set('traceId', f.traceId.trim());
  if (f.spanId?.trim()) p.set('spanId', f.spanId.trim());
  if (f.gatewayRequestId?.trim()) p.set('gatewayRequestId', f.gatewayRequestId.trim());
  if (f.ipAddress?.trim()) p.set('ipAddress', f.ipAddress.trim());
  if (f.userAgent?.trim()) p.set('userAgent', f.userAgent.trim());
  if (f.tags?.length) p.set('tags', [...f.tags].sort().join(','));
  return p;
};

/** BE: range(1h|6h|24h|7d|30d|90d) 또는 dateFrom/dateTo */
const RANGE_PRESETS = ['1h', '6h', '24h', '7d', '30d', '90d'] as const;

/** filters → API params (정규화) */
export const normalizeFiltersToApi = (f: AuditFilters): AuditApiParams | undefined => {
  const datePreset = f.datePreset;
  const { from, to } = getDateRangeFromPreset(
    datePreset,
    f.from || undefined,
    f.to || undefined
  );

  const api: AuditApiParams = {
    category: f.eventCategory || undefined,
    outcome: f.outcome || undefined,
    actorType: f.actorType || undefined,
    q: f.q?.trim() || undefined,
    page: 0,
    size: 100,
    sort: 'createdAt,desc',
  };

  if (RANGE_PRESETS.includes(datePreset as (typeof RANGE_PRESETS)[number])) {
    api.range = datePreset;
  } else {
    api.dateFrom = from || undefined;
    api.dateTo = to || undefined;
  }

  if (f.eventTypeFilter?.trim()) api.type = f.eventTypeFilter.trim();
  else if (f.eventType?.length) api.type = f.eventType.join(',');
  if (f.severity?.length) api.severity = f.severity.map((s) => s.toUpperCase()).join(',');
  if (f.resourceType?.length) api.resourceType = f.resourceType.join(',');
  if (f.resourceId?.trim()) api.resourceId = f.resourceId.trim();
  if (f.actorUserId?.trim()) {
    api.actor = f.actorUserId.trim();
    api.actorUserId = f.actorUserId.trim();
  }
  if (f.actorAgentId?.trim()) api.actorAgentId = f.actorAgentId.trim();
  if (f.traceId?.trim()) api.traceId = f.traceId.trim();
  if (f.spanId?.trim()) api.spanId = f.spanId.trim();
  if (f.gatewayRequestId?.trim()) api.gatewayRequestId = f.gatewayRequestId.trim();

  return api;
};

/** 항상 date range 포함하여 API 호출 (기본 24h) */
export const getDefaultApiParams = (): AuditApiParams => ({
  range: '24h',
  page: 0,
  size: 100,
  sort: 'createdAt,desc',
});

// ----------------------------------------------------------------------

export const useAuditFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => paramsToFilters(searchParams), [searchParams]);

  const updateFilters = useCallback(
    (updater: (prev: AuditFilters) => AuditFilters) => {
      setSearchParams(
        (prev) => {
          const next = updater(paramsToFilters(prev));
          return filtersToParams(next);
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const updateBasic = useCallback(
    <K extends keyof AuditBasicFilters>(key: K, value: AuditBasicFilters[K]) => {
      updateFilters((prev) => ({ ...prev, [key]: value }));
    },
    [updateFilters]
  );

  const updateAdvanced = useCallback(
    <K extends keyof typeof DEFAULT_ADVANCED>(key: K, value: (typeof DEFAULT_ADVANCED)[K]) => {
      updateFilters((prev) => ({ ...prev, [key]: value }));
    },
    [updateFilters]
  );

  const reset = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  const resetAdvanced = useCallback(() => {
    updateFilters((prev) => ({
      ...prev,
      ...Object.fromEntries(
        (['eventType', 'severity', 'resourceType', 'resourceId', 'actorUserId', 'actorAgentId', 'traceId', 'spanId', 'gatewayRequestId', 'ipAddress', 'userAgent', 'tags'] as const).map((k) => [
          k,
          Array.isArray(prev[k]) ? [] : '',
        ])
      ),
    }));
  }, [updateFilters]);

  const apiParams = useMemo(() => normalizeFiltersToApi(filters), [filters]);

  const hasActiveFilters = useMemo(() => {
    const f = filters;
    return Boolean(
      f.datePreset && f.datePreset !== '24h' ||
      f.eventCategory ||
      f.eventTypeFilter?.trim() ||
      f.outcome ||
      f.actorType ||
      f.q?.trim() ||
      f.eventType?.length ||
      f.severity?.length ||
      f.resourceType?.length ||
      f.resourceId?.trim() ||
      f.actorUserId?.trim() ||
      f.actorAgentId?.trim() ||
      f.traceId?.trim() ||
      f.spanId?.trim() ||
      f.gatewayRequestId?.trim() ||
      f.ipAddress?.trim() ||
      f.userAgent?.trim() ||
      f.tags?.length
    );
  }, [filters]);

  return {
    filters,
    updateFilters,
    updateBasic,
    updateAdvanced,
    reset,
    resetAdvanced,
    apiParams,
    hasActiveFilters,
  };
};
