import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import { canRetryWorkHubBatchReceipt, executeWorkHubBatch } from './work-hub-batch-execution';
import { hubItem, personal, workspace } from './work-hub.test-support';

describe('source-confirmed mixed batch execution', () => {
  it('keeps confirmed, conflicting and policy-excluded items distinct', async () => {
    const first = hubItem();
    const second = hubItem({
      key: 'second',
      reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'second' },
    });
    const approval = hubItem({
      key: 'approval',
      reference: { sourceSystem: 'APPROVAL_TASK', sourceReference: 'approval' },
      sourceRoute: '/approvals/inbox?task=approval',
      actions: [{ kind: 'OPEN_SOURCE', availability: 'AVAILABLE' }],
    });
    const clients = {
      transitionPersonalWorkTask: vi
        .fn()
        .mockResolvedValueOnce(personal({ status: 'COMPLETED', version: 3 }))
        .mockRejectedValueOnce(new HttpError('Changed', 409)),
      updateWorkspaceWorkStatuses: vi.fn(),
    };
    const receipts = await executeWorkHubBatch('COMPLETED', [first, second, approval], [], clients);
    expect(receipts.map((receipt) => receipt.state)).toEqual(['CONFIRMED', 'CONFLICT', 'EXCLUDED']);
    expect(clients.transitionPersonalWorkTask).toHaveBeenCalledTimes(2);
    expect(clients.updateWorkspaceWorkStatuses).not.toHaveBeenCalled();
  });
  it('rechecks only an unconfirmed personal command using its original version and key', async () => {
    const item = hubItem();
    const clients = {
      transitionPersonalWorkTask: vi
        .fn()
        .mockRejectedValueOnce(new Error('Response lost'))
        .mockResolvedValueOnce(personal({ status: 'COMPLETED', version: 3 })),
      updateWorkspaceWorkStatuses: vi.fn(),
    };
    const first = await executeWorkHubBatch('COMPLETED', [item], [], clients);
    expect(first[0].state).toBe('UNKNOWN');
    const second = await executeWorkHubBatch('COMPLETED', [item], first, clients);
    expect(second[0].state).toBe('CONFIRMED');
    expect(clients.transitionPersonalWorkTask.mock.calls[1]).toEqual(
      clients.transitionPersonalWorkTask.mock.calls[0]
    );
    await executeWorkHubBatch('COMPLETED', [item], second, clients);
    expect(clients.transitionPersonalWorkTask).toHaveBeenCalledTimes(2);
  });
  it('does not mistake a receipt for a different item or an unchanged version for success', async () => {
    const item = hubItem();
    const clients = {
      transitionPersonalWorkTask: vi
        .fn()
        .mockResolvedValue(personal({ taskId: 'different', status: 'COMPLETED', version: 3 })),
      updateWorkspaceWorkStatuses: vi.fn(),
    };
    expect((await executeWorkHubBatch('COMPLETED', [item], [], clients))[0].state).toBe('UNKNOWN');
    clients.transitionPersonalWorkTask.mockResolvedValue(
      personal({ status: 'COMPLETED', version: item.version })
    );
    expect((await executeWorkHubBatch('COMPLETED', [item], [], clients))[0].state).toBe('UNKNOWN');
  });
  it('rejects oversized batches before sending any source commands', async () => {
    const clients = { transitionPersonalWorkTask: vi.fn(), updateWorkspaceWorkStatuses: vi.fn() };
    await expect(
      executeWorkHubBatch(
        'COMPLETED',
        Array.from({ length: 51 }, () => hubItem()),
        [],
        clients
      )
    ).rejects.toThrow();
    expect(clients.transitionPersonalWorkTask).not.toHaveBeenCalled();
  });
  it('cancels every unsent item before any personal or workspace source call', async () => {
    const controller = new AbortController();
    controller.abort();
    const clients = { transitionPersonalWorkTask: vi.fn(), updateWorkspaceWorkStatuses: vi.fn() };
    const items = [
      hubItem(),
      hubItem({
        key: 'work',
        reference: { sourceSystem: 'WORKSPACE', sourceReference: 'work' },
        legacyItem: workspace({
          sourceSystem: 'WORKSPACE',
          capabilities: { canStart: false, canComplete: true },
        }),
      }),
    ];
    const receipts = await executeWorkHubBatch('COMPLETED', items, [], clients, {
      signal: controller.signal,
    });
    expect(receipts.map(({ state, reason }) => ({ state, reason }))).toEqual([
      { state: 'EXCLUDED', reason: 'CANCELLED' },
      { state: 'EXCLUDED', reason: 'CANCELLED' },
    ]);
    expect(clients.transitionPersonalWorkTask).not.toHaveBeenCalled();
    expect(clients.updateWorkspaceWorkStatuses).not.toHaveBeenCalled();
  });
  it('keeps confirmed evidence but stops queued workspace and subsequent personal commands when the owner changes', async () => {
    let sameOwner = true;
    const clients = {
      transitionPersonalWorkTask: vi.fn().mockImplementation(async () => {
        sameOwner = false;
        return personal({ status: 'COMPLETED', version: 3 });
      }),
      updateWorkspaceWorkStatuses: vi.fn(),
    };
    const queued = hubItem({
      key: 'work',
      reference: { sourceSystem: 'WORKSPACE', sourceReference: 'work' },
      legacyItem: workspace({
        sourceSystem: 'WORKSPACE',
        capabilities: { canStart: false, canComplete: true },
      }),
    });
    const later = hubItem({
      key: 'later',
      reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: 'later' },
    });
    const receipts = await executeWorkHubBatch(
      'COMPLETED',
      [queued, hubItem(), later],
      [],
      clients,
      { canContinue: () => sameOwner }
    );
    expect(receipts.map(({ state }) => state)).toEqual(['EXCLUDED', 'CONFIRMED', 'EXCLUDED']);
    expect(receipts[0].reason).toBe('CANCELLED');
    expect(receipts[2].reason).toBe('CANCELLED');
    expect(clients.transitionPersonalWorkTask).toHaveBeenCalledTimes(1);
    expect(clients.updateWorkspaceWorkStatuses).not.toHaveBeenCalled();
  });
  it('marks an aborted in-flight request unknown and never replays that cancelled intent', async () => {
    const controller = new AbortController();
    const clients = {
      transitionPersonalWorkTask: vi.fn().mockImplementation(async () => {
        controller.abort();
        throw new Error('Response was interrupted');
      }),
      updateWorkspaceWorkStatuses: vi.fn(),
    };
    const item = hubItem();
    const receipts = await executeWorkHubBatch('COMPLETED', [item], [], clients, {
      signal: controller.signal,
    });
    expect(receipts[0]).toMatchObject({ state: 'UNKNOWN', reason: 'CANCELLED' });
    expect(canRetryWorkHubBatchReceipt(receipts[0])).toBe(false);
    await executeWorkHubBatch('COMPLETED', [item], receipts, clients);
    expect(clients.transitionPersonalWorkTask).toHaveBeenCalledTimes(1);
    expect(clients.transitionPersonalWorkTask.mock.calls[0][4]).toBe(controller.signal);
  });
});
