/**
 * Synapse 공통 Enum (FE/BE 계약 단일 소스)
 * 모든 라벨/뱃지/필터옵션은 이 모듈에서만 import
 *
 * @see docs/backend-src/docs/api-spec/COMMON_FILTER_DTO_STANDARD.md
 */

// ----------------------------------------------------------------------
// Range
// ----------------------------------------------------------------------

export const RangeEnum = {
  H1: '1h',
  H6: '6h',
  H24: '24h',
  D7: '7d',
  D30: '30d',
} as const;

export type Range = (typeof RangeEnum)[keyof typeof RangeEnum];

// ----------------------------------------------------------------------
// Severity (공통)
// ----------------------------------------------------------------------

export const SeverityEnum = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;

export type Severity = (typeof SeverityEnum)[keyof typeof SeverityEnum];

export const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: '긴급',
  HIGH: '높음',
  MEDIUM: '중간',
  LOW: '낮음',
};

// ----------------------------------------------------------------------
// RiskType (Top Risk Drivers / Anomalies type 공유)
// ----------------------------------------------------------------------

export const RiskTypeEnum = {
  DUPLICATE_INVOICE: 'DUPLICATE_INVOICE',
  BANK_CHANGE_RISK: 'BANK_CHANGE_RISK',
  POLICY_VIOLATION: 'POLICY_VIOLATION',
  DATA_INTEGRITY: 'DATA_INTEGRITY',
  UNUSUAL_AMOUNT: 'UNUSUAL_AMOUNT',
  VENDOR_RISK: 'VENDOR_RISK',
  /** 레거시 호환 */
  INTEGRITY_MISMATCH: 'INTEGRITY_MISMATCH',
  AMOUNT_VARIANCE: 'AMOUNT_VARIANCE',
  TIMING_ANOMALY: 'TIMING_ANOMALY',
} as const;

export type RiskType = (typeof RiskTypeEnum)[keyof typeof RiskTypeEnum];

export const RISK_TYPE_LABELS: Record<string, string> = {
  DUPLICATE_INVOICE: '중복 송장',
  BANK_CHANGE_RISK: '은행 변경 리스크',
  POLICY_VIOLATION: '정책 위반',
  DATA_INTEGRITY: '데이터 정합성',
  UNUSUAL_AMOUNT: '이상 금액',
  VENDOR_RISK: '공급업체 리스크',
  INTEGRITY_MISMATCH: '정합성 불일치',
  AMOUNT_VARIANCE: '금액 변동',
  TIMING_ANOMALY: '시점 이상',
};

// ----------------------------------------------------------------------
// CaseStatus
// ----------------------------------------------------------------------

export const CaseStatusEnum = {
  OPEN: 'OPEN',
  TRIAGE: 'TRIAGE',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
  /** 레거시 호환 */
  TRIAGED: 'TRIAGED',
  IN_REVIEW: 'IN_REVIEW',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  CLOSED: 'CLOSED',
} as const;

export type CaseStatus = (typeof CaseStatusEnum)[keyof typeof CaseStatusEnum];

export const CASE_STATUS_LABELS: Record<string, string> = {
  OPEN: '미해결',
  TRIAGE: '분류 대기',
  TRIAGED: '분류 완료',
  IN_PROGRESS: '진행 중',
  IN_REVIEW: '검토 중',
  RESOLVED: '해결됨',
  DISMISSED: '무시됨',
  PENDING_APPROVAL: '승인 대기',
  CLOSED: '종료',
};

// ----------------------------------------------------------------------
// AnomalyStatus
// ----------------------------------------------------------------------

export const AnomalyStatusEnum = {
  NEW: 'NEW',
  TRIAGED: 'TRIAGED',
  LINKED_TO_CASE: 'LINKED_TO_CASE',
  IGNORED: 'IGNORED',
} as const;

export type AnomalyStatus = (typeof AnomalyStatusEnum)[keyof typeof AnomalyStatusEnum];

export const ANOMALY_STATUS_LABELS: Record<AnomalyStatus, string> = {
  NEW: '신규',
  TRIAGED: '분류됨',
  LINKED_TO_CASE: '케이스 연결',
  IGNORED: '무시됨',
};

// ----------------------------------------------------------------------
// ActionStatus
// ----------------------------------------------------------------------

export const ActionStatusEnum = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
  /** 레거시 호환 */
  PENDING_APPROVAL: 'PENDING_APPROVAL',
} as const;

export type ActionStatus = (typeof ActionStatusEnum)[keyof typeof ActionStatusEnum];

export const ACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  PENDING_APPROVAL: '승인 대기',
  APPROVED: '승인됨',
  REJECTED: '거절됨',
  EXECUTED: '실행됨',
  FAILED: '실패',
  ROLLED_BACK: '롤백됨',
};

// ----------------------------------------------------------------------
// ActionType
// ----------------------------------------------------------------------

export const ActionTypeEnum = {
  SET_PAYMENT_BLOCK: 'SET_PAYMENT_BLOCK',
  RELEASE_PAYMENT_BLOCK: 'RELEASE_PAYMENT_BLOCK',
  REQUEST_INFO: 'REQUEST_INFO',
  DISMISS: 'DISMISS',
  UPDATE_MASTER_DATA: 'UPDATE_MASTER_DATA',
} as const;

export type ActionType = (typeof ActionTypeEnum)[keyof typeof ActionTypeEnum];

// ----------------------------------------------------------------------
// Audit Category
// ----------------------------------------------------------------------

export const AuditCategoryEnum = {
  UI: 'UI',
  ADMIN: 'ADMIN',
  ACTION: 'ACTION',
  AGENT: 'AGENT',
  INTEGRATION: 'INTEGRATION',
  CASE: 'CASE',
} as const;

export type AuditCategory = (typeof AuditCategoryEnum)[keyof typeof AuditCategoryEnum];
