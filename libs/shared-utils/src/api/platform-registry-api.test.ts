import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { listRuntimeRegistryEntries, type RuntimeRegistryEntry } from './platform-registry-api';

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

function runtimeAgent(): RuntimeRegistryEntry {
  return {
    registryType: 'AGENT',
    entryKey: 'DWP_ASSISTANT',
    revision: 3,
    name: 'DWAI-ON Workplace Assistant',
    description: 'Published runtime entry',
    ownerRef: 'agent:runtime',
    riskTier: 'MEDIUM',
    artifactVersion: 'ask-runtime-v2',
    updatedAt: '2026-09-09T10:00:00',
    agentCatalogProfile: {
      schemaVersion: 1,
      category: 'GENERAL',
      displayName: { ko: '일반 업무 길잡이', en: 'General workplace guide' },
      description: { ko: '업무 근거를 설명합니다.', en: 'Explains work evidence.' },
      capabilities: [{ ko: '업무를 요약합니다.', en: 'Summarizes work.' }],
      boundaries: [{ ko: '직접 변경하지 않습니다.', en: 'Does not mutate work.' }],
      sources: [
        {
          sourceSystem: 'WORK_ITEM',
          displayName: { ko: '업무', en: 'Work items' },
          requiredPermissions: ['APP.WORK:VIEW'],
          permissionMatch: 'ANY_OF',
          accessMode: 'READ_ONLY',
        },
      ],
      starterPrompts: [{ ko: '오늘 업무를 정리해 주세요.', en: "Summarize today's work." }],
      safetySummary: { ko: '사용자가 확인합니다.', en: 'The user confirms changes.' },
      humanConfirmationRequired: true,
    },
  };
}

describe('platform runtime registry API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('accepts the versioned governed agent catalog profile', async () => {
    const data = [runtimeAgent()];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { data })));

    await expect(listRuntimeRegistryEntries('AGENT')).resolves.toEqual(data);
  });

  it.each([
    ['schema version', { schemaVersion: 2 }],
    ['empty capabilities', { capabilities: [] }],
    [
      'untyped source permissions',
      {
        sources: [{ ...runtimeAgent().agentCatalogProfile!.sources[0], requiredPermissions: [17] }],
      },
    ],
    [
      'unsupported access mode',
      { sources: [{ ...runtimeAgent().agentCatalogProfile!.sources[0], accessMode: 'WRITE' }] },
    ],
  ])('rejects an invalid %s instead of exposing fallback catalog copy', async (_label, patch) => {
    const agent = runtimeAgent();
    const data = [{ ...agent, agentCatalogProfile: { ...agent.agentCatalogProfile, ...patch } }];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { data })));

    await expect(listRuntimeRegistryEntries('AGENT')).rejects.toMatchObject({ status: 502 });
  });
});
