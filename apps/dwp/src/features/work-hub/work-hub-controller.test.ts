import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import type {
  PersonalDayPlan,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import { createWorkHubController, workHubControllerClients } from './work-hub-controller';
import { hubItem, KEY, NOW, snapshot } from './work-hub.test-support';

const reference: WorkSourceReference = { sourceSystem: 'PERSONAL_TASK', sourceReference: KEY };
const selection: WorkSourceReference = {
  sourceSystem: 'DAY_PLAN_SELECTION',
  sourceReference: 'opaque-selection',
};
const concurrentReference: WorkSourceReference = {
  sourceSystem: 'PERSONAL_TASK',
  sourceReference: 'concurrent',
};
const concurrentSelection: WorkSourceReference = {
  sourceSystem: 'DAY_PLAN_SELECTION',
  sourceReference: 'opaque-concurrent',
};

function planItem(
  selectionReference: WorkSourceReference,
  sourceReference: WorkSourceReference,
  position: number
): PersonalDayPlan['items'][number] {
  return {
    position,
    selectionReference,
    source: {
      availability: 'AVAILABLE',
      reference: sourceReference,
      title: `Work ${position + 1}`,
      sourceRoute: '/work/queue',
      status: 'OPEN',
      dueAt: null,
    },
  };
}

function dayPlan(
  date = '2026-09-04',
  version = 2,
  items: PersonalDayPlan['items'] = [planItem(selection, reference, 0)]
): PersonalDayPlan {
  return {
    date,
    version,
    updatedAt: new Date(NOW).toISOString(),
    items,
  };
}
describe('Work Hub controller', () => {
  it('adopts a fresh query-cache snapshot before running a command after remount', async () => {
    const execute = vi.fn().mockResolvedValue({
      state: 'CONFIRMED',
      outcome: 'STATUS_CHANGED',
      sourceReference: KEY,
      sourceStatus: 'COMPLETED',
      version: 3,
    });
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      executeWorkHubAction: execute,
      loadWorkHub: vi
        .fn()
        .mockResolvedValue(snapshot([hubItem({ lifecycle: 'COMPLETED', version: 3 })])),
    });
    controller.adopt(snapshot());
    controller.select(reference);
    expect(
      (await controller.execute({ kind: 'PERSONAL_COMPLETE', idempotencyKey: KEY })).state
    ).toBe('CONFIRMED');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(controller.state().snapshot?.items[0].lifecycle).toBe('COMPLETED');
  });
  it('never optimistically completes a task after an unconfirmed command', async () => {
    const refresh = vi.fn();
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      executeWorkHubAction: vi.fn().mockResolvedValue({ state: 'UNAVAILABLE', retryable: true }),
      loadWorkHub: refresh,
    });
    controller.adopt(snapshot());
    controller.select(reference);
    await controller.execute({ kind: 'PERSONAL_COMPLETE', idempotencyKey: KEY });
    expect(controller.state().snapshot?.items[0].lifecycle).toBe('OPEN');
    expect(controller.state().selectedKey).toBe(hubItem().key);
    expect(refresh).not.toHaveBeenCalled();
  });
  it('deduplicates a canonical task against the saved opaque day-plan selection', async () => {
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      getPersonalDayPlan: vi.fn().mockResolvedValue(dayPlan()),
    });
    await controller.loadPlan('2026-09-04');
    expect(controller.addToPlan(reference)).toEqual([selection]);
    expect(controller.removePlanItem(reference)).toEqual([]);
    expect(controller.addToPlan(reference)).toEqual([selection]);
  });
  it('adopts the latest plan after conflict and blocks an unchanged stale draft retry', async () => {
    const initial = dayPlan();
    const latest = dayPlan('2026-09-04', 3, [
      planItem(selection, reference, 0),
      planItem(concurrentSelection, concurrentReference, 1),
    ]);
    const explicitlyReedited = [
      selection,
      concurrentSelection,
      {
        sourceSystem: 'PERSONAL_TASK',
        sourceReference: 'third',
      },
    ];
    const saved = dayPlan(
      '2026-09-04',
      4,
      explicitlyReedited.map((item, index) => planItem(item, item, index))
    );
    const replace = vi
      .fn()
      .mockRejectedValueOnce(new HttpError('changed', 409))
      .mockResolvedValueOnce(saved);
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      getPersonalDayPlan: vi.fn().mockResolvedValueOnce(initial).mockResolvedValueOnce(latest),
      replacePersonalDayPlan: replace,
    });
    await controller.loadPlan('2026-09-04');
    const staleDraft = [selection, { sourceSystem: 'PERSONAL_TASK', sourceReference: 'second' }];
    expect(await controller.savePlan('2026-09-04', staleDraft, KEY)).toEqual({
      state: 'CONFLICT',
      draft: [selection, concurrentSelection],
      submittedDraft: staleDraft,
      plan: latest,
    });
    expect(controller.state().plan?.version).toBe(3);
    expect(controller.state().planDraft).toEqual([selection, concurrentSelection]);
    expect(replace).toHaveBeenCalledWith('2026-09-04', { version: 2, items: staleDraft }, KEY);

    expect(await controller.savePlan('2026-09-04', staleDraft, 'retry-key')).toMatchObject({
      state: 'CONFLICT',
      draft: [selection, concurrentSelection],
    });
    expect(replace).toHaveBeenCalledTimes(1);

    expect(await controller.savePlan('2026-09-04', explicitlyReedited, 'new-edit-key')).toEqual({
      state: 'SAVED',
      plan: saved,
    });
    expect(replace).toHaveBeenLastCalledWith(
      '2026-09-04',
      { version: 3, items: explicitlyReedited },
      'new-edit-key'
    );
  });
  it('preserves unavailable selections when reordering a plan', async () => {
    const plan = dayPlan();
    plan.items[0].source = {
      availability: 'UNAVAILABLE',
      reference: null,
      title: null,
      sourceRoute: null,
      status: null,
      dueAt: null,
    };
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      getPersonalDayPlan: vi.fn().mockResolvedValue(plan),
    });
    await controller.loadPlan('2026-09-04');
    controller.addToPlan({ sourceSystem: 'PERSONAL_TASK', sourceReference: 'second' });
    expect(controller.movePlanItem(0, 1)).toEqual([
      { sourceSystem: 'PERSONAL_TASK', sourceReference: 'second' },
      selection,
    ]);
  });
  it('does not overwrite a newer snapshot when an earlier source read finishes late', async () => {
    let finishFirst!: (value: ReturnType<typeof snapshot>) => void;
    const first = new Promise<ReturnType<typeof snapshot>>((resolve) => {
      finishFirst = resolve;
    });
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      loadWorkHub: vi
        .fn()
        .mockReturnValueOnce(first)
        .mockResolvedValueOnce(snapshot([hubItem({ title: 'newer' })])),
    });
    const slow = controller.refresh();
    await controller.refresh();
    finishFirst(snapshot([hubItem({ title: 'older' })]));
    await slow;
    expect(controller.state().snapshot?.items[0].title).toBe('newer');
  });
  it('does not overwrite a newer plan when an earlier date load finishes late', async () => {
    let finishFirst!: (value: PersonalDayPlan) => void;
    const first = new Promise<PersonalDayPlan>((resolve) => {
      finishFirst = resolve;
    });
    const newer = dayPlan('2026-09-05', 7, [planItem(concurrentSelection, concurrentReference, 0)]);
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      getPersonalDayPlan: vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce(newer),
    });

    const slow = controller.loadPlan('2026-09-04');
    await controller.loadPlan('2026-09-05');
    finishFirst(dayPlan('2026-09-04'));
    await slow;

    expect(controller.state().plan).toEqual(newer);
    expect(controller.state().planDraft).toEqual([concurrentSelection]);
  });
  it('does not send a plan update when the requested date is not the loaded date', async () => {
    const replace = vi.fn();
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      getPersonalDayPlan: vi.fn().mockResolvedValue(dayPlan()),
      replacePersonalDayPlan: replace,
    });
    await controller.loadPlan('2026-09-04');

    expect(
      await controller.savePlan(
        '2026-09-05',
        [{ sourceSystem: 'PERSONAL_TASK', sourceReference: 'wrong-date' }],
        KEY
      )
    ).toEqual({ state: 'UNAVAILABLE', draft: [selection] });
    expect(replace).not.toHaveBeenCalled();
  });
});
