/**
 * 공용 Evidence 타입 정의
 * case-detail, lineage 등에서 공통으로 사용
 */

// ----------------------------------------------------------------------
// Context Hierarchy (계층 경로: 장 > 조 > 항)
// ----------------------------------------------------------------------

/** 규정 계층 레벨 */
export type HierarchyLevel = 'CHAPTER' | 'ARTICLE' | 'CLAUSE' | 'PARAGRAPH';

/** 계층 경로 아이템 */
export interface HierarchyPathItem {
  level: HierarchyLevel;
  number?: string; // 예: "5", "11", "2"
  title?: string; // 예: "AI 기반 부정 거래 탐지", "AI 에이전트의 역할"
  /** 원문 위치 (스크롤 이동용) - chunkId와 동일 */
  anchorId?: string;
}

/** 계층 경로 전체 (상위 → 하위 순서) */
export type HierarchyPath = HierarchyPathItem[];

/** 계층 레벨 한글 라벨 */
export const HIERARCHY_LEVEL_LABELS: Record<HierarchyLevel, string> = {
  CHAPTER: '장',
  ARTICLE: '조',
  CLAUSE: '항',
  PARAGRAPH: '목',
};

/** 계층 경로를 브레드크럼 문자열로 변환 */
export function formatHierarchyPath(path: HierarchyPath): string {
  return path
    .map((item) => {
      const prefix = HIERARCHY_LEVEL_LABELS[item.level];
      const num = item.number ? `제${item.number}${prefix}` : prefix;
      return item.title ? `${num} (${item.title})` : num;
    })
    .join(' > ');
}

/** 계층 경로를 간략한 형태로 변환 (예: "제5장 > 제11조") */
export function formatHierarchyPathShort(path: HierarchyPath): string {
  return path
    .map((item) => {
      const prefix = HIERARCHY_LEVEL_LABELS[item.level];
      return item.number ? `제${item.number}${prefix}` : prefix;
    })
    .join(' > ');
}

// ----------------------------------------------------------------------
// RAG Citation (정책/규정 인용)
// ----------------------------------------------------------------------

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
  /** 계층 경로 (Context Breadcrumb) */
  hierarchyPath?: HierarchyPath;
  /** Severity (HIGH/MEDIUM/LOW) - Evidence Link 클릭 대상 */
  severity?: 'HIGH' | 'MEDIUM' | 'LOW';
  /** 원문 위치 (Evidence Link 스크롤 이동용) - chunkId와 동일 */
  anchorId?: string;
  /** chunkId (anchorId로도 사용) */
  chunkId?: string;
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

// ----------------------------------------------------------------------
// Hybrid RAG Response → RagCitation 변환 헬퍼
// ----------------------------------------------------------------------

import type {
  RagParentResultDto,
  RagChildChunkDto,
  HierarchyPathItem as ApiHierarchyPathItem,
} from '@dwp-frontend/shared-utils';

/** API HierarchyPathItem → 로컬 HierarchyPathItem 변환 */
function toLocalHierarchyPath(apiPath?: ApiHierarchyPathItem[]): HierarchyPath | undefined {
  if (!apiPath || apiPath.length === 0) return undefined;
  return apiPath.map((item) => ({
    level: item.level,
    number: item.number,
    title: item.title,
    anchorId: item.anchorId,
  }));
}

/** Hybrid RAG 응답을 RagCitation[] 으로 flat 변환 */
export function hybridRagToFlatCitations(parents: RagParentResultDto[]): RagCitation[] {
  const citations: RagCitation[] = [];
  for (const parent of parents) {
    for (const child of parent.children) {
      citations.push({
        id: child.chunkId,
        chunkId: child.chunkId,
        anchorId: child.anchorId || child.chunkId,
        title: parent.title || parent.articleNo || 'Untitled',
        docTitle: parent.docTitle,
        policyCode: parent.articleNo,
        relevanceScore: Math.round(child.score * 100),
        quote: child.snippet,
        hierarchyPath: toLocalHierarchyPath(child.hierarchyPath),
      });
    }
  }
  return citations;
}

/** 저신뢰 임계값 (50%) */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

/** Parent 그룹 형태로 변환 (UI용) */
export interface ParentCitationGroup {
  parentId: string;
  articleNo?: string;
  title?: string;
  docId?: string;
  docTitle?: string;
  version?: string;
  maxScore: number;
  isLowConfidence: boolean;
  children: Array<{
    chunkId: string;
    anchorId: string;
    snippet: string;
    score: number;
    hierarchyPath?: HierarchyPath;
  }>;
}

/** Hybrid RAG 응답을 ParentCitationGroup[] 으로 변환 */
export function hybridRagToParentGroups(parents: RagParentResultDto[]): ParentCitationGroup[] {
  return parents.map((parent) => ({
    parentId: parent.parentId,
    articleNo: parent.articleNo,
    title: parent.title,
    docId: parent.docId,
    docTitle: parent.docTitle,
    version: parent.version,
    maxScore: parent.maxScore ?? Math.max(...parent.children.map((c) => c.score), 0),
    isLowConfidence: (parent.maxScore ?? Math.max(...parent.children.map((c) => c.score), 0)) < LOW_CONFIDENCE_THRESHOLD,
    children: parent.children.map((child) => ({
      chunkId: child.chunkId,
      anchorId: child.anchorId || child.chunkId,
      snippet: child.snippet,
      score: child.score,
      hierarchyPath: toLocalHierarchyPath(child.hierarchyPath),
    })),
  }));
}
