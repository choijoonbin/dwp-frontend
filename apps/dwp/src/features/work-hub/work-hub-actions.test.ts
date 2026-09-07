import { describe, expect, it, vi } from 'vitest';
import { executeWorkHubAction, workHubActionClients } from './work-hub-actions';
import { hubItem, KEY, personal, workspace } from './work-hub.test-support';
import { workspaceWorkToHub } from './work-hub-source-adapters';
import type { ApprovalMutationExecution } from '@dwp-frontend/shared-utils/api/approval-governed-mutation';

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
  it('passes the exact governed approval authority to the source API', async () => {
    const execution = { mode: 'legacy' } as unknown as ApprovalMutationExecution;
    const detail = {
      task: { taskId: 'a-1', stepKey: 'review', version: 2, status: 'PENDING' },
      canDecide: true,
      selfApprovalBlocked: false,
    };
    const decide = vi
      .fn()
      .mockResolvedValue({ ...detail, task: { ...detail.task, version: 3, status: 'APPROVED' } });
    const item = hubItem({
      reference: { sourceSystem: 'APPROVAL_TASK', sourceReference: 'a-1', obligationKey: 'review' },
      actions: [{ kind: 'APPROVAL_DECIDE', availability: 'DETAIL_REQUIRED' }],
    });
    const result = await executeWorkHubAction(
      item,
      { kind: 'APPROVAL_DECIDE', decision: 'APPROVE', execution },
      {
        ...workHubActionClients,
        getApprovalTask: vi.fn().mockResolvedValue(detail),
        decideApprovalTask: decide,
      }
    );
    expect(decide).toHaveBeenCalledWith(
      'a-1',
      { decision: 'APPROVE', comment: undefined, expectedVersion: 2 },
      execution
    );
    expect(result).toMatchObject({
      state: 'CONFIRMED',
      outcome: 'DECISION_RECORDED',
      sourceStatus: 'APPROVED',
    });
  });
  it('blocks stale approval detail before issuing a command', async () => {
    const decide = vi.fn();
    const item = hubItem({
      reference: { sourceSystem: 'APPROVAL_TASK', sourceReference: 'a-1', obligationKey: 'review' },
      actions: [{ kind: 'APPROVAL_DECIDE', availability: 'DETAIL_REQUIRED' }],
    });
    const result = await executeWorkHubAction(
      item,
      { kind: 'APPROVAL_DECIDE', decision: 'APPROVE', execution: {} as ApprovalMutationExecution },
      {
        ...workHubActionClients,
        getApprovalTask: vi.fn().mockResolvedValue({ task: { version: 3 } }),
        decideApprovalTask: decide,
      }
    );
    expect(result.state).toBe('CONFLICT');
    expect(decide).not.toHaveBeenCalled();
  });
  it('replays a personal command with the original version and identity after uncertain transport', async () => {
    const transition = vi
      .fn()
      .mockRejectedValueOnce(new Error('lost response'))
      .mockResolvedValueOnce(personal({ version: 3, status: 'COMPLETED' }));
    const api = { ...workHubActionClients, transitionPersonalWorkTask: transition };
    const command = { kind: 'PERSONAL_COMPLETE' as const, idempotencyKey: KEY };
    expect((await executeWorkHubAction(hubItem(), command, api)).state).toBe('UNAVAILABLE');
    expect((await executeWorkHubAction(hubItem(), command, api)).state).toBe('CONFIRMED');
    expect(transition.mock.calls[0]).toEqual(transition.mock.calls[1]);
    expect(transition.mock.calls[1]).toEqual([KEY, 'complete', { version: 2 }, KEY]);
  });
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
});
