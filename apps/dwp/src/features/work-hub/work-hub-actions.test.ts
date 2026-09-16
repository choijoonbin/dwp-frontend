import { describe, expect, it, vi } from 'vitest';
import type { AccessReviewWorkDetail } from '@dwp-frontend/shared-utils/api/access-review-work-api';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import {
  executeWorkHubAction,
  openWorkHubSourceRoute,
  workHubActionClients,
} from './work-hub-actions';
import { hubItem, KEY, personal, workspace } from './work-hub.test-support';
import { workspaceWorkToHub } from './work-hub-source-adapters';

function completedReceipt(overrides: Partial<ReturnType<typeof personal>> = {}) {
  const task = personal({ version: 3, status: 'COMPLETED' });
  return { ...task, completedAt: task.updatedAt, ...overrides };
}

function pendingAccessReview(): AccessReviewWorkDetail {
  return {
    workItemRef: KEY,
    campaignName: 'Quarterly access review',
    dueAt: '2026-09-09T00:00:00.000Z',
    subjectUserId: 7,
    subjectDisplayName: 'Reviewer',
    roleId: 9,
    roleCode: 'FINANCE_ADMIN',
    roleName: 'Finance admin',
    accessSourceType: 'GROUP',
    sourceKey: 'finance-reviewers',
    privileged: true,
    recommendation: 'REVIEW',
    recommendationReason: 'PRIVILEGED_ROLE',
    decision: 'PENDING',
    remediationState: 'NOT_REQUIRED',
    version: 2,
  };
}

function decidedAccessReview(
  detail: AccessReviewWorkDetail,
  overrides: Partial<AccessReviewWorkDetail> = {}
): AccessReviewWorkDetail {
  return {
    ...detail,
    decision: 'APPROVE',
    decisionReason: 'Reviewed current evidence',
    decidedAt: '2026-09-08T00:00:00.000Z',
    remediationState: 'NOT_REQUIRED',
    version: 3,
    ...overrides,
  };
}

describe('Work Hub owner commands', () => {
  it('cannot send generic completion to an external work projection', async () => {
    const update = vi.fn();
    const item = workspaceWorkToHub(
      workspace({ capabilities: { canStart: true, canComplete: true } })
    );
    expect(
      await executeWorkHubAction(
        item,
        { kind: 'WORKSPACE_COMPLETE' },
        { ...workHubActionClients, updateWorkspaceWorkStatus: update }
      )
    ).toEqual({ state: 'FORBIDDEN', retryable: false });
    expect(update).not.toHaveBeenCalled();
  });
  it('replays a personal command with the original version and identity after uncertain transport', async () => {
    const transition = vi
      .fn()
      .mockRejectedValueOnce(new Error('lost response'))
      .mockResolvedValueOnce(completedReceipt());
    const api = { ...workHubActionClients, transitionPersonalWorkTask: transition };
    const command = { kind: 'PERSONAL_COMPLETE' as const, idempotencyKey: KEY };
    expect((await executeWorkHubAction(hubItem(), command, api)).state).toBe('UNAVAILABLE');
    expect((await executeWorkHubAction(hubItem(), command, api)).state).toBe('CONFIRMED');
    expect(transition.mock.calls[0]).toEqual(transition.mock.calls[1]);
    expect(transition.mock.calls[1]).toEqual([KEY, 'complete', { version: 2 }, KEY]);
  });
  it.each([
    ['source reference', completedReceipt({ taskId: 'a4444444-4444-4444-8444-444444444444' })],
    ['target status', personal({ version: 3, status: 'WAITING' })],
    ['non-advanced version', completedReceipt({ version: 2 })],
    ['skipped version', completedReceipt({ version: 4 })],
    ['missing version', { ...completedReceipt(), version: undefined }],
    ['non-finite version', completedReceipt({ version: Number.POSITIVE_INFINITY })],
    ['malformed task id', completedReceipt({ taskId: 'different' })],
    ['malformed creation time', completedReceipt({ createdAt: 'invalid' })],
    [
      'regressed update time',
      completedReceipt({
        updatedAt: '2026-09-04T08:59:59Z',
        completedAt: '2026-09-04T08:59:59Z',
      }),
    ],
    ['mismatched completion time', completedReceipt({ completedAt: null })],
    ['changed title', completedReceipt({ title: 'Different task' })],
    ['malformed source', { ...completedReceipt(), source: { availability: 'UNAVAILABLE' } }],
  ])('does not confirm a personal 2xx response with mismatched %s', async (_case, response) => {
    const result = await executeWorkHubAction(
      hubItem(),
      { kind: 'PERSONAL_COMPLETE', idempotencyKey: KEY },
      {
        ...workHubActionClients,
        transitionPersonalWorkTask: vi.fn().mockResolvedValue(response),
      }
    );
    expect(result).toEqual({ state: 'UNAVAILABLE', retryable: true });
  });
  it.each([
    ['source reference', workspace({ workItemId: 'different', status: 'completed', version: 3 })],
    ['target status', workspace({ status: 'in-progress', version: 3 })],
    ['advanced version', workspace({ status: 'completed', version: 2 })],
    ['missing version', { ...workspace({ status: 'completed', version: 3 }), version: undefined }],
    ['non-finite version', workspace({ status: 'completed', version: Number.NaN })],
  ])('does not confirm a Workspace 2xx response with mismatched %s', async (_case, response) => {
    const item = workspaceWorkToHub(
      workspace({
        sourceSystem: 'DWP_WORKSPACE',
        capabilities: { canStart: true, canComplete: true },
      })
    );
    const result = await executeWorkHubAction(
      item,
      { kind: 'WORKSPACE_COMPLETE' },
      {
        ...workHubActionClients,
        getWorkspaceWorkQueue: vi.fn().mockResolvedValue({
          items: [item.legacyItem!],
          generatedAt: new Date().toISOString(),
          summary: { total: 1, completed: 0, dueSoon: 0, inProgress: 1, waiting: 0 },
        }),
        updateWorkspaceWorkStatus: vi.fn().mockResolvedValue(response),
      }
    );
    expect(result).toEqual({ state: 'UNAVAILABLE', retryable: true });
  });
  it('confirms only an exact access-review owner receipt', async () => {
    const detail = pendingAccessReview();
    const item = hubItem({
      reference: { sourceSystem: 'IDENTITY_GOVERNANCE', sourceReference: KEY },
      sourceStatus: 'PENDING',
      version: detail.version,
      actions: [{ kind: 'ACCESS_REVIEW_DECIDE', availability: 'DETAIL_REQUIRED' }],
    });

    await expect(
      executeWorkHubAction(
        item,
        {
          kind: 'ACCESS_REVIEW_DECIDE',
          decision: 'APPROVE',
          reason: '  Reviewed current evidence  ',
          expectedVersion: detail.version,
          authorize: vi.fn().mockResolvedValue(true),
        },
        {
          ...workHubActionClients,
          getAccessReviewWorkDetail: vi.fn().mockResolvedValue(detail),
          decideAccessReviewWork: vi.fn().mockResolvedValue(decidedAccessReview(detail)),
        }
      )
    ).resolves.toEqual({
      state: 'CONFIRMED',
      outcome: 'DECISION_RECORDED',
      sourceReference: KEY,
      version: 3,
      sourceStatus: 'APPROVE',
      remediationState: 'NOT_REQUIRED',
    });
  });
  it('rejects an access-review rationale above the Work five-hundred-character contract', async () => {
    const detail = pendingAccessReview();
    const decide = vi.fn();
    const result = await executeWorkHubAction(
      hubItem({
        reference: { sourceSystem: 'IDENTITY_GOVERNANCE', sourceReference: KEY },
        sourceStatus: 'PENDING',
        version: detail.version,
        actions: [{ kind: 'ACCESS_REVIEW_DECIDE', availability: 'DETAIL_REQUIRED' }],
      }),
      {
        kind: 'ACCESS_REVIEW_DECIDE',
        decision: 'APPROVE',
        reason: 'a'.repeat(501),
        expectedVersion: detail.version,
        authorize: vi.fn().mockResolvedValue(true),
      },
      { ...workHubActionClients, decideAccessReviewWork: decide }
    );

    expect(result).toEqual({ state: 'FORBIDDEN', retryable: false });
    expect(decide).not.toHaveBeenCalled();
  });
  it.each([
    ['source reference', { workItemRef: 'different' }],
    ['subject identity', { subjectUserId: 8 }],
    ['role identity', { roleId: 10 }],
    ['source identity', { accessSourceType: 'DIRECT' }],
    ['source key identity', { sourceKey: 'another-group' }],
    ['target decision', { decision: 'REVOKE' }],
    ['decision reason', { decisionReason: 'A different reason was returned.' }],
    ['non-advanced version', { version: 2 }],
    ['skipped version', { version: 4 }],
    ['missing version', { version: undefined }],
    ['non-finite version', { version: Number.POSITIVE_INFINITY }],
    ['remediation status', { remediationState: 'PENDING' }],
    ['missing decision time', { decidedAt: null }],
  ] as const)(
    'does not confirm an access-review 2xx response with mismatched %s',
    async (_case, responseOverride) => {
      const detail = pendingAccessReview();
      const item = hubItem({
        reference: { sourceSystem: 'IDENTITY_GOVERNANCE', sourceReference: KEY },
        sourceStatus: 'PENDING',
        version: detail.version,
        actions: [{ kind: 'ACCESS_REVIEW_DECIDE', availability: 'DETAIL_REQUIRED' }],
      });
      const result = await executeWorkHubAction(
        item,
        {
          kind: 'ACCESS_REVIEW_DECIDE',
          decision: 'APPROVE',
          reason: 'Reviewed current evidence',
          expectedVersion: detail.version,
          authorize: vi.fn().mockResolvedValue(true),
        },
        {
          ...workHubActionClients,
          getAccessReviewWorkDetail: vi.fn().mockResolvedValue(detail),
          decideAccessReviewWork: vi
            .fn()
            .mockResolvedValue(decidedAccessReview(detail, responseOverride)),
        }
      );
      expect(result).toEqual({ state: 'UNAVAILABLE', retryable: true });
    }
  );
  it.each([
    [409, { state: 'CONFLICT', retryable: true }],
    [403, { state: 'FORBIDDEN', retryable: false }],
    [503, { state: 'UNAVAILABLE', retryable: true }],
  ] as const)(
    'maps an owner HTTP %s without publishing a confirmed receipt',
    async (status, expected) => {
      const result = await executeWorkHubAction(
        hubItem(),
        { kind: 'PERSONAL_COMPLETE', idempotencyKey: KEY },
        {
          ...workHubActionClients,
          transitionPersonalWorkTask: vi
            .fn()
            .mockRejectedValue(new HttpError('Owner response', status)),
        }
      );
      expect(result).toEqual(expected);
    }
  );
  it('does not issue a Workspace mutation after the operation owner changes during revalidation', async () => {
    let finishRead!: (
      value: Awaited<ReturnType<typeof workHubActionClients.getWorkspaceWorkQueue>>
    ) => void;
    const read = new Promise<
      Awaited<ReturnType<typeof workHubActionClients.getWorkspaceWorkQueue>>
    >((resolve) => {
      finishRead = resolve;
    });
    const update = vi.fn();
    const item = workspaceWorkToHub(
      workspace({
        sourceSystem: 'DWP_WORKSPACE',
        capabilities: { canStart: true, canComplete: true },
      })
    );
    let sameOwner = true;
    const pending = executeWorkHubAction(
      item,
      { kind: 'WORKSPACE_COMPLETE' },
      {
        ...workHubActionClients,
        getWorkspaceWorkQueue: vi.fn().mockReturnValue(read),
        updateWorkspaceWorkStatus: update,
      },
      { canContinue: () => sameOwner }
    );
    sameOwner = false;
    finishRead({
      items: [item.legacyItem!],
      generatedAt: new Date().toISOString(),
      summary: { total: 1, completed: 0, dueSoon: 0, inProgress: 0, waiting: 0 },
    });
    await expect(pending).resolves.toEqual({ state: 'UNAVAILABLE', retryable: false });
    expect(update).not.toHaveBeenCalled();
  });
  it.each([
    ['another Work reference', { workItemRef: 'another-ref' }],
    ['missing subject', { subjectUserId: 0 }],
    ['invalid role', { roleId: Number.NaN }],
    ['missing group identity', { sourceKey: null }],
    ['invalid version', { version: Number.MAX_SAFE_INTEGER }],
  ] as const)(
    'does not send an access-review decision after fresh detail has %s',
    async (_case, overrides) => {
      const detail = pendingAccessReview();
      const decide = vi.fn();
      const result = await executeWorkHubAction(
        hubItem({
          reference: { sourceSystem: 'IDENTITY_GOVERNANCE', sourceReference: KEY },
          sourceStatus: 'PENDING',
          version: detail.version,
          actions: [{ kind: 'ACCESS_REVIEW_DECIDE', availability: 'DETAIL_REQUIRED' }],
        }),
        {
          kind: 'ACCESS_REVIEW_DECIDE',
          decision: 'APPROVE',
          reason: 'Reviewed current evidence',
          expectedVersion: detail.version,
          authorize: vi.fn().mockResolvedValue(true),
        },
        {
          ...workHubActionClients,
          getAccessReviewWorkDetail: vi.fn().mockResolvedValue({ ...detail, ...overrides }),
          decideAccessReviewWork: decide,
        }
      );
      expect(result.state).not.toBe('CONFIRMED');
      expect(decide).not.toHaveBeenCalled();
    }
  );
  it('source navigation never reports a source mutation', async () => {
    const item = hubItem({
      sourceRoute: '/services/requests/1',
      actions: [{ kind: 'OPEN_SOURCE', availability: 'AVAILABLE' }],
    });
    expect(await executeWorkHubAction(item, { kind: 'OPEN_SOURCE' })).toEqual({
      state: 'HANDED_OFF',
      route: '/services/requests/1',
      sourceChanged: false,
    });
  });
  it('hands source-owned work across the document boundary and rejects unsafe routes', () => {
    const assign = vi.fn();
    expect(openWorkHubSourceRoute('/approvals/inbox?task=a-1', assign)).toBe(true);
    expect(assign).toHaveBeenCalledWith('/approvals/inbox?task=a-1');
    expect(openWorkHubSourceRoute('//foreign.example/path', assign)).toBe(false);
    expect(openWorkHubSourceRoute('/services/requests/1\nX-Injected: yes', assign)).toBe(false);
    expect(assign).toHaveBeenCalledTimes(1);
  });
});
