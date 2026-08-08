import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { previewAgentPlan } from './agent-plan-api';

function jsonResponse(status: number, payload: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe('agent plan preview API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('uses the governed gateway endpoint for a valid preview', async () => {
    const plan = {
      runId: 'run-ref-1',
      auditId: 'AUD-REF-1',
      planHash: 'a'.repeat(64),
      correlationId: 'correlation-1',
      state: 'REVIEW',
      riskTier: 'L2',
      approvalRequired: true,
      mutationAllowed: false,
      summary: 'Preview',
      steps: [
        {
          id: 'human-gate',
          title: 'Wait for approval',
          tool: 'workflow.human-approval',
          description: 'No mutation before approval.',
        },
      ],
      sourceReferences: ['source-1'],
      referenceMode: true,
      agentRegistry: {
        entryKey: 'REFERENCE_PLANNER',
        revision: 2,
        artifactVersion: '1.1.0',
        riskTier: 'MEDIUM',
        resolution: 'ACTIVE',
      },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' },
        })
      )
      .mockResolvedValueOnce(jsonResponse(200, { status: 'SUCCESS', message: 'OK', data: plan }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await previewAgentPlan({
      requestId: 'request-1',
      intent: 'Preview remote work',
      action: 'flexible work request',
      target: 'employee-services/flexible-work',
      sourceReferences: ['source-1'],
      agentKey: 'REFERENCE_PLANNER',
    });

    expect(result).toEqual(plan);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/agent/v1/plans/preview',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({ 'X-XSRF-TOKEN': 'csrf-token' }),
      })
    );
  });

  it.each([
    ['mutation is allowed', { mutationAllowed: true }],
    ['elevated risk skips approval', { riskTier: 'L2', approvalRequired: false }],
    ['reference mode is disabled', { referenceMode: false }],
    ['plan hash is malformed', { planHash: 'mutable-plan-id' }],
    [
      'active registry has no revision',
      {
        agentRegistry: {
          entryKey: 'REFERENCE_PLANNER',
          revision: 0,
          artifactVersion: '1.0.0',
          riskTier: 'MEDIUM',
          resolution: 'ACTIVE',
        },
      },
    ],
  ])('fails closed when %s', async (_case, unsafePlan) => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          status: 'SUCCESS',
          message: 'OK',
          data: {
            runId: 'run-ref-1',
            auditId: 'AUD-REF-1',
            planHash: 'a'.repeat(64),
            correlationId: 'correlation-1',
            state: 'REVIEW',
            riskTier: 'L2',
            approvalRequired: true,
            mutationAllowed: false,
            summary: 'Preview',
            steps: [
              {
                id: 'human-gate',
                title: 'Wait for approval',
                tool: 'workflow.human-approval',
                description: 'No mutation before approval.',
              },
            ],
            sourceReferences: [],
            referenceMode: true,
            agentRegistry: {
              entryKey: 'REFERENCE_PLANNER',
              revision: 2,
              artifactVersion: '1.1.0',
              riskTier: 'MEDIUM',
              resolution: 'ACTIVE',
            },
            ...unsafePlan,
          },
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      previewAgentPlan({
        requestId: 'request-1',
        intent: 'Preview remote work',
        action: 'flexible work request',
        target: 'employee-services/flexible-work',
        sourceReferences: [],
        agentKey: 'REFERENCE_PLANNER',
      })
    ).rejects.toMatchObject({ status: 502 });
  });
});
