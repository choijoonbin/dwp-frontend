/**
 * useCodes — 코드 그룹별 라벨 조회 (다국어)
 * BE sys_codes API가 Accept-Language에 따라 name_ko/name_en 반환
 * CaseList/CaseDetail/Badge 등에서 code → label 렌더링 시 사용
 */

import { useMemo } from 'react';

import { useCodesByGroupQuery } from './use-codes-by-group-query';

// ----------------------------------------------------------------------

/** 권장 groupKey: CASE_TYPE, CASE_STATUS, SEVERITY 등 */
export type CodeGroupKey = string;

export type UseCodesResult = {
  /** codeKey → codeName(라벨) 맵 */
  codeMap: Map<string, string>;
  /** code에 해당하는 라벨 반환, 없으면 code 그대로 fallback */
  getLabel: (code: string) => string;
  isLoading: boolean;
  error: Error | null;
};

/**
 * 코드 그룹을 조회하여 codeKey → label 맵 생성
 * Accept-Language 헤더로 BE가 언어별 name 반환
 */
export function useCodes(groupKey: string): UseCodesResult {
  const { data: codes, isLoading, error } = useCodesByGroupQuery(groupKey);

  const codeMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!codes) return map;
    for (const c of codes) {
      const key = (c.codeKey ?? (c as { code?: string }).code ?? '').trim();
      const label = (c.codeName ?? (c as { name?: string }).name ?? '').trim();
      if (key) map.set(key, label || key);
    }
    return map;
  }, [codes]);

  const getLabel = useMemo(
    () => (code: string) => {
      const key = (code ?? '').trim();
      if (!key) return '';
      return (
        codeMap.get(key) ??
        codeMap.get(key.toUpperCase()) ??
        codeMap.get(key.toLowerCase()) ??
        key
      );
    },
    [codeMap]
  );

  return {
    codeMap,
    getLabel,
    isLoading,
    error: error instanceof Error ? error : null,
  };
}
