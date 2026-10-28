import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  getApprovalStudioWorkflow,
  getApprovalStudioWorkflowReadProjection,
  getApprovalStudioWorkflows,
} from './approval-management-api';
import { isApprovalWorkflowDetailProjection } from './approval-management-contract';

const oversight = {
  workflowId: '11111111-1111-1111-1111-111111111111',
  workflowKey: 'EXPENSE_APPROVAL',
  nameKo: '비용 결재',
  nameEn: 'Expense approval',
  category: 'FINANCE',
  dataClassification: 'CONFIDENTIAL',
  lifecycleState: 'PUBLISHED',
  currentVersion: 2,
  slaMinutes: 240,
  version: 3,
  updatedAt: '2026-10-27T00:00:00Z',
} as const;

function json(data: unknown): Response {
  return { ok: true, status: 200, text: async () => JSON.stringify({ data }) } as Response;
}

describe('approval workflow read projection API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('preserves oversight list and detail without promoting them to owner detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json([oversight]))
        .mockResolvedValue(json(oversight))
    );

    await expect(getApprovalStudioWorkflows('opaque-scope')).resolves.toEqual([oversight]);
    const projection = await getApprovalStudioWorkflowReadProjection(
      oversight.workflowId,
      'opaque-scope'
    );

    expect(isApprovalWorkflowDetailProjection(projection)).toBe(false);
    expect(projection).toEqual(oversight);
    await expect(getApprovalStudioWorkflow(oversight.workflowId, 'opaque-scope')).rejects.toThrow(
      'detail is unavailable'
    );
  });

  it('keeps a complete owner detail available to strict management callers', async () => {
    const detail = {
      workflow: {
        ...oversight,
        descriptionKo: '비용 결재 프로세스',
        descriptionEn: 'Expense approval process',
        allowSelfApproval: false,
        ownerGroupRef: 'FINANCE_APPROVER',
      },
      definition: {
        schemaVersion: 1,
        steps: [
          {
            key: 'review',
            name: 'Review',
            mode: 'ANY',
            candidateRole: 'FINANCE_APPROVER',
            slaMinutes: 240,
          },
        ],
        guardrails: {},
      },
      definitionHash: 'a'.repeat(64),
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(detail)));

    await expect(getApprovalStudioWorkflow(oversight.workflowId, 'opaque-scope')).resolves.toEqual(
      detail
    );
  });

  it.each([
    null,
    7,
    {},
    { workflowId: 'workflow-1', workflowKey: 'WORKFLOW' },
    {
      workflow: {
        ...oversight,
        descriptionKo: '',
        descriptionEn: '',
        allowSelfApproval: false,
      },
      definition: { schemaVersion: 1, steps: {}, guardrails: {} },
      definitionHash: 'a'.repeat(64),
    },
  ])(
    'rejects a malformed successful detail projection without a runtime TypeError (%#)',
    async (value) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(value)));

      await expect(
        getApprovalStudioWorkflowReadProjection(oversight.workflowId, 'opaque-scope')
      ).rejects.toThrow('Invalid approval workflow read projection');
    }
  );

  it('rejects a malformed successful list projection', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json([{ ...oversight, slaMinutes: null }])));

    await expect(getApprovalStudioWorkflows('opaque-scope')).rejects.toThrow(
      'Invalid approval workflow list projection'
    );
  });
});
