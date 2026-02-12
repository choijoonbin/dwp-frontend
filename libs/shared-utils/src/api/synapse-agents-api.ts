/**
 * Synapse Agent Studio API
 * GET /api/synapse/agents, GET /api/synapse/agents/{id}, POST/DELETE /api/synapse/agents
 * Catalog: GET /api/synapse/agents/tools/catalog, knowledge via getRagDocuments
 * @see back.txt (BE 규격): agentId(Long), agentKey(snake_case), domain/modelName = app_codes
 */

import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { PageResponse } from '../admin/types';

type SpringPage<T> = {
  content?: T[];
  totalElements?: number;
  totalPages?: number;
  size?: number;
  number?: number;
};

function toPageResponse<T>(spring: SpringPage<T> | PageResponse<T>): PageResponse<T> {
  if ('items' in spring && Array.isArray(spring.items)) {
    return spring as PageResponse<T>;
  }
  const content = (spring as SpringPage<T>).content ?? [];
  const total = (spring as SpringPage<T>).totalElements ?? content.length;
  const size = (spring as SpringPage<T>).size ?? 20;
  const number = (spring as SpringPage<T>).number ?? 0;
  return {
    items: content,
    total,
    page: number,
    size,
    totalPages: (spring as SpringPage<T>).totalPages ?? (Math.ceil(total / size) || 1),
  };
}

// ----------------------------------------------------------------------
// Types (BE 계약)
// ----------------------------------------------------------------------

export type AgentListItemDto = {
  /** BE: agentId(Long). FE는 문자열로 통일 */
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  updatedAt?: string;
  /** 삭제 버튼 비활성화용 (기본 에이전트 등). BE 협의 */
  isDeletable?: boolean;
  /** 도구 탭 필터링용 (BE: toolIds) */
  toolIds?: number[];
  maxTokens?: number;
};

export type AgentDetailDto = {
  /** BE가 agentId(Long)만 줄 수 있음. FE는 id ?? String(agentId) 사용 */
  id: string;
  agentId?: number;
  name: string;
  description?: string;
  isActive: boolean;
  updatedAt?: string;
  /** 모델 탭 */
  engineKey?: string;
  modelName?: string;
  temperature?: number;
  domainKey?: string;
  domain?: string;
  maxTokens?: number;
  /** 프롬프트 탭 */
  systemPrompt?: string;
  /** BE 확장: 배포된 시스템 지침 (테스트 채팅 세션 초기화용) */
  systemInstruction?: string;
  /** 도구 탭: 활성화된 도구 키 목록 */
  toolKeys?: string[];
  /** 지식 탭: 바인딩된 지식( RAG ) ID 목록 */
  knowledgeIds?: string[];
};

export type AgentConfigPayload = {
  modelName: string;
  temperature: number;
  maxTokens?: number;
  domain?: string;
  systemInstruction: string;
  toolIds?: number[];
  knowledgeIds?: string[];
};

/**
 * 도구 카탈로그 항목.
 * key: BE DB tool_name 및 Aura @tool 함수명과 반드시 일치해야 함 (예: web_search).
 * label: UI 표시용 (예: "Google Search").
 */
export type AgentToolCatalogItemDto = {
  /** BE: toolId(Long) */
  toolId?: number;
  key: string;
  label: string;
  description?: string;
};

// ----------------------------------------------------------------------
// Knowledge (지식 탭)
// ----------------------------------------------------------------------

export type AgentKnowledgeItemDto = {
  docId: string | number;
  title: string;
  sourceType: string;
  docType?: string;
  status: string;
  createdAt: string;
};

export type AgentKnowledgeListParams = {
  page?: number;
  size?: number;
};

// ----------------------------------------------------------------------
// Agents CRUD
// ----------------------------------------------------------------------

/** GET /api/synapse/agents — 에이전트 목록 (사이드바) */
export const getAgents = async (): Promise<ApiResponse<AgentListItemDto[]>> => {
  const res = await axiosInstance.get<ApiResponse<AgentListItemDto[]>>('/api/synapse/agents');
  return res.data;
};

/** GET /api/synapse/agents/{id} — 단일 에이전트 상세 (4탭 상태 로드) */
export const getAgentById = async (id: string): Promise<ApiResponse<AgentDetailDto>> => {
  const res = await axiosInstance.get<ApiResponse<AgentDetailDto>>(
    `/api/synapse/agents/${encodeURIComponent(id)}`
  );
  return res.data;
};

/** PUT /api/synapse/agents/{id} — 변경 사항 저장 및 배포 */
export const updateAgentConfig = async (
  id: string,
  payload: AgentConfigPayload
): Promise<ApiResponse<AgentDetailDto>> => {
  const res = await axiosInstance.put<ApiResponse<AgentDetailDto>>(
    `/api/synapse/agents/${encodeURIComponent(id)}`,
    payload
  );
  return res.data;
};

/** POST /api/synapse/agents — 에이전트 등록(생성). domain/modelName = app_codes key (catalog) */
export type CreateAgentRequest = {
  agentKey: string;
  name: string;
  domain?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  systemInstruction?: string;
  toolIds?: number[];
};

export const createAgent = async (
  payload: CreateAgentRequest
): Promise<ApiResponse<AgentDetailDto>> => {
  const res = await axiosInstance.post<ApiResponse<AgentDetailDto>>(
    '/api/synapse/agents',
    payload
  );
  return res.data;
};

/** DELETE /api/synapse/agents/{id} — Soft delete (is_active = false) */
export const deleteAgent = async (id: string): Promise<ApiResponse<null>> => {
  const res = await axiosInstance.delete<ApiResponse<null>>(
    `/api/synapse/agents/${encodeURIComponent(id)}`
  );
  return res.data;
};

// ----------------------------------------------------------------------
// Catalog (도구 탭 / 지식 탭 옵션)
// ----------------------------------------------------------------------

/**
 * GET /api/synapse/agents/tools/catalog — 도구 카탈로그
 * 응답 key = DB tool_name = Aura @tool 함수명. FE는 key만 저장/전송.
 */
export const getAgentToolsCatalog = async (): Promise<
  ApiResponse<AgentToolCatalogItemDto[]>
> => {
  const res = await axiosInstance.get<ApiResponse<AgentToolCatalogItemDto[]>>(
    '/api/synapse/agents/tools'
  );
  return res.data;
};

/**
 * GET /api/synapse/agents/knowledge — 지식 베이스 카탈로그
 * Query: page, size
 */
export const getAgentKnowledgeCatalog = async (
  params?: AgentKnowledgeListParams
): Promise<ApiResponse<PageResponse<AgentKnowledgeItemDto>>> => {
  const query = new URLSearchParams();
  if (params?.page != null) query.set('page', String(params.page));
  if (params?.size != null) query.set('size', String(params.size));
  const url = `/api/synapse/agents/knowledge${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await axiosInstance.get<ApiResponse<
    SpringPage<AgentKnowledgeItemDto> | PageResponse<AgentKnowledgeItemDto> | AgentKnowledgeItemDto[]
  >>(url);
  const data = res.data?.data;
  if (Array.isArray(data)) {
    return { ...res.data, data: { items: data, total: data.length, page: 0, size: data.length, totalPages: 1 } };
  }
  if (data) return { ...res.data, data: toPageResponse(data) };
  return res.data as ApiResponse<PageResponse<AgentKnowledgeItemDto>>;
};

// ----------------------------------------------------------------------
// Catalog (모델/도메인/문서타입) — key=서버 전송값, value=UI 노출값
// ----------------------------------------------------------------------

export type CatalogCodeItemDto = { key: string; value: string };

export type AgentCatalogDto = {
  models: CatalogCodeItemDto[];
  domains: CatalogCodeItemDto[];
  docTypes: CatalogCodeItemDto[];
};

/** GET /api/synapse/agents/catalog — 모델/도메인/docTypes 코드. DB 설정만으로 확장 */
export const getAgentCatalog = async (): Promise<ApiResponse<AgentCatalogDto>> => {
  const res = await axiosInstance.get<ApiResponse<AgentCatalogDto>>('/api/synapse/agents/catalog');
  return res.data;
};
