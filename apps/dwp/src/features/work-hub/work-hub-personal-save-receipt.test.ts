import { describe, expect, it } from 'vitest';
import type {
  PersonalDayPlan,
  PersonalWorkSource,
  PersonalWorkTask,
  PersonalWorkTaskInput,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';
import { personal } from './work-hub.test-support';
import {
  isPersonalDayPlanReceipt,
  isPersonalDayPlanSaveReceipt,
  isPersonalTaskCreateReceipt,
  isPersonalTaskConflictReceipt,
  isPersonalTaskEditReceipt,
} from './work-hub-personal-save-receipt';

const first: WorkSourceReference = {
  sourceSystem: 'APPROVAL',
  sourceReference: 'approval-1',
  obligationKey: null,
};
const second: WorkSourceReference = {
  sourceSystem: 'SERVICE',
  sourceReference: 'service-2',
  obligationKey: 'review',
};
const checklist = [
  { itemId: 'check-1', title: 'First', completed: false },
  { itemId: 'check-2', title: 'Second', completed: true },
];

function available(reference: WorkSourceReference): PersonalWorkSource {
  return {
    availability: 'AVAILABLE',
    reference,
    title: reference.sourceReference,
    sourceRoute: '/work/queue',
    status: 'OPEN',
    dueAt: null,
  };
}

function unavailable(): PersonalWorkSource {
  return {
    availability: 'UNAVAILABLE',
    reference: null,
    title: null,
    sourceRoute: null,
    status: null,
    dueAt: null,
  };
}

const createInput: PersonalWorkTaskInput = {
  title: 'Bound work',
  description: 'Exact description',
  priority: 'HIGH',
  dueAt: '2026-09-10T09:00:00Z',
  checklist,
  sourceReferences: [first, second],
};

function createdReceipt(overrides: Partial<PersonalWorkTask> = {}): PersonalWorkTask {
  return personal({
    title: createInput.title,
    description: createInput.description ?? null,
    priority: createInput.priority,
    dueAt: createInput.dueAt ?? null,
    source: available(first),
    sources: [available(first), available(second)],
    checklist,
    version: 0,
    ...overrides,
  });
}

describe('personal task save receipt binding', () => {
  it('accepts a structurally valid creation receipt with ordered submitted fields', () => {
    expect(isPersonalTaskCreateReceipt(createdReceipt(), createInput)).toBe(true);
  });

  it.each([
    ['blank id', { taskId: ' ' }],
    ['non-canonical id', { taskId: ` ${personal().taskId}` }],
    ['unsafe version', { version: Number.NaN }],
    ['fractional version', { version: 0.5 }],
    ['non-initial version', { version: 1 }],
    ['invalid created timestamp', { createdAt: 'yesterday' }],
    ['invalid updated timestamp', { updatedAt: '2026-09-08' }],
    ['different update timestamp', { updatedAt: '2026-09-04T09:00:01Z' }],
    ['unexpected completion timestamp', { completedAt: '2026-09-04T09:00:00Z' }],
    ['different title', { title: 'Other' }],
    ['different description', { description: null }],
    ['different priority', { priority: 'LOW' as const }],
    ['different due date', { dueAt: null }],
    ['different checklist order', { checklist: [...checklist].reverse() }],
    ['different source order', { sources: [available(second), available(first)] }],
    ['unexpected lifecycle', { status: 'IN_PROGRESS' as const }],
  ])('rejects a creation receipt with %s', (_label, overrides) => {
    expect(isPersonalTaskCreateReceipt(createdReceipt(overrides), createInput)).toBe(false);
  });

  it('distinguishes omitted nullable update fields from explicit empty replacements', () => {
    const retained = createdReceipt({ version: 3 });
    const reviewed = { ...retained, version: 2 };
    expect(
      isPersonalTaskEditReceipt(
        retained,
        retained.taskId,
        {
          title: retained.title,
          priority: retained.priority,
          version: 2,
          checklist: null,
          sourceReference: null,
          sourceReferences: null,
        },
        'OPEN',
        reviewed
      )
    ).toBe(true);
    expect(
      isPersonalTaskEditReceipt(
        retained,
        retained.taskId,
        {
          title: retained.title,
          priority: retained.priority,
          version: 2,
          checklist: [],
          sourceReferences: [],
        },
        'OPEN',
        reviewed
      )
    ).toBe(false);
    expect(
      isPersonalTaskEditReceipt(
        createdReceipt({ source: null, sources: [], checklist: [], version: 3 }),
        retained.taskId,
        {
          title: retained.title,
          priority: retained.priority,
          version: 2,
          checklist: [],
          sourceReferences: [],
        },
        'OPEN',
        reviewed
      )
    ).toBe(true);
  });

  it('accepts an update that preserves a source hidden by current access', () => {
    const retained = createdReceipt({
      source: unavailable(),
      sources: [unavailable()],
      version: 3,
    });

    expect(
      isPersonalTaskEditReceipt(
        retained,
        retained.taskId,
        {
          title: retained.title,
          description: retained.description,
          priority: retained.priority,
          dueAt: retained.dueAt,
          version: 2,
        },
        'OPEN',
        { ...retained, version: 2 }
      )
    ).toBe(true);
    expect(
      isPersonalTaskEditReceipt(
        retained,
        retained.taskId,
        {
          title: retained.title,
          priority: retained.priority,
          sourceReferences: [first],
          version: 2,
        },
        'OPEN',
        { ...retained, version: 2 }
      )
    ).toBe(false);
  });

  it('rejects source injection or removal when an edit omitted source changes', () => {
    const withoutSource = createdReceipt({ source: null, sources: [], version: 2 });
    const withSource = createdReceipt({ version: 2 });

    expect(
      isPersonalTaskEditReceipt(
        createdReceipt({ version: 3 }),
        withoutSource.taskId,
        {
          title: withoutSource.title,
          description: withoutSource.description,
          priority: withoutSource.priority,
          dueAt: withoutSource.dueAt,
          version: 2,
        },
        'OPEN',
        withoutSource
      )
    ).toBe(false);
    expect(
      isPersonalTaskEditReceipt(
        createdReceipt({ source: null, sources: [], version: 3 }),
        withSource.taskId,
        {
          title: withSource.title,
          description: withSource.description,
          priority: withSource.priority,
          dueAt: withSource.dueAt,
          version: 2,
        },
        'OPEN',
        withSource
      )
    ).toBe(false);
  });

  it.each([
    ['another task', createdReceipt({ taskId: 'a4444444-4444-4444-8444-444444444444' })],
    ['stale version', createdReceipt({ version: 2 })],
    ['skipped version', createdReceipt({ version: 4 })],
    ['non-finite version', createdReceipt({ version: Number.POSITIVE_INFINITY })],
    ['different status', createdReceipt({ version: 3, status: 'WAITING' })],
    ['different checklist', createdReceipt({ version: 3, checklist: [checklist[1]!] })],
    ['different creation time', createdReceipt({ version: 3, createdAt: '2026-09-04T09:00:01Z' })],
    ['older update time', createdReceipt({ version: 3, updatedAt: '2026-09-04T08:59:59Z' })],
    [
      'different completion time',
      createdReceipt({ version: 3, completedAt: '2026-09-04T09:00:00Z' }),
    ],
  ])('rejects an edit receipt with %s', (_label, receipt) => {
    expect(
      isPersonalTaskEditReceipt(
        receipt,
        personal().taskId,
        { ...createInput, version: 2 },
        'OPEN',
        createdReceipt({ version: 2 })
      )
    ).toBe(false);
  });

  it('accepts only the exact task and an advanced safe version for conflict recovery', () => {
    expect(
      isPersonalTaskConflictReceipt(createdReceipt({ version: 3 }), personal().taskId, 2)
    ).toBe(true);
    expect(
      isPersonalTaskConflictReceipt(
        createdReceipt({ taskId: 'a4444444-4444-4444-8444-444444444444', version: 3 }),
        personal().taskId,
        2
      )
    ).toBe(false);
    expect(
      isPersonalTaskConflictReceipt(createdReceipt({ version: 2 }), personal().taskId, 2)
    ).toBe(false);
    expect(
      isPersonalTaskConflictReceipt(createdReceipt({ version: Number.NaN }), personal().taskId, 2)
    ).toBe(false);
  });
});

function planItem(
  selectionReference: WorkSourceReference,
  source: PersonalWorkSource,
  position: number
): PersonalDayPlan['items'][number] {
  return { selectionReference, source, position };
}

function savedPlan(overrides: Partial<PersonalDayPlan> = {}): PersonalDayPlan {
  return {
    date: '2026-09-08',
    version: 3,
    updatedAt: '2026-09-08T10:00:00Z',
    items: [planItem(first, available(first), 0), planItem(second, available(second), 1)],
    ...overrides,
  };
}

describe('personal day-plan receipt binding', () => {
  it('accepts the requested order and supports opaque server selection references', () => {
    expect(isPersonalDayPlanSaveReceipt(savedPlan(), '2026-09-08', 2, [first, second])).toBe(true);
    const opaque = { sourceSystem: 'DAY_PLAN_SELECTION', sourceReference: 'opaque-1' };
    expect(
      isPersonalDayPlanSaveReceipt(
        savedPlan({ items: [planItem(opaque, available(first), 0)] }),
        '2026-09-08',
        2,
        [opaque]
      )
    ).toBe(true);
  });

  it('accepts an opaque selection reorder while its source identity remains unavailable', () => {
    const hiddenSelection = {
      sourceSystem: 'DAY_PLAN_SELECTION',
      sourceReference: 'opaque-hidden',
    };
    const visibleSelection = {
      sourceSystem: 'DAY_PLAN_SELECTION',
      sourceReference: 'opaque-visible',
    };
    const base = savedPlan({
      version: 2,
      items: [
        planItem(hiddenSelection, unavailable(), 0),
        planItem(visibleSelection, available(second), 1),
      ],
    });
    const receipt = savedPlan({
      items: [
        planItem(visibleSelection, available(second), 0),
        planItem(hiddenSelection, unavailable(), 1),
      ],
    });

    expect(
      isPersonalDayPlanSaveReceipt(
        receipt,
        '2026-09-08',
        2,
        [visibleSelection, hiddenSelection],
        base
      )
    ).toBe(true);
  });

  it('rejects an opaque selection whose source availability changes on only one side', () => {
    const hiddenSelection = {
      sourceSystem: 'DAY_PLAN_SELECTION',
      sourceReference: 'opaque-hidden',
    };
    const hiddenBase = savedPlan({
      version: 2,
      items: [planItem(hiddenSelection, unavailable(), 0)],
    });
    const visibleBase = savedPlan({
      version: 2,
      items: [planItem(hiddenSelection, available(first), 0)],
    });

    expect(
      isPersonalDayPlanSaveReceipt(
        savedPlan({ items: [planItem(hiddenSelection, available(first), 0)] }),
        '2026-09-08',
        2,
        [hiddenSelection],
        hiddenBase
      )
    ).toBe(false);
    expect(
      isPersonalDayPlanSaveReceipt(
        savedPlan({ items: [planItem(hiddenSelection, unavailable(), 0)] }),
        '2026-09-08',
        2,
        [hiddenSelection],
        visibleBase
      )
    ).toBe(false);
  });

  it.each([
    ['another date', savedPlan({ date: '2026-09-09' })],
    ['missing version', { ...savedPlan(), version: undefined }],
    ['non-finite version', savedPlan({ version: Number.NaN })],
    ['non-advanced version', savedPlan({ version: 2 })],
    ['skipped version', savedPlan({ version: 4 })],
    ['invalid timestamp', savedPlan({ updatedAt: 'invalid' })],
    ['different order', savedPlan({ items: [...savedPlan().items].reverse() })],
    [
      'different source item',
      savedPlan({
        items: [
          planItem(first, available(first), 0),
          planItem(second, available({ ...second, sourceReference: 'other' }), 1),
        ],
      }),
    ],
  ])('rejects a save receipt with %s', (_label, receipt) => {
    expect(isPersonalDayPlanSaveReceipt(receipt, '2026-09-08', 2, [first, second])).toBe(false);
  });

  it('accepts the first timestamped save from the server initial empty plan with no update time', () => {
    const base = savedPlan({ version: 0, items: [], updatedAt: null });
    const receipt = savedPlan({ version: 1 });
    expect(isPersonalDayPlanSaveReceipt(receipt, base.date, 0, [first, second], base)).toBe(true);
    expect(isPersonalDayPlanSaveReceipt({ ...receipt, items: [] }, base.date, 0, [], base)).toBe(
      true
    );
  });

  it.each([
    ['a persisted plan without its update time', savedPlan({ version: 2, updatedAt: null }), 2],
    [
      'a nonempty initial plan without its update time',
      savedPlan({ version: 0, updatedAt: null }),
      0,
    ],
    [
      'an initial plan for another date',
      savedPlan({ date: '2026-09-09', version: 0, items: [], updatedAt: null }),
      0,
    ],
    [
      'an initial plan used with another base version',
      savedPlan({ version: 0, items: [], updatedAt: null }),
      2,
    ],
    [
      'a malformed baseline update time',
      savedPlan({ version: 0, items: [], updatedAt: 'invalid' }),
      0,
    ],
  ] as const)(
    'rejects %s instead of treating it as an initial null baseline',
    (_label, base, version) => {
      expect(
        isPersonalDayPlanSaveReceipt(
          savedPlan({ version: version + 1 }),
          '2026-09-08',
          version,
          [first, second],
          base
        )
      ).toBe(false);
    }
  );

  it.each([null, 'invalid', '2026-09-08'])(
    'requires a complete save timestamp even for the first write: %s',
    (updatedAt) => {
      const base = savedPlan({ version: 0, items: [], updatedAt: null });
      expect(
        isPersonalDayPlanSaveReceipt(
          savedPlan({ version: 1, updatedAt }),
          base.date,
          0,
          [first, second],
          base
        )
      ).toBe(false);
    }
  );

  it('rejects a direct save receipt whose timestamp regresses from its base plan', () => {
    const base = savedPlan({ version: 2, updatedAt: '2026-09-08T10:00:00Z' });
    const receipt = savedPlan({ version: 3, updatedAt: '2026-09-08T09:59:59Z' });

    expect(isPersonalDayPlanSaveReceipt(receipt, '2026-09-08', 2, [first, second], base)).toBe(
      false
    );
  });

  it('requires a valid advanced receipt before conflict reconciliation can adopt it', () => {
    expect(isPersonalDayPlanReceipt(savedPlan(), '2026-09-08', 2)).toBe(true);
    expect(isPersonalDayPlanReceipt(savedPlan({ version: 2 }), '2026-09-08', 2)).toBe(false);
  });
});
