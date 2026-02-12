/**
 * Agent Studio — 에이전트 스튜디오 통합 관리 화면 타입
 * 코드 목록은 BE catalog API (useAgentCatalog) 사용. 하드코딩 상수 없음.
 */

export type KnowledgeBaseItem = {
  id: string;
  name: string;
  description?: string;
  documentCount?: number;
  boundToAgent?: boolean;
};

