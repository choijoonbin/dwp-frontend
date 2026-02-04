/**
 * Synapse 라우트별 허용 필터 쿼리 키 (공통 Filter DTO 표준)
 *
 * @see docs/backend-src/docs/api-spec/COMMON_FILTER_DTO_STANDARD.md
 */

const COMMON_KEYS = ['range', 'from', 'to', 'severity', 'status', 'q', 'page', 'size', 'sort'] as const;

export const CASES_ALLOWED_KEYS = [
  ...COMMON_KEYS,
  'caseId',
  'caseKey',
  'caseType',
  'driverType',
  'assigneeUserId',
  'assignee',
  'slaRisk',
  'approvalState',
  'ids',
  'company',
  'currency',
] as const;

export const ACTIONS_ALLOWED_KEYS = [
  ...COMMON_KEYS,
  'requiresApproval',
  'actionType',
  'resourceType',
  'resourceId',
  'assignee',
  'assigneeUserId',
  'focus',
  'caseId',
] as const;

export const ANOMALIES_ALLOWED_KEYS = [
  ...COMMON_KEYS,
  'type',
  'driverType',
  'entityId',
  'documentId',
  'bukrs',
  'waers',
] as const;

export const AUDIT_ALLOWED_KEYS = [
  'range',
  'eventCategory',
  'category',
  'type',
  'from',
  'to',
  'sort',
  'resourceType',
  'resourceId',
  'actor',
] as const;

export type CasesQueryKey = (typeof CASES_ALLOWED_KEYS)[number];
export type ActionsQueryKey = (typeof ACTIONS_ALLOWED_KEYS)[number];
export type AnomaliesQueryKey = (typeof ANOMALIES_ALLOWED_KEYS)[number];
export type AuditQueryKey = (typeof AUDIT_ALLOWED_KEYS)[number];
