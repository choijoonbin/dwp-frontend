import { useQuery, useMutation } from '@tanstack/react-query';

import { getTenantId } from '../tenant-util';
import { useAuth } from '../auth/auth-provider';
import { getAdminAuditLogs, exportAdminAuditLogs, getAdminAuditLogDetail } from '../api/admin-iam-api';

import type { AuditLogListParams } from '../admin/types';

// ----------------------------------------------------------------------

/**
 * Query key for admin audit logs list
 * Format: ["admin", "audit-logs", tenantId, params]
 */
export const adminAuditLogsQueryKey = (tenantId: string, params?: AuditLogListParams) =>
  [
    'admin',
    'audit-logs',
    tenantId,
    params?.page,
    params?.size,
    params?.from,
    params?.to,
    params?.actor,
    params?.action,
    params?.keyword,
  ] as const;

/**
 * Query key for admin audit log detail
 * Format: ["admin", "audit-log", tenantId, id]
 */
export const adminAuditLogDetailQueryKey = (tenantId: string, id: string) =>
  ['admin', 'audit-log', tenantId, id] as const;

/**
 * Hook to fetch admin audit logs list
 */
export const useAdminAuditLogsQuery = (params?: AuditLogListParams) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: adminAuditLogsQueryKey(tenantId, params),
    queryFn: async () => {
      const res = await getAdminAuditLogs(params);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch audit logs');
    },
    enabled: isAuthenticated && Boolean(tenantId),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

/**
 * Hook to fetch admin audit log detail
 */
export const useAdminAuditLogDetailQuery = (id: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getTenantId();

  const query = useQuery({
    queryKey: adminAuditLogDetailQueryKey(tenantId, id),
    queryFn: async () => {
      const res = await getAdminAuditLogDetail(id);
      if (res.data) {
        return res.data;
      }
      throw new Error(res.message || 'Failed to fetch audit log detail');
    },
    enabled: isAuthenticated && Boolean(tenantId) && Boolean(id),
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

/**
 * Hook to export admin audit logs to Excel
 */
export const useExportAdminAuditLogsMutation = () => useMutation({
    mutationFn: async (params?: AuditLogListParams) => {
      const blob = await exportAdminAuditLogs(params);
      return blob;
    },
  });
