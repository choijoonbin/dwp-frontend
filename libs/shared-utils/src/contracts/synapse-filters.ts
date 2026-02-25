/**
 * Synapse Drill-down 필터 파라미터 표준 (FE SoT)
 * 화면에서는 임의의 쿼리명을 만들지 말고, 이 계약만 사용한다.
 *
 * @see docs/backend-src/docs/api-spec/COMMON_FILTER_DTO_STANDARD.md
 */

import type { Range, RiskType, Severity, CaseStatus, ActionStatus, AnomalyStatus } from '../enums/synapse-enums';

export {
  RangeEnum,
  RiskTypeEnum,
  SeverityEnum,
  CaseStatusEnum,
  ActionStatusEnum,
  AnomalyStatusEnum,
} from '../enums/synapse-enums';
export type { Range, RiskType, Severity, CaseStatus, ActionStatus, AnomalyStatus } from '../enums/synapse-enums';

// ----------------------------------------------------------------------
// 레거시 호환 alias
// ----------------------------------------------------------------------

export const SlaRiskEnum = { AT_RISK: 'AT_RISK', ON_TRACK: 'ON_TRACK' } as const;
export type SlaRiskValue = (typeof SlaRiskEnum)[keyof typeof SlaRiskEnum];

export const EventCategoryEnum = {
  AGENT: 'AGENT',
  ACTION: 'ACTION',
  INTEGRATION: 'INTEGRATION',
  DASHBOARD: 'DASHBOARD',
  UI: 'UI',
  ADMIN: 'ADMIN',
  CASE: 'CASE',
} as const;
export type EventCategoryValue = (typeof EventCategoryEnum)[keyof typeof EventCategoryEnum];

/** @deprecated RangeValue 대신 Range 사용 */
export type RangeValue = Range;
/** @deprecated SeverityValue 대신 Severity 사용 */
export type SeverityValue = Severity;
/** @deprecated CaseStatusValue 대신 CaseStatus 사용 */
export type CaseStatusValue = CaseStatus;
/** @deprecated ActionStatusValue 대신 ActionStatus 사용 */
export type ActionStatusValue = ActionStatus;
/** @deprecated DriverTypeValue 대신 RiskType 사용 */
export type DriverTypeValue = RiskType;

// ----------------------------------------------------------------------
// CommonListFilter (공통)
// ----------------------------------------------------------------------

export type CommonListFilter = {
  range?: Range;
  from?: string;
  to?: string;
  severity?: Severity | Severity[];
  status?: string | string[];
  q?: string;
  page?: number;
  size?: number;
  sort?: string;
};

// ----------------------------------------------------------------------
// Filter Types (라우트별, CommonListFilter 확장)
// ----------------------------------------------------------------------

export type CasesFilters = CommonListFilter & {
  caseId?: string;
  caseKey?: string;
  caseType?: string;
  driverType?: RiskType;
  status?: CaseStatus | CaseStatus[];
  assigneeUserId?: string;
  assignee?: string;
  slaRisk?: SlaRiskValue;
  approvalState?: 'REQUIRES_REVIEW' | 'NONE';
  ids?: string | string[];
  company?: string;
  currency?: string;
};

export type ActionsFilters = CommonListFilter & {
  status?: ActionStatus | ActionStatus[];
  requiresApproval?: boolean;
  actionType?: string;
  resourceType?: 'CASE' | 'DOCUMENT' | 'ENTITY';
  resourceId?: string;
  assignee?: string;
  assigneeUserId?: string;
  focus?: string;
  caseId?: string;
};

export type AnomaliesFilters = CommonListFilter & {
  type?: RiskType | string;
  driverType?: RiskType;
  status?: AnomalyStatus | AnomalyStatus[];
  entityId?: string;
  documentId?: string;
  bukrs?: string;
  waers?: string;
};

export type AuditFilters = {
  range?: RangeValue;
  /** 통합 검색 (traceId, gatewayRequestId 등) */
  q?: string;
  eventCategory?: EventCategoryValue;
  category?: string | string[];
  from?: string;
  to?: string;
  sort?: string;
  resourceId?: string;
  /** BE: AGENT_CASE, DETECT_RUN 등 */
  resourceType?: string | string[];
  traceId?: string;
  /** Detect run과 연관된 감사 이벤트 필터 (tags JSONB runId) */
  runId?: string;
};

// ----------------------------------------------------------------------
// Serialize / Parse
// ----------------------------------------------------------------------

const SYNAPSE_PREFIX = '/synapse';

function joinArray(arr: string[]): string {
  return arr.join(',');
}

/**
 * 필터 객체 → 쿼리 스트링 생성
 */
export function serializeQuery(filters: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') continue;
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','));
    } else {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

/**
 * URLSearchParams → 필터 객체 파싱
 */
export function parseQuery(searchParams: URLSearchParams): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  searchParams.forEach((value, key) => {
    const existing = result[key];
    if (existing !== undefined) {
      if (Array.isArray(existing)) existing.push(value);
      else result[key] = [existing, value];
    } else {
      result[key] = value.includes(',') ? value.split(',') : value;
    }
  });
  return result;
}

/**
 * Synapse 라우트로 이동 URL 생성 (prefix 포함)
 * navigate(buildSynapseUrl('/cases', filters))
 */
export function buildSynapseUrl(
  path: string,
  filters?: Record<string, unknown>,
  basePath = SYNAPSE_PREFIX
): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const fullPath = cleanPath.startsWith(SYNAPSE_PREFIX) ? cleanPath : `${basePath}${cleanPath}`;
  const query = filters ? serializeQuery(filters) : '';
  return query ? `${fullPath}?${query}` : fullPath;
}

/** severity를 백엔드 API 규격(대문자)으로 변환 */
function toApiSeverity(v: Severity | Severity[] | string | string[]): string {
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((s) => String(s).toUpperCase()).join(',');
}

function commonFiltersToFlat(f: CommonListFilter): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  // BE: range와 from/to 동시 전송 시 400. 둘 중 하나만 사용
  const useRange = !f.from && !f.to;
  if (useRange && f.range) flat.range = f.range;
  if (f.from) flat.from = f.from;
  if (f.to) flat.to = f.to;
  if (f.severity) flat.severity = toApiSeverity(f.severity);
  if (f.status) flat.status = Array.isArray(f.status) ? joinArray(f.status) : f.status;
  if (f.q) flat.q = f.q;
  if (f.page !== undefined) flat.page = f.page;
  if (f.size !== undefined) flat.size = f.size;
  if (f.sort) flat.sort = f.sort;
  return flat;
}

/**
 * Cases drill-down URL (공통 Filter DTO 표준)
 */
export function buildCasesUrl(filters: CasesFilters): string {
  const flat = commonFiltersToFlat(filters);
  if (filters.caseId) flat.caseId = filters.caseId;
  if (filters.caseKey) flat.caseKey = filters.caseKey;
  if (filters.caseType) flat.caseType = filters.caseType;
  if (filters.driverType) flat.driverType = filters.driverType;
  if (filters.assigneeUserId) flat.assigneeUserId = filters.assigneeUserId;
  if (filters.assignee) flat.assignee = filters.assignee;
  if (filters.slaRisk) flat.slaRisk = filters.slaRisk;
  if (filters.approvalState) flat.approvalState = filters.approvalState;
  if (filters.ids) flat.ids = Array.isArray(filters.ids) ? joinArray(filters.ids) : filters.ids;
  if (filters.company) flat.company = filters.company;
  if (filters.currency) flat.currency = filters.currency;
  return buildSynapseUrl('/cases', flat);
}

/**
 * Actions drill-down URL (공통 Filter DTO 표준: status, requiresApproval)
 */
export function buildActionsUrl(filters: ActionsFilters): string {
  const flat = commonFiltersToFlat(filters);
  if (filters.requiresApproval !== undefined) flat.requiresApproval = String(filters.requiresApproval);
  if (filters.actionType) flat.actionType = filters.actionType;
  if (filters.resourceType) flat.resourceType = filters.resourceType;
  if (filters.resourceId) flat.resourceId = filters.resourceId;
  if (filters.assignee) flat.assignee = filters.assignee;
  if (filters.assigneeUserId) flat.assigneeUserId = filters.assigneeUserId;
  if (filters.focus) flat.focus = filters.focus;
  if (filters.caseId) flat.caseId = filters.caseId;
  return buildSynapseUrl('/actions', flat);
}

/**
 * Anomalies drill-down URL (type/driverType → RiskType, severity 대문자)
 */
export function buildAnomaliesUrl(filters: AnomaliesFilters): string {
  const flat = commonFiltersToFlat(filters);
  const typeVal = filters.type ?? filters.driverType;
  if (typeVal) flat.type = typeVal;
  if (filters.entityId) flat.entityId = filters.entityId;
  if (filters.documentId) flat.documentId = filters.documentId;
  if (filters.bukrs) flat.bukrs = filters.bukrs;
  if (filters.waers) flat.waers = filters.waers;
  return buildSynapseUrl('/anomalies', flat);
}

/**
 * Reconciliation drill-down URL
 */
export function buildReconciliationUrl(filters?: { range?: RangeValue }): string {
  return buildSynapseUrl('/reconciliation', filters ?? {});
}

/**
 * Analytics drill-down URL
 */
export function buildAnalyticsUrl(filters?: { range?: RangeValue; breakdown?: string }): string {
  const flat: Record<string, unknown> = {};
  if (filters?.range) flat.range = filters.range;
  if (filters?.breakdown) flat.breakdown = filters.breakdown;
  return buildSynapseUrl('/analytics', flat);
}

/**
 * Audit drill-down URL (q: 통합 검색 traceId/gatewayRequestId 등)
 */
export function buildAuditUrl(filters: AuditFilters): string {
  const flat: Record<string, unknown> = {};
  // BE: range와 from/to 동시 전송 시 400. 둘 중 하나만 사용
  const useRange = !filters.from && !filters.to;
  if (useRange && filters.range) flat.range = filters.range;
  if (filters.q) flat.q = filters.q;
  if (filters.eventCategory) flat.eventCategory = filters.eventCategory;
  if (filters.category)
    flat.category = Array.isArray(filters.category) ? joinArray(filters.category) : filters.category;
  if (filters.from) flat.from = filters.from;
  if (filters.to) flat.to = filters.to;
  if (filters.sort) flat.sort = filters.sort;
  if (filters.resourceId) flat.resourceId = filters.resourceId;
  if (filters.resourceType)
    flat.resourceType = Array.isArray(filters.resourceType) ? joinArray(filters.resourceType) : filters.resourceType;
  if (filters.traceId) flat.traceId = filters.traceId;
  if (filters.runId) flat.runId = filters.runId;
  return buildSynapseUrl('/audit', flat);
}
