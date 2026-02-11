/**
 * 공용 Evidence 타입 정의
 * case-detail, lineage 등에서 공통으로 사용
 */

// RAG Citation (정책/규정 인용)
export interface RagCitation {
  id?: string;
  policyCode?: string;
  title: string; // 정책/문서 제목
  docTitle?: string; // 별도 문서명 (title과 동일하거나 추가 정보)
  relevanceScore?: number; // 0~100
  pageNumber?: number;
  quote?: string; // 1~2문장 인용
  /** 규정집 본문 전체(선택). 있으면 모달에서 인용 문장(quote) 하이라이트 표시 */
  bodyText?: string;
  source?: string; // URL 또는 식별자
  tags?: string[]; // 선택적 태그
}

// Statistical Evidence (통계 근거)
export interface StatsEvidence {
  zScore: number; // Z-Score (표준편차)
  mean: number; // 평균
  std: number; // 표준편차
  delta: number; // 델타 (차이)
}

// Lineage Step (계보 단계)
export interface LineageStep {
  id: string;
  name: string;
  timestamp: string;
  status: 'complete' | 'running' | 'failed' | 'pending';
  system: string;
  details: Record<string, any>;
  rawJson?: string;
  ragEvidence?: RagCitation[];
  statsEvidence?: StatsEvidence;
}

/** 시연/테스트용 시나리오 데이터 여부 (DEMO_NORM_01 등) — 라벨 [Scenario Data] 표시용 */
const SCENARIO_INDICATORS = [
  'DEMO_NORM',
  'DEMO_',
  'Scenario',
  '시나리오',
  '테스트 데이터',
  '테스트규정',
] as const;

export function isScenarioCitation(
  citation: Pick<RagCitation, 'id' | 'policyCode' | 'title' | 'docTitle' | 'source'>
): boolean {
  const haystack = [
    citation.id,
    citation.policyCode,
    citation.title,
    citation.docTitle,
    citation.source,
  ]
    .filter(Boolean)
    .map(String)
    .join(' ')
    .toLowerCase();
  return SCENARIO_INDICATORS.some(
    (ind) => haystack.includes(ind.toLowerCase())
  );
}

// Time Travel 관련
export interface VendorMasterSnapshot {
  timestamp: string;
  data: Record<string, any>;
}

export interface VendorMasterChange {
  field: string;
  oldValue: string;
  newValue: string;
}
