/**
 * Synapse 통합관제 대시보드 TanStack Query hooks
 * GET /api/synapse/dashboard/summary
 * GET /api/synapse/dashboard/top-risk-drivers
 * GET /api/synapse/dashboard/action-required
 */

import { useQuery } from '@tanstack/react-query';

import { useAuth } from '../auth/auth-provider';
import { getDashboardTenantId } from '../tenant-util';
import {
  type ActionRequiredDto,
  type AgentActivityDto,
  type DashboardSummaryDto,
  type TeamSnapshotDto,
  type TopRiskDriverDto,
  getDashboardActionRequired,
  getDashboardAgentActivity,
  getDashboardSummary,
  getDashboardTeamSnapshot,
  getDashboardTopRiskDrivers,
} from '../api/synapse-dashboard-api';

// ----------------------------------------------------------------------
// Query Keys
// ----------------------------------------------------------------------

export const dashboardSummaryQueryKey = (tenantId: string) =>
  ['synapse', 'dashboard', 'summary', tenantId] as const;

export const dashboardTopRiskDriversQueryKey = (tenantId: string, range?: string) =>
  ['synapse', 'dashboard', 'top-risk-drivers', tenantId, range] as const;

export const dashboardActionRequiredQueryKey = (tenantId: string, severity?: string) =>
  ['synapse', 'dashboard', 'action-required', tenantId, severity] as const;

export const dashboardTeamSnapshotQueryKey = (tenantId: string, range?: string, teamId?: string) =>
  ['synapse', 'dashboard', 'team-snapshot', tenantId, range, teamId] as const;

export const dashboardAgentActivityQueryKey = (tenantId: string, range?: string) =>
  ['synapse', 'dashboard', 'agent-stream', tenantId, range] as const;

// ----------------------------------------------------------------------
// Hooks
// ----------------------------------------------------------------------

export const useDashboardSummaryQuery = () => {
  const { isAuthenticated } = useAuth();
  const tenantId = getDashboardTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: dashboardSummaryQueryKey(tenantId),
    queryFn: async (): Promise<DashboardSummaryDto> => {
      const res = await getDashboardSummary();
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch dashboard summary');
      }
      return (res.data ?? {}) as DashboardSummaryDto;
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useDashboardTopRiskDriversQuery = (range = '24h') => {
  const { isAuthenticated } = useAuth();
  const tenantId = getDashboardTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: dashboardTopRiskDriversQueryKey(tenantId, range),
    queryFn: async (): Promise<TopRiskDriverDto[]> => {
      const res = await getDashboardTopRiskDrivers(range);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch top risk drivers');
      }
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useDashboardActionRequiredQuery = (severity = 'HIGH,CRITICAL') => {
  const { isAuthenticated } = useAuth();
  const tenantId = getDashboardTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: dashboardActionRequiredQueryKey(tenantId, severity),
    queryFn: async (): Promise<ActionRequiredDto[]> => {
      const res = await getDashboardActionRequired(severity);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch action required');
      }
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    retry: false,
  });
};

export const useDashboardTeamSnapshotQuery = (range = '24h', teamId?: string) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getDashboardTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: dashboardTeamSnapshotQueryKey(tenantId, range, teamId),
    queryFn: async (): Promise<TeamSnapshotDto[]> => {
      const res = await getDashboardTeamSnapshot(range, teamId);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch team snapshot');
      }
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
  });
};

export const useDashboardAgentActivityQuery = (range = '6h', limit = 50) => {
  const { isAuthenticated } = useAuth();
  const tenantId = getDashboardTenantId();
  const enabled = isAuthenticated && Boolean(tenantId);

  return useQuery({
    queryKey: dashboardAgentActivityQueryKey(tenantId, range),
    queryFn: async (): Promise<AgentActivityDto[]> => {
      const res = await getDashboardAgentActivity(range, limit);
      if (res.status !== 'SUCCESS' && res.status !== 'OK') {
        throw new Error(res.message || 'Failed to fetch agent activity');
      }
      const d = res.data;
      if (d && typeof d === 'object' && 'items' in d && Array.isArray((d as { items?: unknown[] }).items)) {
        return (d as { items: AgentActivityDto[] }).items;
      }
      return Array.isArray(d) ? d : [];
    },
    enabled,
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    refetchInterval: 10 * 1000,
    retry: false,
  });
};
