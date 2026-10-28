import { describe, expect, it } from 'vitest';

import { approvalWorkflowReadModel } from './approval-workflow-read-projection';

import type {
  ApprovalWorkflowDetail,
  ApprovalWorkflowOversightProjection,
} from '@dwp-frontend/shared-utils';

const workflow: ApprovalWorkflowOversightProjection = {
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
};

describe('approval workflow read projection', () => {
  it('keeps oversight metadata selectable without promoting it to editable owner detail', async () => {
    await expect(approvalWorkflowReadModel(workflow)).resolves.toEqual({ workflow });
  });

  it('captures a full-management detail for the workflow editor', async () => {
    const detail: ApprovalWorkflowDetail = {
      workflow: {
        ...workflow,
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

    await expect(approvalWorkflowReadModel(detail)).resolves.toEqual({
      workflow: detail.workflow,
      owner: { ...detail, kind: 'legacy' },
    });
  });
});
