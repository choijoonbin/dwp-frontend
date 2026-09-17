import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  bootstrapAIExecutionPolicy,
  getAIControlOverview,
  setAIEmergencyDisable,
  updateAIExecutionPolicy,
  type EditableAIExecutionPolicy,
} from './agent-ai-control-api';

const AUTHORITY = {
  mode: 'SECURE',
  rolloutState: '110',
  expectedDecisionRevision: 'psr-management-current',
  contextKey: 'psc-dwaion-management',
  contextScopeKey: 'scope-dwaion-management',
} as const;

const POLICY: EditableAIExecutionPolicy = {
  allowedModelRoutes: [
    {
      provider: 'OPENAI',
      model: 'approved-model',
      region: 'kr',
      availabilityState: 'UNVERIFIED',
      availabilityObservedAt: null,
    },
  ],
  allowedToolKeys: [],
  allowedKnowledgeSources: ['WORK_ITEM'],
  maxOutputTokensPerRequest: 900,
  budgetEnforcementMode: 'ENFORCED',
  periodTokenLimit: 1_000_000,
  alertThresholdPercent: 80,
  requireEvaluationPass: true,
  evaluationGateStatus: 'PENDING',
  evaluationObservedAt: null,
  evaluationPolicyVersion: null,
  changeReason: 'Configure the tenant Ask runtime controls.',
};

function response(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

describe('tenant AI runtime control API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('reads the tenant-scoped runtime overview through the agent gateway', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ success: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await getAIControlOverview();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/agent/v1/admin/ai-control',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('governs bootstrap, update, and emergency commands with the selected scope and revision', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValue(response({ success: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await bootstrapAIExecutionPolicy(
      { ...POLICY, idempotencyKey: crypto.randomUUID(), expectedExistingCount: 0 },
      AUTHORITY
    );
    await updateAIExecutionPolicy({ ...POLICY, expectedVersion: 4 }, AUTHORITY);
    await setAIEmergencyDisable(
      {
        disabled: true,
        expectedVersion: 5,
        changeReason: 'Pause new Ask runtime admissions during the incident.',
      },
      AUTHORITY
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/admin/ai-control/bootstrap?contextScopeKey=scope-dwaion-management',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-DWP-Expected-Decision-Revision': 'psr-management-current',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/agent/v1/admin/ai-control/policy?contextScopeKey=scope-dwaion-management',
      expect.objectContaining({ method: 'PUT' })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/agent/v1/admin/ai-control/emergency?contextScopeKey=scope-dwaion-management',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
