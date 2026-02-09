/**
 * 필터 검색조건 세션 저장 — 메뉴 이동 후 복귀 시 기존 검색조건 유지
 * sessionStorage 사용 (탭 기준, 탭 닫으면 초기화)
 */

const STORAGE_PREFIX = 'dwp-filters-';

export const getFiltersFromStorage = <T>(routeKey: string): T | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${routeKey}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const saveFiltersToStorage = <T>(routeKey: string, filters: T): void => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${routeKey}`, JSON.stringify(filters));
  } catch {
    // ignore
  }
};
