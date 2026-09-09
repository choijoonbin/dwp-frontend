import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { updateDwaionSafetyPolicy } from './agent-admin-api';
import { decideDwaionOperationalGate } from './agent-admin-gate-api';
import { createDwaionAdminAgent } from './platform-registry-api';

const AUTHORITY = {
  mode: 'SECURE',
  rolloutState: '110',
  expectedDecisionRevision: 'psr-management-current',
  contextKey: 'psc-dwaion-management',
  contextScopeKey: 'scope-dwaion-management',
} as const;

function response(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
    headers: new Headers(),
  } as Response;
}

describe('DWAI-ON management mutation API projection', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('sends the trusted scope selector and current decision revision to both owner services', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValue(response({ success: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await updateDwaionSafetyPolicy(
      {
        privilegedDataOutcome: 'DENY',
        mutationOutcome: 'HANDOFF',
        requireCitations: true,
        maxSourceScopes: 3,
        maxToolCalls: 4,
        expectedVersion: 2,
        changeReason: 'Tighten governed safety controls.',
      },
      AUTHORITY
    );
    await decideDwaionOperationalGate(
      'RELEASE_APPROVAL',
      'PRODUCTION',
      {
        decision: 'APPROVE',
        validDays: 30,
        expectedVersion: 7,
        changeReason: 'Approve the verified release evidence.',
      },
      AUTHORITY
    );
    await createDwaionAdminAgent(
      {
        entryKey: 'DWP_ASSISTANT',
        name: 'DWAI-ON assistant',
        description: 'Governed workplace assistant',
        ownerRef: 'agent:runtime',
        riskTier: 'MEDIUM',
        artifactVersion: 'ask-runtime-v2',
      },
      AUTHORITY
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/admin/safety?contextScopeKey=scope-dwaion-management',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-DWP-Expected-Decision-Revision': 'psr-management-current',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/agent/v1/admin/gates/RELEASE_APPROVAL/decision?environment=PRODUCTION&contextScopeKey=scope-dwaion-management',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-DWP-Expected-Decision-Revision': 'psr-management-current',
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/platform/v1/admin/dwaion/agents?contextScopeKey=scope-dwaion-management',
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-DWP-Expected-Decision-Revision': 'psr-management-current',
        }),
      })
    );
  });
});
