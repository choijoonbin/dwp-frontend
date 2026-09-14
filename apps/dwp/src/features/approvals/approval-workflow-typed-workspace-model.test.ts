import { describe, expect, it } from 'vitest';
import { APPROVAL_TYPED_WORKFLOW_CONTRACT } from './approval-workflow-typed-model';
import { compileApprovalTypedWorkflow } from './approval-workflow-typed-compiler';
import { compileApprovalTypedForm } from './approval-form-typed-compiler';
import {
  approvalWorkflowOwnerDraft,
  approvalWorkflowWorkspaceValid,
  captureApprovalWorkflowOwnerDetail,
  createApprovalWorkflowWorkspaceSeed,
  isApprovalTypedWorkflowDraft,
} from './approval-workflow-typed-workspace-model';

import type { ApprovalTypedWorkflowDefinition } from './approval-workflow-typed-model';
import type { ApprovalWorkflow } from '@dwp-frontend/shared-utils';

const workflow: ApprovalWorkflow = {
  workflowId: '88888888-8888-4888-8888-888888888888',
  workflowKey: 'REVIEW_GRAPH',
  nameKo: 'Review',
  nameEn: 'Review',
  descriptionKo: 'Review stages',
  descriptionEn: 'Review stages',
  category: 'GENERAL',
  dataClassification: 'INTERNAL',
  lifecycleState: 'DRAFT',
  currentVersion: 3,
  slaMinutes: 30,
  allowSelfApproval: false,
  ownerGroupRef: 'APPROVAL_OPERATOR',
  version: 3,
  updatedAt: '2026-09-14T00:00:00Z',
};
const definition: ApprovalTypedWorkflowDefinition = {
  schemaContract: APPROVAL_TYPED_WORKFLOW_CONTRACT,
  schemaVersion: 2,
  slaMinutes: 30,
  stages: [
    {
      key: 'FIRST_REVIEW',
      name: 'First review',
      candidateRole: 'APPROVAL_OPERATOR',
      quorum: { mode: 'COUNT', value: 2 },
      slaMinutes: 15,
      predecessors: [],
    },
  ],
};

describe('typed workflow owner and editor boundaries', () => {
  it('keeps tagged owner definition typed and excludes legacy steps from its draft', async () => {
    const compiled = await compileApprovalTypedWorkflow(definition);
    const owner = await captureApprovalWorkflowOwnerDetail({
      workflow,
      definition,
      definitionHash: compiled.definitionSha256,
    });
    expect(owner.kind).toBe('typed');
    const draft = approvalWorkflowOwnerDraft(owner);
    expect(isApprovalTypedWorkflowDraft(draft)).toBe(true);
    expect(Object.hasOwn(draft, 'steps')).toBe(false);
    expect(draft.typedDefinition?.stages[0].quorum).toEqual({ mode: 'COUNT', value: 2 });
    expect(approvalWorkflowWorkspaceValid(draft)).toBe(true);
    expect(Object.isFrozen(draft.typedDefinition?.stages)).toBe(true);
  });
  it.each([1, 2])(
    'keeps unmarked legacy schema %s in its original steps path',
    async (schemaVersion) => {
      const steps = [
        {
          key: 'FIRST_REVIEW',
          name: 'First review',
          candidateRole: 'APPROVAL_OPERATOR',
          mode: 'ANY' as const,
          slaMinutes: 15,
        },
      ];
      const owner = await captureApprovalWorkflowOwnerDetail({
        workflow,
        definition: { schemaVersion, steps, guardrails: { selfApproval: false } },
        definitionHash: 'legacy-server-hash',
      });
      const draft = approvalWorkflowOwnerDraft(owner);
      expect(owner.kind).toBe('legacy');
      expect(isApprovalTypedWorkflowDraft(draft)).toBe(false);
      expect(Object.hasOwn(draft, 'typedDefinition')).toBe(false);
      expect(draft.steps).toEqual(steps);
      expect(approvalWorkflowWorkspaceValid(draft)).toBe(true);
    }
  );
  it.each(['HASH', 'SLA', 'ROLE_LENGTH'] as const)(
    'rejects owner %s disagreement instead of downgrading',
    async (defect) => {
      const raw =
        defect === 'ROLE_LENGTH'
          ? {
              ...definition,
              stages: [{ ...definition.stages[0], candidateRole: `A${'B'.repeat(50)}` }],
            }
          : definition;
      const compiled = await compileApprovalTypedWorkflow(raw);
      await expect(
        captureApprovalWorkflowOwnerDetail({
          workflow: defect === 'SLA' ? { ...workflow, slaMinutes: 31 } : workflow,
          definition: raw,
          definitionHash: defect === 'HASH' ? '0'.repeat(64) : compiled.definitionSha256,
        })
      ).rejects.toThrow();
    }
  );
  it('starts an incomplete typed draft without fabricated owner role or candidates', () => {
    const draft = createApprovalWorkflowWorkspaceSeed('typed');
    expect(draft.ownerGroupRef).toBe('');
    expect(draft.typedDefinition?.stages[0]).toMatchObject({ candidateRole: '', name: '' });
    expect(Object.hasOwn(draft, 'steps')).toBe(false);
    expect(approvalWorkflowWorkspaceValid(draft)).toBe(false);
  });
  it('requires a real compiled form source for conditions and preserves 28-digit strings', async () => {
    const form = await compileApprovalTypedForm({
      schemaContract: 'DWP_APPROVAL_FORM_TYPED_V2',
      schemaVersion: 2,
      fields: [
        {
          key: 'summary',
          type: 'TEXTAREA',
          required: true,
          labelKo: 'Summary',
          labelEn: 'Summary',
        },
        { key: 'amount', type: 'NUMBER', required: true, labelKo: 'Amount', labelEn: 'Amount' },
      ],
    });
    const typedDefinition: ApprovalTypedWorkflowDefinition = {
      ...definition,
      stages: [
        {
          ...definition.stages[0],
          routeCondition: {
            all: [{ field: 'amount', operator: 'GTE', value: '1234567890123456789012345678' }],
          },
        },
      ],
    };
    const draft = { ...workflow, ownerGroupRef: 'APPROVAL_OPERATOR', typedDefinition };
    expect(approvalWorkflowWorkspaceValid(draft)).toBe(false);
    expect(approvalWorkflowWorkspaceValid(draft, form)).toBe(true);
    expect(typedDefinition.stages[0].routeCondition?.all[0].value).toBe(
      '1234567890123456789012345678'
    );
    expect(
      approvalWorkflowWorkspaceValid(
        {
          ...draft,
          typedDefinition: {
            ...typedDefinition,
            stages: [
              {
                ...typedDefinition.stages[0],
                routeCondition: {
                  all: [{ field: 'amount', operator: 'GTE', value: '1.234567891' }],
                },
              },
            ],
          },
        },
        form
      )
    ).toBe(false);
  });
});
