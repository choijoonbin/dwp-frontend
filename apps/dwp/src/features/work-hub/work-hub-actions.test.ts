import { describe, expect, it, vi } from 'vitest';
import {
  executeWorkHubAction,
  openWorkHubSourceRoute,
  workHubActionClients,
} from './work-hub-actions';
import { hubItem, KEY, personal, workspace } from './work-hub.test-support';
import { workspaceWorkToHub } from './work-hub-source-adapters';

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
  it('hands source-owned work across the document boundary and rejects unsafe routes', () => {
    const assign = vi.fn();
    expect(openWorkHubSourceRoute('/approvals/inbox?task=a-1', assign)).toBe(true);
    expect(assign).toHaveBeenCalledWith('/approvals/inbox?task=a-1');
    expect(openWorkHubSourceRoute('//foreign.example/path', assign)).toBe(false);
    expect(openWorkHubSourceRoute('/services/requests/1\nX-Injected: yes', assign)).toBe(false);
    expect(assign).toHaveBeenCalledTimes(1);
  });
});
