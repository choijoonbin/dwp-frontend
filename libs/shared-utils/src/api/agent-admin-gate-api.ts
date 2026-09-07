import type { AgentComponents } from '@dwp-frontend/api-contracts';

import { axiosInstance } from '../axios-instance';
import { HttpError } from '../http-error';

import type { ApiResponse } from '../types';

type AgentSchemas = AgentComponents['schemas'];

export type DwaionGateEnvironment = AgentSchemas['GateEnvironment'];
export type DwaionGateCategory = AgentSchemas['GateCategory'];
export type DwaionGateKey = AgentSchemas['OperationalGateKey'];
export type DwaionGateStatus = AgentSchemas['GateStatus'];
export type DwaionGateEvidenceType = AgentSchemas['GateEvidenceType'];
export type DwaionGateApprovalEligibilityReason = AgentSchemas['GateApprovalEligibilityReason'];
export type DwaionGateActorRole = AgentSchemas['GateActorRole'];
export type DwaionOperationalGate = AgentSchemas['OperationalGateSummary'];
export type DwaionOperationalGateEvidence = AgentSchemas['OperationalGateEvidence'];
export type DwaionOperationalGateApprovalEligibility =
  AgentSchemas['OperationalGateApprovalEligibility'];
export type DwaionOperationalGateAuditEvent = AgentSchemas['OperationalGateAuditEvent'];
export type DwaionOperationalGateDetail = AgentSchemas['OperationalGateDetail'];
export type DwaionOperationalGateProblemCode =
  AgentSchemas['OperationalGateProblemCode'] | 'GATE_UNKNOWN';
export type DwaionOperationalGateProblem = {
  code: DwaionOperationalGateProblemCode;
  status: number;
  detail: string;
  correlationId?: string;
  context: Record<string, string | string[]>;
};
export type DwaionOperationalGatePortfolio = AgentSchemas['OperationalGatePortfolio'];

export function toDwaionOperationalGateProblem(error: unknown): DwaionOperationalGateProblem {
  if (!(error instanceof HttpError)) {
    return {
      code: 'GATE_UNKNOWN',
      status: 500,
      detail: error instanceof Error ? error.message : 'Unknown operational gate failure.',
      context: {},
    };
  }
  const envelope = asGateProblemEnvelope(error.details);
  if (!envelope) {
    return {
      code: 'GATE_UNKNOWN',
      status: error.status,
      detail: error.message,
      context: {},
    };
  }
  return {
    code: isGateProblemCode(envelope.code) ? envelope.code : 'GATE_UNKNOWN',
    status: typeof envelope.status === 'number' ? envelope.status : error.status,
    detail: typeof envelope.detail === 'string' ? envelope.detail : error.message,
    correlationId: typeof envelope.correlationId === 'string' ? envelope.correlationId : undefined,
    context: isGateProblemContext(envelope.context) ? envelope.context : {},
  };
}

export async function getDwaionOperationalGatePortfolio(
  environment: DwaionGateEnvironment
): Promise<DwaionOperationalGatePortfolio> {
  const response = await axiosInstance.get<ApiResponse<DwaionOperationalGatePortfolio>>(
    `/api/agent/v1/admin/gates?environment=${environment}`
  );
  return response.data.data;
}

export async function getDwaionOperationalGate(
  gateKey: DwaionGateKey,
  environment: DwaionGateEnvironment
): Promise<DwaionOperationalGateDetail> {
  const response = await axiosInstance.get<ApiResponse<DwaionOperationalGateDetail>>(
    `/api/agent/v1/admin/gates/${encodeURIComponent(gateKey)}?environment=${environment}`
  );
  return response.data.data;
}

export async function configureDwaionOperationalGate(
  gateKey: DwaionGateKey,
  environment: DwaionGateEnvironment,
  request: {
    selectedOption: string;
    ownerUserId: string;
    configurationRef?: string;
    notes?: string;
    expectedVersion: number;
    changeReason: string;
  }
): Promise<DwaionOperationalGateDetail> {
  const response = await axiosInstance.patch<
    ApiResponse<DwaionOperationalGateDetail>,
    typeof request
  >(`/api/agent/v1/admin/gates/${encodeURIComponent(gateKey)}?environment=${environment}`, request);
  return response.data.data;
}

export async function addDwaionOperationalGateEvidence(
  gateKey: DwaionGateKey,
  environment: DwaionGateEnvironment,
  request: {
    evidenceType: DwaionGateEvidenceType;
    title: string;
    reference: string;
    checksumSha256?: string;
    notes?: string;
    expectedVersion: number;
    changeReason: string;
  }
): Promise<DwaionOperationalGateDetail> {
  const response = await axiosInstance.post<
    ApiResponse<DwaionOperationalGateDetail>,
    typeof request
  >(
    `/api/agent/v1/admin/gates/${encodeURIComponent(gateKey)}/evidence?environment=${environment}`,
    request
  );
  return response.data.data;
}

export async function validateDwaionOperationalGate(
  gateKey: DwaionGateKey,
  environment: DwaionGateEnvironment,
  request: {
    outcome: 'PASS' | 'FAIL';
    validationSummary: string;
    expectedVersion: number;
    changeReason: string;
  }
): Promise<DwaionOperationalGateDetail> {
  const response = await axiosInstance.post<
    ApiResponse<DwaionOperationalGateDetail>,
    typeof request
  >(
    `/api/agent/v1/admin/gates/${encodeURIComponent(gateKey)}/validation?environment=${environment}`,
    request
  );
  return response.data.data;
}

export async function decideDwaionOperationalGate(
  gateKey: DwaionGateKey,
  environment: DwaionGateEnvironment,
  request: {
    decision: 'APPROVE' | 'REJECT';
    validDays: number;
    expectedVersion: number;
    changeReason: string;
  }
): Promise<DwaionOperationalGateDetail> {
  const response = await axiosInstance.post<
    ApiResponse<DwaionOperationalGateDetail>,
    typeof request
  >(
    `/api/agent/v1/admin/gates/${encodeURIComponent(gateKey)}/decision?environment=${environment}`,
    request
  );
  return response.data.data;
}

function asGateProblemEnvelope(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  const envelope = value as Record<string, unknown>;
  if (typeof envelope.code === 'string') return envelope;
  return envelope.detail && typeof envelope.detail === 'object'
    ? (envelope.detail as Record<string, unknown>)
    : null;
}

function isGateProblemCode(value: unknown): value is DwaionOperationalGateProblemCode {
  return (
    typeof value === 'string' &&
    [
      'GATE_PERMISSION_DENIED',
      'GATE_NOT_FOUND',
      'GATE_VERSION_CONFLICT',
      'GATE_INVALID_TRANSITION',
      'GATE_REQUIRED_EVIDENCE_MISSING',
      'GATE_SEPARATION_OF_DUTY',
      'GATE_STORE_UNAVAILABLE',
    ].includes(value)
  );
}

function isGateProblemContext(value: unknown): value is Record<string, string | string[]> {
  return Boolean(
    value &&
    typeof value === 'object' &&
    Object.values(value).every(
      (item) =>
        typeof item === 'string' ||
        (Array.isArray(item) && item.every((nested) => typeof nested === 'string'))
    )
  );
}
