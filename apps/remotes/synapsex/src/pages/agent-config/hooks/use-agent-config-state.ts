/**
 * Agent Studio — 선택 에이전트 기준 모델/프롬프트/도구/지식 상태
 * BE AgentDetailDto 로부터 hydrate 가능.
 */

import { useState, useCallback } from 'react';

import type { AgentDetailDto } from '@dwp-frontend/shared-utils';

/** Aura 런타임 치환: {context}, {code} 만 사용. {case_json} 등은 치환되지 않음. */
const DEFAULT_SYSTEM_PROMPT = `SYSTEM: You are a safe enterprise finance agent.

INPUT: {context}

TASK: Produce (1) summary, (2) evidence table, (3) proposed actions with guardrail checks.
(케이스 정보는 런타임에 context에 caseId, documentIds 등으로 전달됩니다.)`;

export const useAgentConfigState = (_selectedAgentId: string | null) => {
  const [engineKey, setEngineKey] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [domainKey, setDomainKey] = useState('');
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [tools, setTools] = useState<Record<string, boolean>>({});
  const [boundKnowledgeIds, setBoundKnowledgeIds] = useState<Set<string>>(new Set());

  const toggleTool = useCallback((key: string, checked: boolean) => {
    setTools((prev) => ({ ...prev, [key]: checked }));
  }, []);

  const setToolsFromList = useCallback((keys: string[], defaultChecked = false) => {
    setTools((prev) => {
      const next = { ...prev };
      keys.forEach((key) => {
        if (!(key in next)) next[key] = defaultChecked;
      });
      return next;
    });
  }, []);

  const toggleKnowledgeBinding = useCallback((knowledgeId: string, bound: boolean) => {
    setBoundKnowledgeIds((prev) => {
      const next = new Set(prev);
      if (bound) next.add(knowledgeId);
      else next.delete(knowledgeId);
      return next;
    });
  }, []);

  /** BE AgentDetailDto 로 4탭 상태 동기화 */
  const hydrateFromDetail = useCallback((detail: AgentDetailDto | null) => {
    if (!detail) {
      setEngineKey('gpt-4o');
      setTemperature(0.2);
      setMaxTokens(4096);
      setDomainKey('');
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      setTools({});
      setBoundKnowledgeIds(new Set());
      return;
    }
    setEngineKey(detail.engineKey ?? detail.modelName ?? 'gpt-4o');
    setTemperature(typeof detail.temperature === 'number' ? detail.temperature : 0.2);
    setMaxTokens(typeof detail.maxTokens === 'number' ? detail.maxTokens : 4096);
    setDomainKey(detail.domainKey ?? detail.domain ?? '');
    setSystemPrompt(detail.systemInstruction ?? detail.systemPrompt ?? DEFAULT_SYSTEM_PROMPT);
    const toolMap: Record<string, boolean> = {};
    (detail.toolKeys ?? []).forEach((k) => {
      toolMap[k] = true;
    });
    setTools(toolMap);
    setBoundKnowledgeIds(new Set(detail.knowledgeIds ?? []));
  }, []);

  return {
    engineKey,
    setEngineKey,
    temperature,
    setTemperature,
    maxTokens,
    setMaxTokens,
    domainKey,
    setDomainKey,
    systemPrompt,
    setSystemPrompt,
    tools,
    toggleTool,
    setToolsFromList,
    boundKnowledgeIds,
    toggleKnowledgeBinding,
    hydrateFromDetail,
    defaultSystemPrompt: DEFAULT_SYSTEM_PROMPT,
  };
};
