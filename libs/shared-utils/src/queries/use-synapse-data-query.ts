/**
 * Synapse Phase 1 — Data & Trust TanStack Query hooks
 * documents, open-items, entities, lineage
 */

import { useQuery } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import {
  getLineage,
  getEntities,
  getFiDocDetail,
  getFiOpenItems,
  getFiDocHeaders,
  getEntityDetail,
  getOptimizationAr,
  getOptimizationAp,
  type LineageParams,
  type EntitiesListParams,
  type DocumentsListParams,
  type OpenItemsListParams,
} from '../api/synapse-data-api';

// ----------------------------------------------------------------------
// Query Keys
// ----------------------------------------------------------------------

export const documentsListQueryKey = (
  tenantId: string,
  params?: DocumentsListParams
) => ['synapse', 'documents', 'list', tenantId, params] as const;

export const documentDetailQueryKey = (
  tenantId: string,
  bukrs: string,
  belnr: string,
  gjahr: string
) => ['synapse', 'documents', 'detail', tenantId, bukrs, belnr, gjahr] as const;

export const openItemsListQueryKey = (
  tenantId: string,
  params?: OpenItemsListParams
) => ['synapse', 'open-items', 'list', tenantId, params] as const;

export const entitiesListQueryKey = (
  tenantId: string,
  params?: EntitiesListParams
) => ['synapse', 'entities', 'list', tenantId, params] as const;

export const entityDetailQueryKey = (tenantId: string, partyId: string) =>
  ['synapse', 'entities', 'detail', tenantId, partyId] as const;

export const lineageQueryKey = (tenantId: string, params?: LineageParams) =>
  ['synapse', 'lineage', tenantId, params] as const;

export const optimizationQueryKey = (tenantId: string, type: 'ar' | 'ap') =>
  ['synapse', 'optimization', tenantId, type] as const;

// ----------------------------------------------------------------------
// Documents
// ----------------------------------------------------------------------

export const useDocumentsListQuery = (params?: DocumentsListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: documentsListQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getFiDocHeaders(params);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch documents');
      }
      return res.data ?? [];
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

export const useDocumentDetailQuery = (
  bukrs: string | undefined,
  belnr: string | undefined,
  gjahr: string | undefined
) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled =
    isAuthenticated &&
    Boolean(tenantId) &&
    Boolean(bukrs) &&
    Boolean(belnr) &&
    Boolean(gjahr);

  return useQuery({
    queryKey: documentDetailQueryKey(
      tenantId,
      bukrs ?? '',
      belnr ?? '',
      gjahr ?? ''
    ),
    queryFn: async () => {
      if (!bukrs || !belnr || !gjahr) throw new Error('Missing document key');
      const res = await getFiDocDetail(bukrs, belnr, gjahr);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch document detail');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

// ----------------------------------------------------------------------
// Open Items
// ----------------------------------------------------------------------

export const useOpenItemsListQuery = (params?: OpenItemsListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: openItemsListQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getFiOpenItems(params);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch open items');
      }
      return res.data ?? [];
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

// ----------------------------------------------------------------------
// Entities
// ----------------------------------------------------------------------

export const useEntitiesListQuery = (params?: EntitiesListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: entitiesListQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getEntities(params);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch entities');
      }
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useEntityDetailQuery = (partyId: string | undefined) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId) && Boolean(partyId);

  return useQuery({
    queryKey: entityDetailQueryKey(tenantId, partyId ?? ''),
    queryFn: async () => {
      if (!partyId) throw new Error('Missing party ID');
      const res = await getEntityDetail(partyId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch entity detail');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

// ----------------------------------------------------------------------
// Lineage
// ----------------------------------------------------------------------

export const useLineageQuery = (params?: LineageParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const hasParam = Boolean(
    params?.caseId || params?.docKey || params?.rawEventId || params?.partyId
  );
  const enabled = isAuthenticated && Boolean(tenantId) && hasParam;

  return useQuery({
    queryKey: lineageQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getLineage(params);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch lineage');
      }
      return res.data;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false,
  });
};

// ----------------------------------------------------------------------
// Optimization (AR/AP 채권·채무 최적화)
// ----------------------------------------------------------------------

export const useOptimizationArQuery = () => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: optimizationQueryKey(tenantId, 'ar'),
    queryFn: async () => {
      const res = await getOptimizationAr();
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch AR optimization');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

export const useOptimizationApQuery = () => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: optimizationQueryKey(tenantId, 'ap'),
    queryFn: async () => {
      const res = await getOptimizationAp();
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch AP optimization');
      }
      return res.data;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

/** 탭별 최적화 데이터 — mode에 따라 AR 또는 AP만 Fetch */
export const useOptimizationQuery = (mode: 'ar' | 'ap') => {
  const arQuery = useOptimizationArQuery();
  const apQuery = useOptimizationApQuery();
  return mode === 'ar' ? arQuery : apQuery;
};
