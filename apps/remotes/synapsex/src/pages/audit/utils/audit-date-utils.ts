/**
 * 감사 추적 로그 필터용 날짜 유틸
 * 프리셋: 오늘/24h/7d/30d + 커스텀(from/to)
 */

import type { AuditDatePreset } from '../types';

const toISO = (d: Date): string => d.toISOString();

/** 프리셋 → from/to ISO */
export const getDateRangeFromPreset = (
  preset: AuditDatePreset,
  customFrom?: string,
  customTo?: string
): { from: string; to: string } => {
  const now = new Date();
  const to = preset === 'custom' && customTo ? customTo : toISO(now);

  if (preset === 'custom' && customFrom) {
    return { from: customFrom, to };
  }

  let from: string;
  switch (preset) {
    case 'today': {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      from = toISO(start);
      break;
    }
    case '1h':
      from = toISO(new Date(now.getTime() - 60 * 60 * 1000));
      break;
    case '6h':
      from = toISO(new Date(now.getTime() - 6 * 60 * 60 * 1000));
      break;
    case '24h':
      from = toISO(new Date(now.getTime() - 24 * 60 * 60 * 1000));
      break;
    case '7d':
      from = toISO(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
      break;
    case '30d':
      from = toISO(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
      break;
    case '90d':
      from = toISO(new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000));
      break;
    default:
      from = toISO(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  }
  return { from, to };
};

/** ISO → datetime-local (YYYY-MM-DDTHH:mm) */
export const isoToDatetimeLocal = (iso: string): string => (iso ? iso.slice(0, 16) : '');
