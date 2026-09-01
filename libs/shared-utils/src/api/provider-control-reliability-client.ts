import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type {
  ProviderMaintenanceWindow,
  ProviderReliabilityControl,
  ProviderServiceHealthOverview,
  ProviderServiceIncident,
} from './provider-control-contracts';

const BASE = '/api/provider/v1/admin';

export async function getProviderServiceHealth(): Promise<ProviderServiceHealthOverview> {
  const response = await axiosInstance.get<ApiResponse<ProviderServiceHealthOverview>>(
    `${BASE}/service-health`
  );
  return response.data.data;
}

export async function getProviderReliabilityControl(): Promise<ProviderReliabilityControl> {
  const response = await axiosInstance.get<ApiResponse<ProviderReliabilityControl>>(
    `${BASE}/reliability-control`
  );
  return response.data.data;
}

export async function createProviderIncident(request: {
  title: string;
  severity: ProviderServiceIncident['severity'];
  impactScope: string;
  serviceKey?: string | null;
  regionKey?: string | null;
  deploymentCellId?: string | null;
  tenantId?: string | null;
  customerImpact: string;
  publicSummary?: string | null;
  initialUpdate: string;
}): Promise<ProviderServiceIncident> {
  const response = await axiosInstance.post<ApiResponse<ProviderServiceIncident>, typeof request>(
    `${BASE}/incidents`,
    request
  );
  return response.data.data;
}

export async function updateProviderIncident(
  incident: ProviderServiceIncident,
  state: 'IDENTIFIED' | 'MONITORING' | 'RESOLVED' | 'CLOSED',
  message: string,
  visibility: 'INTERNAL' | 'CUSTOMER' = 'INTERNAL'
): Promise<ProviderServiceIncident> {
  const response = await axiosInstance.patch<
    ApiResponse<ProviderServiceIncident>,
    { state: string; message: string; visibility: string; version: number }
  >(`${BASE}/incidents/${incident.incidentId}`, {
    state,
    message,
    visibility,
    version: incident.version,
  });
  return response.data.data;
}

export async function createProviderMaintenanceWindow(request: {
  trackingKey: string;
  title: string;
  summary: string;
  scopeType: 'GLOBAL' | 'SERVICE' | 'REGION' | 'CELL' | 'TENANT';
  serviceKey?: string | null;
  regionKey?: string | null;
  deploymentCellId?: string | null;
  tenantId?: string | null;
  impactType:
    | 'NO_IMPACT'
    | 'BRIEF_INTERRUPTION'
    | 'DEGRADED_PERFORMANCE'
    | 'SERVICE_UNAVAILABLE'
    | 'FAILOVER'
    | 'OTHER';
  expectedImpactSeconds: number;
  startsAt: string;
  endsAt: string;
  customerNoticeAt: string;
  minimumNoticeHours: number;
}): Promise<ProviderMaintenanceWindow> {
  const response = await axiosInstance.post<ApiResponse<ProviderMaintenanceWindow>, typeof request>(
    `${BASE}/maintenance-windows`,
    request
  );
  return response.data.data;
}
