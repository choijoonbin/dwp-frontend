import type { MyVoucherRowDto } from '@dwp-frontend/shared-utils';

export type VoucherRow = {
  id: string;
  bukrs: string;
  belnr: string;
  gjahr: string;
  postingDate: string;
  wrbtr: number;
  waers: string;
  bktxt: string;
  caseStatus?: string;
  score?: number;
  detectedAt?: string;
};

export const toUpperStatus = (status: string | null | undefined) => (status ?? '').trim().toUpperCase();

export const normalizeScore = (score: number | undefined) => {
  if (score == null || Number.isNaN(score)) return 0;
  if (score <= 1) return Math.round(score * 100);
  return Math.round(score);
};

export const auraResultFromRow = (row: VoucherRow) => {
  const status = toUpperStatus(row.caseStatus);
  if (status === 'NORMAL') return { label: '정상', color: 'success' as const };
  if (status === 'PENDING_EXPLANATION') return { label: '위험', color: 'error' as const };
  if (status === 'IN_REVIEW') return { label: '주의', color: 'warning' as const };
  if (status === 'RESOLVED' || status === 'IGNORED') return { label: '정상', color: 'success' as const };

  const normalizedScore = normalizeScore(row.score);
  if (normalizedScore >= 80) return { label: '위험', color: 'error' as const };
  if (normalizedScore >= 60) return { label: '주의', color: 'warning' as const };
  return { label: '정상', color: 'success' as const };
};

export const evidenceStatusFromRow = (row: VoucherRow) => {
  const status = toUpperStatus(row.caseStatus);
  if (status === 'NORMAL') return '정상';
  if (status === 'PENDING_EXPLANATION') return '소명 필요';
  if (status === 'IN_REVIEW') return '검토 중';
  if (status === 'RESOLVED' || status === 'IGNORED') return '완료';
  return '정상';
};

export const mapMyVoucherListItems = (items: MyVoucherRowDto[]): VoucherRow[] =>
  items.map((item) => ({
    id: typeof item.caseId === 'string' || typeof item.caseId === 'number' ? String(item.caseId) : '',
    bukrs: String(item.bukrs ?? ''),
    belnr: String(item.belnr ?? ''),
    gjahr: String(item.gjahr ?? ''),
    postingDate: String(item.postingDate ?? ''),
    wrbtr: Number(item.wrbtr ?? 0),
    waers: String(item.waers ?? ''),
    bktxt: String(item.bktxt ?? ''),
    caseStatus: typeof item.caseStatus === 'string' ? item.caseStatus : undefined,
    score: typeof item.score === 'number' ? item.score : undefined,
    detectedAt: typeof item.detectedAt === 'string' ? item.detectedAt : undefined,
  }));
