import { describe, expect, it } from 'vitest';

import {
  buildApprovalDelegationCreateInput,
  buildApprovalDelegationWorkflowReference,
  buildApprovalDelegationWorkflowOptions,
  isApprovalDelegationDirection,
} from './approval-delegation-model';

import type { ApprovalWorkflow } from '@dwp-frontend/shared-utils';

function workflow(workflowId: string, nameKo: string): ApprovalWorkflow {
  return {
    workflowId,
    workflowKey: 'SHARED_DISPLAY_KEY',
    nameKo,
    nameEn: nameKo,
    descriptionKo: '',
    descriptionEn: '',
    category: 'GENERAL',
    dataClassification: 'INTERNAL',
    lifecycleState: 'PUBLISHED',
    currentVersion: 1,
    slaMinutes: 60,
    allowSelfApproval: false,
    version: 1,
    updatedAt: '2026-08-24T00:00:00Z',
  };
}

describe('approval delegation workflow identity', () => {
  it('keeps the direction contract closed when an API response is partial or invalid', () => {
    expect(isApprovalDelegationDirection('OUTGOING')).toBe(true);
    expect(isApprovalDelegationDirection('INCOMING')).toBe(true);
    expect(isApprovalDelegationDirection(undefined)).toBe(false);
    expect(isApprovalDelegationDirection('SIDEWAYS')).toBe(false);
  });

  it('keeps same-key A/B workflows distinct by immutable UUID and uses the key only in labels', () => {
    const options = buildApprovalDelegationWorkflowOptions(
      [
        workflow('11111111-1111-4111-8111-111111111111', '프로세스 A'),
        workflow('22222222-2222-4222-8222-222222222222', '프로세스 B'),
      ],
      'ko-KR'
    );

    expect(options).toEqual([
      {
        value: '11111111-1111-4111-8111-111111111111',
        label: '프로세스 A · SHARED_DISPLAY_KEY',
      },
      {
        value: '22222222-2222-4222-8222-222222222222',
        label: '프로세스 B · SHARED_DISPLAY_KEY',
      },
    ]);
    expect(new Set(options.map((option) => option.value)).size).toBe(2);
    expect(options.map((option) => option.value)).not.toContain('SHARED_DISPLAY_KEY');

    expect(
      buildApprovalDelegationCreateInput({
        delegateUserId: 7,
        scopeType: 'WORKFLOW',
        workflowId: options[1]!.value,
        startsAt: '2026-08-25T00:00:00.000Z',
        endsAt: '2026-08-31T00:00:00.000Z',
        reason: 'Same-key workflow B coverage.',
      })
    ).toEqual({
      delegateUserId: 7,
      scopeType: 'WORKFLOW',
      workflowId: '22222222-2222-4222-8222-222222222222',
      startsAt: '2026-08-25T00:00:00.000Z',
      endsAt: '2026-08-31T00:00:00.000Z',
      reason: 'Same-key workflow B coverage.',
    });
  });

  it('distinguishes same-key A/B rows by compact immutable ID and falls back to ID without a key', () => {
    const first = buildApprovalDelegationWorkflowReference({
      workflowId: '11111111-1111-4111-8111-111111111111',
      workflowKey: 'SHARED_DISPLAY_KEY',
    });
    const second = buildApprovalDelegationWorkflowReference({
      workflowId: '22222222-2222-4222-8222-222222222222',
      workflowKey: 'SHARED_DISPLAY_KEY',
    });

    expect(first.displayKey).toBe(second.displayKey);
    expect(first.compactWorkflowId).toBe('11111111…1111');
    expect(second.compactWorkflowId).toBe('22222222…2222');
    expect(first.workflowId).not.toBe(second.workflowId);
    expect(
      buildApprovalDelegationWorkflowReference({
        workflowId: '33333333-3333-4333-8333-333333333333',
        workflowKey: null,
      })
    ).toEqual({
      displayKey: '33333333…3333',
      compactWorkflowId: '33333333…3333',
      workflowId: '33333333-3333-4333-8333-333333333333',
    });
  });
});
