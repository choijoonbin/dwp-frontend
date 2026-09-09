import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils/http-error';
import type {
  PersonalDayPlan,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import { createWorkHubController, workHubControllerClients } from './work-hub-controller';
import { hubItem, KEY, NOW, personal, snapshot } from './work-hub.test-support';

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
  it('accepts only an exact creation receipt and does not issue a duplicate aggregate refresh', async () => {
    const input = {
      title: 'Created task',
      description: 'Bound body',
      priority: 'HIGH' as const,
      dueAt: '2026-09-10T09:00:00Z',
      checklist: [{ itemId: 'check-1', title: 'Review', completed: false }],
    };
    const receipt = personal({
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueAt: input.dueAt,
      checklist: input.checklist,
      source: null,
      sources: [],
      version: 0,
    });
    const reload = vi.fn();
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      createPersonalWorkTask: vi.fn().mockResolvedValue(receipt),
      loadWorkHub: reload,
    });

    await expect(controller.capture(input, KEY)).resolves.toEqual(receipt);
    expect(controller.state().selectedKey).toBe(`PERSONAL_TASK:${receipt.taskId}:`);
    expect(reload).not.toHaveBeenCalled();
  });

  it.each([
    ['blank task id', { taskId: ' ' }],
    ['unrelated task id', { taskId: 'task-from-another-contract' }],
    ['non-finite version', { version: Number.NaN }],
    ['missing timestamp', { updatedAt: undefined }],
    ['mismatched title', { title: 'Unrelated title' }],
  ])('fails a malformed creation receipt closed: %s', async (_label, overrides) => {
    const input = { title: 'Created task', description: null, priority: 'NORMAL' as const };
    const receipt = personal({ title: input.title, version: 0, ...overrides });
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      createPersonalWorkTask: vi.fn().mockResolvedValue(receipt),
      loadWorkHub: vi.fn(),
    });

    await expect(controller.capture(input, KEY)).rejects.toThrow(
      'Unverified personal task creation receipt'
    );
    expect(controller.state().selectedKey).toBeNull();
  });

  it('accepts only an exact advanced edit receipt without a private aggregate refresh', async () => {
    const input = {
      title: 'Updated task',
      description: null,
      priority: 'URGENT' as const,
      dueAt: null,
      version: 2,
    };
    const receipt = personal({
      title: input.title,
      description: input.description,
      priority: input.priority,
      dueAt: input.dueAt,
      version: 3,
    });
    const reload = vi.fn();
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      updatePersonalWorkTask: vi.fn().mockResolvedValue(receipt),
      loadWorkHub: reload,
    });
    controller.adopt(snapshot());
    controller.select(reference);

    await expect(
      controller.savePersonalTask(input, KEY, { reviewedTask: personal() })
    ).resolves.toEqual(receipt);
    expect(reload).not.toHaveBeenCalled();
  });

  it('binds edit status to the reviewed detail when the aggregate row is stale', async () => {
    const receipt = personal({ status: 'WAITING', title: 'Updated after review', version: 8 });
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      updatePersonalWorkTask: vi.fn().mockResolvedValue(receipt),
    });
    controller.adopt(snapshot());
    controller.select(reference);

    await expect(
      controller.savePersonalTask(
        {
          title: receipt.title,
          description: receipt.description,
          priority: receipt.priority,
          dueAt: receipt.dueAt,
          version: 7,
        },
        KEY,
        { expectedStatus: 'WAITING', reviewedTask: { ...receipt, version: 7 } }
      )
    ).resolves.toEqual(receipt);
  });

  it.each([
    ['another task', personal({ taskId: 'a4444444-4444-4444-8444-444444444444', version: 3 })],
    ['stale version', personal({ version: 2 })],
    ['non-finite version', personal({ version: Number.POSITIVE_INFINITY })],
    ['mismatched title', personal({ title: 'Unrelated', version: 3 })],
  ])('fails a malformed edit receipt closed: %s', async (_label, receipt) => {
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      updatePersonalWorkTask: vi.fn().mockResolvedValue(receipt),
      loadWorkHub: vi.fn(),
    });
    controller.adopt(snapshot());
    controller.select(reference);

    await expect(
      controller.savePersonalTask(
        {
          title: 'Prepare brief',
          description: null,
          priority: 'NORMAL',
          dueAt: null,
          version: 2,
        },
        KEY,
        { reviewedTask: personal() }
      )
    ).rejects.toThrow('Unverified personal task update receipt');
  });

  it('adopts a fresh query-cache snapshot before running a command after remount', async () => {
    const execute = vi.fn().mockResolvedValue({
      state: 'CONFIRMED',
      outcome: 'STATUS_CHANGED',
      sourceReference: KEY,
      sourceStatus: 'COMPLETED',
      version: 3,
    });
    const reload = vi
      .fn()
      .mockResolvedValue(snapshot([hubItem({ lifecycle: 'COMPLETED', version: 3 })]));
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      executeWorkHubAction: execute,
      loadWorkHub: reload,
    });
    controller.adopt(snapshot());
    controller.select(reference);
    expect(
      (await controller.execute({ kind: 'PERSONAL_COMPLETE', idempotencyKey: KEY })).state
    ).toBe('CONFIRMED');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    expect(controller.state().snapshot?.items[0].lifecycle).toBe('OPEN');
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
  it('does not dispatch a command from rows retained during an aggregate outage', async () => {
    const execute = vi.fn();
    const retained = snapshot();
    retained.completeness = 'UNAVAILABLE';
    retained.sources = [
      { ...retained.sources[0]!, state: 'UNAVAILABLE', items: [], receivedAt: null },
    ];
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      executeWorkHubAction: execute,
    });
    controller.adopt(retained);
    controller.select(reference);

    await expect(
      controller.execute({ kind: 'PERSONAL_COMPLETE', idempotencyKey: KEY })
    ).resolves.toEqual({ state: 'UNAVAILABLE', retryable: false });
    expect(execute).not.toHaveBeenCalled();
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
      explicitlyReedited.map((item, index) =>
        planItem(
          item,
          latest.items.find(
            (candidate) => candidate.selectionReference.sourceReference === item.sourceReference
          )?.source.reference ?? item,
          index
        )
      )
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
    expect(replace).toHaveBeenCalledWith(
      '2026-09-04',
      { version: 2, items: staleDraft },
      KEY,
      undefined
    );

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
      'new-edit-key',
      undefined
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

  it.each([
    ['another date', dayPlan('2026-09-05', 3)],
    ['missing version', { ...dayPlan('2026-09-04', 3), version: undefined }],
    ['non-finite version', dayPlan('2026-09-04', Number.NaN)],
    ['non-advanced version', dayPlan('2026-09-04', 2)],
    [
      'different ordered item',
      dayPlan('2026-09-04', 3, [
        planItem(selection, concurrentReference, 0),
        planItem(concurrentSelection, reference, 1),
      ]),
    ],
    ['invalid update timestamp', { ...dayPlan('2026-09-04', 3), updatedAt: 'invalid' }],
  ])(
    'does not adopt or report SAVED for a malformed day-plan receipt: %s',
    async (_label, saved) => {
      const initial = dayPlan();
      const submitted = [selection, concurrentSelection];
      const controller = createWorkHubController(['personal'], {
        ...workHubControllerClients,
        getPersonalDayPlan: vi.fn().mockResolvedValue(initial),
        replacePersonalDayPlan: vi.fn().mockResolvedValue(saved),
      });
      await controller.loadPlan('2026-09-04');

      await expect(controller.savePlan('2026-09-04', submitted, KEY)).resolves.toEqual({
        state: 'UNAVAILABLE',
        draft: submitted,
      });
      expect(controller.state().plan).toBe(initial);
      expect(controller.state().planDraft).toEqual(submitted);
    }
  );

  it('passes plan cancellation to the API and never adopts a late valid receipt', async () => {
    let finish!: (value: PersonalDayPlan) => void;
    const replacement = vi.fn(
      () =>
        new Promise<PersonalDayPlan>((resolve) => {
          finish = resolve;
        })
    );
    const initial = dayPlan();
    const controller = createWorkHubController(['personal'], {
      ...workHubControllerClients,
      getPersonalDayPlan: vi.fn().mockResolvedValue(initial),
      replacePersonalDayPlan: replacement,
    });
    await controller.loadPlan('2026-09-04');
    const abort = new AbortController();
    const pending = controller.savePlan('2026-09-04', [selection], KEY, {
      signal: abort.signal,
      canContinue: () => !abort.signal.aborted,
    });
    expect(replacement).toHaveBeenCalledWith(
      '2026-09-04',
      { version: 2, items: [selection] },
      KEY,
      abort.signal
    );
    abort.abort();
    finish(dayPlan('2026-09-04', 3));

    await expect(pending).resolves.toEqual({ state: 'UNAVAILABLE', draft: [selection] });
    expect(controller.state().plan).toBe(initial);
  });
});
