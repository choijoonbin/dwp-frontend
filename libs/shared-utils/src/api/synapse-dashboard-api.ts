/**
 * Synapse 통합관제 대시보드 API
 * Agent Live Status / Financial Health / Action Required 카드 데이터
 *
 * @see apps/remotes/synapsex/docs/20260202/[최종]SYNAPSEX_FRONTEND_STRUCTURE_AND_API_MATRIX.md
 */

import { axiosInstance } from '../axios-instance';
import { getDashboardTenantId } from '../tenant-util';

import type { ApiResponse } from '../types';

// ----------------------------------------------------------------------
// DTO Types
// ----------------------------------------------------------------------

/** BE aggregator: GET /api/synapse/dashboard/summary → analytics_kpi_daily + agent_activity_log + recon_result */
export type KpiDailyItemDto = {
  metricKey: string;
  metricValue: number | string;
  ymd?: string;
};

export type DashboardActivitySummaryDto = {
  activityId?: string;
  occurredAt: string;
  stage?: string;
  message?: string;
  reasoning?: string;
  resourceType?: string;
  resourceId?: string;
};

export type ReconFailItemDto = {
  resultId: string;
  resourceType: string;
  resourceKey: string;
  status: string;
  detailJson?: Record<string, unknown>;
};

export type ReconFailSummaryDto = {
  failCount: number;
  latest: ReconFailItemDto[];
};

export type SynapseDashboardSummaryDto = {
  asOf?: string;
  kpiDaily?: KpiDailyItemDto[];
  recentActivity?: DashboardActivitySummaryDto[];
  reconFail?: ReconFailSummaryDto;
};

export type DashboardLinksDto = {
  casesPath?: string;
  actionsPath?: string;
  auditPath?: string;
};

export type DashboardSummaryDto = {
  financialHealthIndex?: number;
  financialHealthTrend?: number;
  openCasesBySeverity?: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
  aiActionSuccessRate?: number;
  aiActionSuccessTrend?: number;
  estimatedPreventedLoss?: number;
  preventedLossTrend?: number;
  pendingApprovals?: number;
  slaAtRisk?: number;
  avgLeadTime?: number;
  backlogCount?: number;
  agentLiveStatus?: 'active' | 'idle' | 'processing';
  links?: DashboardLinksDto;
  [key: string]: unknown;
};

export type TopRiskDriverLinksDto = {
  anomaliesPath?: string;
  casesPath?: string;
};

export type TopRiskDriverDto = {
  id?: string | number;
  type?: string;
  case_type?: string;
  label?: string;
  count?: number;
  amount?: number;
  impactAmount?: number;
  trend?: 'up' | 'down' | 'stable';
  links?: TopRiskDriverLinksDto;
  [key: string]: unknown;
};

export type ActionRequiredLinksDto = {
  reviewPath?: string;
};

export type ActionRequiredDto = {
  id?: string;
  caseId?: string;
  caseNumber?: string;
  primaryActionId?: string;
  actionType?: string;
  description?: string;
  reasonShort?: string;
  riskLevel?: 'critical' | 'high' | 'medium' | 'low';
  status?: string;
  createdAt?: string;
  links?: ActionRequiredLinksDto;
  [key: string]: unknown;
};

export type TeamSnapshotDto = {
  id?: string | number;
  analystUserId?: string;
  name?: string;
  role?: string;
  title?: string;
  openCases?: number;
  pendingApprovals?: number;
  slaRisk?: 'AT_RISK' | 'ON_TRACK';
  slaRiskCount?: number;
  avgLeadTime?: number;
  [key: string]: unknown;
};

export type AgentActivityLinksDto = {
  casePath?: string;
  auditPath?: string;
};

export type AgentActivityDto = {
  id?: string | number;
  ts?: string;
  timestamp?: string;
  level?: string;
  stage?: string;
  action?: string;
  /** evidence_json.message (Aura Audit 이벤트) */
  message?: string;
  status?: string;
  caseId?: string;
  caseKey?: string;
  actionId?: string;
  resourceType?: string;
  resourceId?: string;
  traceId?: string;
  links?: AgentActivityLinksDto;
  [key: string]: unknown;
};

// ----------------------------------------------------------------------
// API Functions
// ----------------------------------------------------------------------

/**
 * GET /api/synapse/dashboard/summary
 * Aggregator: kpiDaily(analytics_kpi_daily 오늘 4건), recentActivity(agent_activity_log 10건), reconFail(FAIL 5건).
 * BE 응답이 SynapseDashboardSummaryDto 이면 이 함수 사용.
 */
export const getSynapseDashboardSummary = async (): Promise<ApiResponse<SynapseDashboardSummaryDto>> => {
  const res = await axiosInstance.get<ApiResponse<SynapseDashboardSummaryDto>>(
    '/api/synapse/dashboard/summary',
    { headers: { 'X-Tenant-ID': getDashboardTenantId() } }
  );
  return res.data;
};

/**
 * @deprecated BE가 SynapseDashboardSummaryDto 로 변경 시 getSynapseDashboardSummary 사용
 * Agent Live Status, Financial Health Index 등 대시보드 요약 (레거시)
 */
export const getDashboardSummary = async (): Promise<ApiResponse<DashboardSummaryDto>> => {
  const res = await axiosInstance.get<ApiResponse<DashboardSummaryDto>>(
    '/api/synapse/dashboard/summary',
    { headers: { 'X-Tenant-ID': getDashboardTenantId() } }
  );
  return res.data;
};

/**
 * GET /api/synapse/dashboard/top-risk-drivers?range=24h
 * Top Risk Drivers 카드 데이터
 */
export const getDashboardTopRiskDrivers = async (
  range = '24h'
): Promise<ApiResponse<TopRiskDriverDto[]>> => {
  const url = `/api/synapse/dashboard/top-risk-drivers?range=${encodeURIComponent(range)}`;
  const res = await axiosInstance.get<ApiResponse<TopRiskDriverDto[]>>(url);
  return res.data;
};

/**
 * GET /api/synapse/dashboard/action-required?severity=HIGH,CRITICAL
 * Action Required 카드 데이터
 */
export const getDashboardActionRequired = async (
  severity = 'HIGH,CRITICAL'
): Promise<ApiResponse<ActionRequiredDto[]>> => {
  const url = `/api/synapse/dashboard/action-required?severity=${encodeURIComponent(severity)}`;
  const res = await axiosInstance.get<ApiResponse<ActionRequiredDto[]>>(url, {
    headers: { 'X-Tenant-ID': getDashboardTenantId() },
  });
  return res.data;
};

/**
 * GET /api/synapse/dashboard/team-snapshot?range=24h
 * Team Snapshot (팀 현황) 카드 데이터
 */
export const getDashboardTeamSnapshot = async (
  range = '24h',
  teamId?: string
): Promise<ApiResponse<TeamSnapshotDto[]>> => {
  const params = new URLSearchParams({ range });
  if (teamId) params.set('teamId', teamId);
  const url = `/api/synapse/dashboard/team-snapshot?${params.toString()}`;
  const res = await axiosInstance.get<ApiResponse<TeamSnapshotDto[]>>(url, {
    headers: { 'X-Tenant-ID': getDashboardTenantId() },
  });
  return res.data;
};

/** agent-stream/agent-activity 응답: data.items 배열 (Aura: agent-stream 또는 agent-activity) */
export type AgentActivityResponse = { range?: string; items?: AgentActivityDto[] };

/**
 * GET /api/synapse/dashboard/agent-stream?range=6h&limit=50
 * Agent Execution Stream 데이터 (Aura 표준: agent-stream, range=6h)
 */
export const getDashboardAgentActivity = async (
  range = '6h',
  limit = 50
): Promise<ApiResponse<AgentActivityResponse>> => {
  const url = `/api/synapse/dashboard/agent-stream?range=${encodeURIComponent(range)}&limit=${encodeURIComponent(String(limit))}`;
  const res = await axiosInstance.get<ApiResponse<AgentActivityResponse>>(url, {
    headers: { 'X-Tenant-ID': getDashboardTenantId() },
  });
  return res.data;
};
