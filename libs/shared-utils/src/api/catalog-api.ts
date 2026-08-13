import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';

export type CatalogEntityKind =
  | 'REFERENCE_SET'
  | 'APP'
  | 'CONNECTOR'
  | 'AGENT'
  | 'TOOL'
  | 'POLICY'
  | 'API'
  | 'DATA_PRODUCT'
  | 'CODE_SET'
  | 'SERVICE'
  | 'NAVIGATION'
  | 'CONNECTOR_INSTANCE'
  | 'PERMISSION';

export type CatalogEntity = {
  ref: string;
  kind: CatalogEntityKind;
  key: string;
  name: string;
  description?: string | null;
  ownerRef?: string | null;
  lifecycleState: string;
  riskTier: string;
  scope: 'TENANT' | 'GLOBAL_PRODUCT';
  revision: number;
  metadata: Record<string, unknown>;
};

export type CatalogRelationType =
  | 'DEPENDS_ON'
  | 'CONSUMES'
  | 'PRODUCES'
  | 'EXPOSES'
  | 'GOVERNS'
  | 'NAVIGATES_TO'
  | 'REQUIRES_PERMISSION'
  | 'SYNCHRONIZES';

export type CatalogCriticality = 'INFORMATIONAL' | 'OPERATIONAL' | 'CRITICAL';

export type CatalogRelation = {
  relationId?: string | null;
  sourceRef: string;
  targetRef: string;
  relationType: CatalogRelationType;
  relationOrigin: 'DECLARED' | 'DISCOVERED' | 'SYSTEM';
  criticality: CatalogCriticality;
  evidenceRef?: string | null;
  metadata: Record<string, unknown>;
  lifecycleState: 'ACTIVE' | 'RETIRED';
  version: number;
};

export type CatalogOverview = {
  entityCount: number;
  relationCount: number;
  declaredRelationCount: number;
  orphanCount: number;
  criticalRelationCount: number;
  entitiesByKind: Record<string, number>;
  entitiesByLifecycle: Record<string, number>;
  entities: CatalogEntity[];
  generatedAt: string;
};

export type CatalogGraphNode = {
  entity: CatalogEntity;
  incomingCount: number;
  outgoingCount: number;
  orphan: boolean;
};

export type CatalogGraph = {
  focusRef?: string | null;
  nodes: CatalogGraphNode[];
  relations: CatalogRelation[];
  truncated: boolean;
  generatedAt: string;
};

export type CatalogImpactItem = {
  entity: CatalogEntity;
  distance: number;
  relationTypes: CatalogRelationType[];
  highestCriticality: CatalogCriticality;
};

export type CatalogImpact = {
  target: CatalogEntity;
  operation: 'CHANGE' | 'RETIRE' | 'OUTAGE';
  compatibilityState: 'COMPATIBLE' | 'REVIEW_REQUIRED' | 'BLOCKED';
  ruleKey: string;
  ruleVersion: number;
  riskScore: number;
  blocked: boolean;
  directDependentCount: number;
  transitiveDependentCount: number;
  impactedEntities: CatalogImpactItem[];
  findings: string[];
  generatedAt: string;
};

export type CatalogCompatibilityRule = {
  ruleKey: string;
  ruleVersion: number;
  definition: Record<string, unknown>;
  contentSha256: string;
};

export type CatalogAssuranceFindingState =
  | 'OPEN'
  | 'ACKNOWLEDGED'
  | 'FALSE_POSITIVE'
  | 'ACCEPTED_RISK'
  | 'RESOLVED';

export type CatalogAssuranceFinding = {
  findingId: string;
  entityRef: string;
  findingCode: 'OWNER_MISSING' | 'ORPHAN_ASSET' | 'DEPRECATION_IMPACT';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lifecycleState: CatalogAssuranceFindingState;
  ruleKey: string;
  ruleVersion: number;
  evidence: Record<string, unknown>;
  evidenceSha256: string;
  firstDetectedAt: string;
  lastDetectedAt: string;
  dispositionReason?: string | null;
  dispositionEvidenceRef?: string | null;
  disposedBy?: number | null;
  disposedAt?: string | null;
  version: number;
};

export type CatalogAssuranceSummary = {
  openCount: number;
  criticalCount: number;
  ownerMissingCount: number;
  deprecationImpactCount: number;
  activeRule: CatalogCompatibilityRule;
  findings: CatalogAssuranceFinding[];
  generatedAt: string;
};

export type CatalogFindingDispositionRequest = {
  decision: Exclude<CatalogAssuranceFindingState, 'OPEN'>;
  reason: string;
  evidenceRef?: string;
  version: number;
};

export type DeclareCatalogRelationRequest = {
  sourceRef: string;
  targetRef: string;
  relationType: CatalogRelationType;
  criticality: CatalogCriticality;
  evidenceRef?: string;
  metadata?: Record<string, unknown>;
  version?: number;
};

const BASE = '/api/platform/v1/admin/catalog';

export async function getCatalogOverview(options?: {
  query?: string;
  kind?: CatalogEntityKind | 'ALL';
  lifecycle?: string;
}): Promise<CatalogOverview> {
  const search = new URLSearchParams();
  if (options?.query?.trim()) search.set('query', options.query.trim());
  if (options?.kind && options.kind !== 'ALL') search.set('kind', options.kind);
  if (options?.lifecycle && options.lifecycle !== 'ALL') {
    search.set('lifecycle', options.lifecycle);
  }
  const suffix = search.size ? `?${search.toString()}` : '';
  const response = await axiosInstance.get<ApiResponse<CatalogOverview>>(`${BASE}${suffix}`);
  return response.data.data;
}

export async function getCatalogGraph(focusRef?: string | null, depth = 2): Promise<CatalogGraph> {
  const search = new URLSearchParams({ depth: String(depth) });
  if (focusRef) search.set('focusRef', focusRef);
  const response = await axiosInstance.get<ApiResponse<CatalogGraph>>(
    `${BASE}/graph?${search.toString()}`
  );
  return response.data.data;
}

export async function getCatalogImpact(
  ref: string,
  operation: CatalogImpact['operation'] = 'CHANGE'
): Promise<CatalogImpact> {
  const search = new URLSearchParams({ ref, operation });
  const response = await axiosInstance.get<ApiResponse<CatalogImpact>>(
    `${BASE}/impact?${search.toString()}`
  );
  return response.data.data;
}

export async function getCatalogAssurance(): Promise<CatalogAssuranceSummary> {
  const response = await axiosInstance.get<ApiResponse<CatalogAssuranceSummary>>(
    `${BASE}/assurance`
  );
  return response.data.data;
}

export async function evaluateCatalogAssurance(): Promise<CatalogAssuranceSummary> {
  const response = await axiosInstance.post<ApiResponse<CatalogAssuranceSummary>, object>(
    `${BASE}/assurance/evaluate`,
    {}
  );
  return response.data.data;
}

export async function dispositionCatalogFinding(
  findingId: string,
  request: CatalogFindingDispositionRequest
): Promise<CatalogAssuranceFinding> {
  const response = await axiosInstance.post<
    ApiResponse<CatalogAssuranceFinding>,
    CatalogFindingDispositionRequest
  >(`${BASE}/assurance/findings/${encodeURIComponent(findingId)}/disposition`, request);
  return response.data.data;
}

export async function declareCatalogRelation(
  request: DeclareCatalogRelationRequest
): Promise<CatalogRelation> {
  const response = await axiosInstance.post<ApiResponse<CatalogRelation>, typeof request>(
    `${BASE}/relations`,
    request
  );
  return response.data.data;
}

export async function retireCatalogRelation(
  relationId: string,
  version: number
): Promise<CatalogRelation> {
  const response = await axiosInstance.post<ApiResponse<CatalogRelation>, { version: number }>(
    `${BASE}/relations/${relationId}/retire`,
    { version }
  );
  return response.data.data;
}
