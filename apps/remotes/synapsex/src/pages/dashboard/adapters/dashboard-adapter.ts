/**
 * 대시보드 API 응답 → UI 모델 변환
 * 신규 구조(financialHealthIndex.score, criticalHigh 등) 및 레거시 지원
 */

import type {
  TeamSnapshotDto,
  AgentActivityDto,
  TopRiskDriverDto,
  ActionRequiredDto,
  DashboardSummaryDto,
} from '@dwp-frontend/shared-utils';

// ----------------------------------------------------------------------
// case_type → 라벨 매핑 (서버 label 없을 때)
// ----------------------------------------------------------------------

const CASE_TYPE_LABEL_MAP: Record<string, string> = {
  duplicate_invoice: '중복 송장',
  bank_change: '은행 변경',
  policy_violation: '정책 위반',
  amount_mismatch: '금액 불일치',
  date_anomaly: '일자 이상',
  counterparty_risk: '거래처 리스크',
  default: '기타',
};

function getRiskDriverLabel(
  dto: TopRiskDriverDto,
  getCaseTypeLabel?: (code: string) => string
): string {
  if (dto.label && String(dto.label).trim()) return String(dto.label);
  const typeKey = (dto.case_type ?? dto.type ?? '').toLowerCase().replace(/\s/g, '_');
  const codeKey = (dto.case_type ?? dto.type ?? '').toUpperCase().replace(/\s/g, '_');
  if (getCaseTypeLabel && codeKey) {
    const fromCodes = getCaseTypeLabel(codeKey);
    if (fromCodes && fromCodes !== codeKey) return fromCodes;
  }
  return CASE_TYPE_LABEL_MAP[typeKey] ?? CASE_TYPE_LABEL_MAP.default;
}

// ----------------------------------------------------------------------
// Summary → KPI UI 모델
// ----------------------------------------------------------------------

export type KpiLinks = {
  casesPath?: string;
  actionsPath?: string;
  auditPath?: string;
};

export type KpiUiModel = {
  financialHealthIndex: number;
  financialHealthTrend: number | null;
  openCasesBySeverity: { critical: number; high: number; medium: number; low: number };
  aiActionSuccessRate: number | null;
  aiActionSuccessTrend: number | null;
  estimatedPreventedLoss: number;
  preventedLossTrend: number | null;
  preventedLossCurrency: string;
  pendingApprovals: number;
  slaAtRisk: number;
  avgLeadTime: number;
  backlogCount: number;
  links?: KpiLinks;
};

export function mapSummaryToKpis(d?: DashboardSummaryDto | null): KpiUiModel {
  if (!d || typeof d !== 'object') {
    return {
      financialHealthIndex: 0,
      financialHealthTrend: null,
      openCasesBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      aiActionSuccessRate: null,
      aiActionSuccessTrend: null,
      estimatedPreventedLoss: 0,
      preventedLossTrend: null,
      preventedLossCurrency: 'USD',
      pendingApprovals: 0,
      slaAtRisk: 0,
      avgLeadTime: 0,
      backlogCount: 0,
    };
  }

  const fhi = d.financialHealthIndex;
  const fhiScore =
    typeof fhi === 'object' && fhi !== null && 'score' in fhi
      ? Number((fhi as { score?: number }).score) || 0
      : Number(fhi) || 0;
  const fhiDelta =
    typeof fhi === 'object' && fhi !== null && 'deltaPct' in fhi
      ? (fhi as { deltaPct?: number | null }).deltaPct ?? null
      : (d.financialHealthTrend as number | undefined) ?? null;

  const sev = d.openCasesBySeverity;
  const criticalHigh = d.criticalHigh;
  const mediumLow = d.mediumLow;

  let openCasesBySeverity: { critical: number; high: number; medium: number; low: number };
  if (sev) {
    openCasesBySeverity = {
      critical: sev.critical ?? 0,
      high: sev.high ?? 0,
      medium: sev.medium ?? 0,
      low: sev.low ?? 0,
    };
  } else if (criticalHigh !== undefined || mediumLow !== undefined) {
    openCasesBySeverity = {
      critical: 0,
      high: Number(criticalHigh) || 0,
      medium: 0,
      low: Number(mediumLow) || 0,
    };
  } else {
    openCasesBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  }

  const ratePct = d.ratePct ?? d.aiActionSuccessRate;
  const aiDelta = d.deltaPct ?? d.aiActionSuccessTrend;

  const amount = d.amount ?? d.estimatedPreventedLoss ?? 0;
  const currency = String(d.currency ?? 'USD');
  const preventedDelta = d.preventedLossTrend ?? d.deltaPct ?? null;

  return {
    financialHealthIndex: fhiScore,
    financialHealthTrend: fhiDelta,
    openCasesBySeverity,
    aiActionSuccessRate: ratePct != null ? Number(ratePct) : null,
    aiActionSuccessTrend: aiDelta != null ? Number(aiDelta) : null,
    estimatedPreventedLoss: Number(amount),
    preventedLossTrend: preventedDelta != null ? Number(preventedDelta) : null,
    preventedLossCurrency: currency,
    pendingApprovals: Number(d.pendingApprovals ?? 0),
    slaAtRisk: Number(d.slaAtRisk ?? 0),
    avgLeadTime: Number(d.avgLeadTime ?? 0),
    backlogCount: Number(d.backlogCount ?? 0),
    links: d.links,
  };
}

// ----------------------------------------------------------------------
// Action Required → UI 모델
// ----------------------------------------------------------------------

export type ActionRequiredUiItem = {
  id: string;
  caseId: string;
  description: string;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  caseNumber?: string;
  reasonShort?: string;
  primaryActionId?: string;
  reviewPath?: string;
};

function normalizeSeverity(
  v?: string
): 'critical' | 'high' | 'medium' | 'low' {
  const s = String(v ?? 'medium').toUpperCase();
  if (s === 'CRITICAL') return 'critical';
  if (s === 'HIGH') return 'high';
  if (s === 'LOW') return 'low';
  return 'medium';
}

export function mapActionRequired(items: ActionRequiredDto[] | undefined): ActionRequiredUiItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((a) => ({
    id: String(a.id ?? ''),
    caseId: String(a.caseId ?? ''),
    description: String(a.description ?? ''),
    riskLevel: normalizeSeverity(a.riskLevel as string),
    caseNumber: a.caseNumber as string | undefined,
  }));
}

// ----------------------------------------------------------------------
// Top Risk Drivers → UI 모델
// ----------------------------------------------------------------------

export type RiskDriverUiItem = {
  id: number;
  type: string;
  riskTypeKey: string;
  label: string;
  count: number;
  amount: number;
  trend: 'up' | 'down' | 'stable';
  casesPath?: string;
  anomaliesPath?: string;
};

export function mapRiskDrivers(
  items: TopRiskDriverDto[] | undefined,
  getCaseTypeLabel?: (code: string) => string
): RiskDriverUiItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((d, i) => {
    const amt = d.impactAmount ?? d.amount ?? 0;
    const links = d.links as { anomaliesPath?: string; casesPath?: string } | undefined;
    return {
      id: i + 1,
      type: String(d.case_type ?? d.type ?? ''),
      riskTypeKey: String(d.case_type ?? d.type ?? '').toLowerCase().replace(/\s/g, '_'),
      label: getRiskDriverLabel(d, getCaseTypeLabel),
      count: Number(d.count ?? 0),
      amount: Number(amt),
      trend: (d.trend as 'up' | 'down' | 'stable') ?? 'stable',
      casesPath: links?.casesPath ?? links?.anomaliesPath,
      anomaliesPath: links?.anomaliesPath ?? links?.casesPath,
    };
  });
}

// ----------------------------------------------------------------------
// Team Snapshot → UI 모델
// ----------------------------------------------------------------------

export type TeamSnapshotUiItem = {
  id: string;
  analystUserId: string;
  name: string;
  role: string;
  openCases: number;
  pendingApprovals: number;
  slaRisk: 'AT_RISK' | 'ON_TRACK';
  slaRiskCount: number;
  avgLeadTime: number;
  casesPath?: string;
  actionsPath?: string;
  auditPath?: string;
};

export function mapTeamSnapshot(items: TeamSnapshotDto[] | undefined): TeamSnapshotUiItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((d, i) => {
    let slaRisk: 'AT_RISK' | 'ON_TRACK' = 'ON_TRACK';
    let slaRiskCount = Number(d.slaRiskCount ?? 0);
    if (d.slaRisk === 'AT_RISK' || d.slaRisk === 'ON_TRACK') {
      slaRisk = d.slaRisk;
      slaRiskCount = Number(d.slaRiskCount ?? (slaRisk === 'AT_RISK' ? 1 : 0));
    } else if (typeof d.slaRisk === 'number' && d.slaRisk > 0) {
      slaRisk = 'AT_RISK';
      slaRiskCount = Number(d.slaRisk);
    }
    const links = d.links as { casesPath?: string; actionsPath?: string; auditPath?: string } | undefined;
    const avgLead = d.avgLeadTimeHours ?? d.avgLeadTime ?? 0;
    return {
      id: String(d.id ?? d.analystUserId ?? i),
      analystUserId: String(d.analystUserId ?? d.id ?? ''),
      name: String(d.analystName ?? d.name ?? ''),
      role: String(d.title ?? d.role ?? ''),
      openCases: Number(d.openCases ?? 0),
      pendingApprovals: Number(d.pendingApprovals ?? 0),
      slaRisk,
      slaRiskCount,
      avgLeadTime: Number(avgLead),
      casesPath: links?.casesPath,
      actionsPath: links?.actionsPath,
      auditPath: links?.auditPath,
    };
  });
}

// ----------------------------------------------------------------------
// Agent Activity → UI 모델
// ----------------------------------------------------------------------

export type AgentActivityUiItem = {
  id: string;
  caseId?: string;
  caseKey?: string;
  actionId?: string;
  resourceType?: string;
  resourceId?: string;
  traceId?: string;
  timestamp: string;
  action: string;
  /** evidence_json.message (Aura) */
  message: string;
  status: string;
  casePath?: string;
  auditPath?: string;
};

export function mapAgentActivity(items: AgentActivityDto[] | undefined): AgentActivityUiItem[] {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((d, i) => {
    const links = d.links as { casePath?: string; auditPath?: string } | undefined;
    return {
      id: String(d.id ?? i),
      caseId: d.caseId ? String(d.caseId) : undefined,
      caseKey: d.caseKey ? String(d.caseKey) : undefined,
      actionId: d.actionId ? String(d.actionId) : undefined,
      resourceType: d.resourceType ? String(d.resourceType) : undefined,
      resourceId: d.resourceId ? String(d.resourceId) : undefined,
      traceId: d.traceId ? String(d.traceId) : undefined,
      timestamp: String(d.ts ?? d.timestamp ?? new Date().toISOString()),
      action: String(d.stage ?? d.action ?? ''),
      message: String(d.message ?? ''),
      status: String(d.status ?? d.level ?? 'complete'),
      casePath: links?.casePath,
      auditPath: links?.auditPath,
    };
  });
}
