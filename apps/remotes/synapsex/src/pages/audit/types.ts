/**
 * 감사 추적 로그 필터 타입
 * URLSearchParams 단일 소스, BE 변경 최소
 */

/** BE range: 1h|6h|24h|7d|30d|90d. today/custom는 FE에서 from/to 계산 */
export type AuditDatePreset = 'today' | '1h' | '6h' | '24h' | '7d' | '30d' | '90d' | 'custom';

export type AuditEventCategory = 'CASE' | 'ACTION' | 'ADMIN' | 'INTEGRATION' | 'POLICY' | 'GUARDRAIL' | 'AUDIT' | 'RUN' | '';

export type AuditOutcome = 'SUCCESS' | 'FAILED' | 'DENIED' | 'NOOP' | '';

export type AuditActorType = 'HUMAN' | 'AGENT' | 'SYSTEM' | '';

/** 기본 필터 (항상 노출) */
export type AuditBasicFilters = {
  datePreset: AuditDatePreset;
  from: string;
  to: string;
  eventCategory: AuditEventCategory;
  eventTypeFilter: string;
  outcome: AuditOutcome;
  actorType: AuditActorType;
  q: string;
};

/** Advanced 필터 (접기 영역, Add Filter 패턴) */
export type AuditAdvancedFilters = {
  eventType: string[];
  severity: string[];
  resourceType: string[];
  resourceId: string;
  actorUserId: string;
  actorAgentId: string;
  traceId: string;
  spanId: string;
  gatewayRequestId: string;
  ipAddress: string;
  userAgent: string;
  tags: string[];
};

export type AuditFilters = AuditBasicFilters & AuditAdvancedFilters;

/** API 요청용 정규화 필터 — BE spec (dateFrom/dateTo, range) 호환 */
export type AuditApiParams = {
  /** BE: dateFrom, from 둘 다 지원 */
  dateFrom?: string;
  dateTo?: string;
  /** BE: from/to 미입력 시 range 적용. 1h|6h|24h|7d|30d|90d */
  range?: string;
  category?: string;
  type?: string;
  outcome?: string;
  actorType?: string;
  actor?: string;
  actorUserId?: string;
  actorAgentId?: string;
  traceId?: string;
  spanId?: string;
  gatewayRequestId?: string;
  q?: string;
  severity?: string;
  resourceType?: string;
  resourceId?: string;
  page?: number;
  size?: number;
  sort?: string;
};
