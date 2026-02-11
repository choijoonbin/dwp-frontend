/**
 * 케이스 우선순위 점수(FE 계산) — P0/P1/P2 배지 및 정렬용
 * @see docs: severity 0-50, amount 0-30, recency 0-20, statusPenalty -100
 */

import type { CaseListItem } from '../adapters/case-list-adapter';

const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 50,
  high: 50,
  medium: 30,
  low: 10,
};
const UNKNOWN_SEVERITY_WEIGHT = 20;

/** 금액 구간: <10만=5, 10만~100만=10, 100만~1000만=20, 1000만+=30 (단위 무관, 동일 비율 적용) */
function amountWeight(amount: number): number {
  if (amount < 100_000) return 5;
  if (amount < 1_000_000) return 10;
  if (amount < 10_000_000) return 20;
  return 30;
}

/** 24h=20, 7d=12, 30d=6, 그 외=2 */
function recencyWeight(isoDate: string | undefined): number {
  if (!isoDate) return 2;
  const ms = new Date(isoDate).getTime();
  const now = Date.now();
  const diffHours = (now - ms) / (60 * 60 * 1000);
  if (diffHours <= 24) return 20;
  if (diffHours <= 7 * 24) return 12;
  if (diffHours <= 30 * 24) return 6;
  return 2;
}

/** 해결됨/종료 상태면 -100 */
function statusPenalty(status: string): number {
  const s = (status ?? '').toLowerCase();
  if (s === 'resolved' || s === 'dismissed') return -100;
  return 0;
}

export type PriorityInfo = {
  priorityScore: number;
  /** P0: >=75, P1: 50-74, P2: <50 */
  priorityLabel: 'P0' | 'P1' | 'P2';
  /** 툴팁용: 심각도 키(critical/high/medium/low) */
  severityLabel: string;
  amountLabel: string;
  /** 툴팁용: e.g. "2일 전" */
  recencyLabel: string;
  recencyShort: string;
};

export function getPriorityInfo(item: CaseListItem): PriorityInfo {
  const severity = (item.severity ?? '').toLowerCase();
  const severityW =
    SEVERITY_WEIGHT[severity] ?? (severity ? UNKNOWN_SEVERITY_WEIGHT : 10);
  const amountW = amountWeight(Number(item.amount) || 0);
  const lastAt = item.lastDetectedAt ?? item.updatedAt ?? item.detectedAt;
  const recencyW = recencyWeight(lastAt);
  const penalty = statusPenalty(item.status ?? '');
  const priorityScore = Math.max(
    0,
    severityW + amountW + recencyW + penalty
  );

  let priorityLabel: 'P0' | 'P1' | 'P2' = 'P2';
  if (priorityScore >= 75) priorityLabel = 'P0';
  else if (priorityScore >= 50) priorityLabel = 'P1';

  const severityKey =
    severity === 'critical'
      ? 'critical'
      : severity === 'high'
        ? 'high'
        : severity === 'medium'
          ? 'medium'
          : severity === 'low'
            ? 'low'
            : 'unknown';
  const severityLabel = severityKey;
  const amountLabel = item.currency && item.amount != null
    ? `${item.currency} ${Number(item.amount).toLocaleString()}`
    : '';
  let recencyLabel = '';
  let recencyShort = '';
  if (lastAt) {
    const diffMs = Date.now() - new Date(lastAt).getTime();
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days > 0) {
      recencyShort = `${days}d`;
      recencyLabel = `${days}일 전`;
    } else if (hours > 0) {
      recencyShort = `${hours}h`;
      recencyLabel = `${hours}시간 전`;
    } else {
      recencyShort = '<1h';
      recencyLabel = '1시간 미만';
    }
  }

  return {
    priorityScore,
    priorityLabel,
    severityLabel,
    amountLabel,
    recencyLabel: recencyLabel || recencyShort,
    recencyShort,
  };
}

/** 정렬: priorityScore 내림차순 (동점이어도 안정 정렬 유지) */
export function sortByPriorityScore(
  items: CaseListItem[]
): CaseListItem[] {
  const withScore = items.map((item) => ({
    item,
    info: getPriorityInfo(item),
  }));
  withScore.sort((a, b) => {
    const diff = b.info.priorityScore - a.info.priorityScore;
    if (diff !== 0) return diff;
    return (a.item.caseNumber ?? '').localeCompare(b.item.caseNumber ?? '');
  });
  return withScore.map((x) => x.item);
}
