// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WorkTodayPlanPanel,
  workTodayPlanCandidates,
  workTodayPlanRows,
} from './work-today-plan-panel';

import type { Root } from 'react-dom/client';
import type { ComponentProps } from 'react';
import type { WorkHubItem } from './work-hub-contracts';
import type { WorkSourceReference } from '@dwp-frontend/shared-utils/api/personal-work-contracts';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const firstReference = { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-1' };
const secondReference = { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-2' };
const opaqueReference = { sourceSystem: 'DAY_PLAN_SELECTION', sourceReference: 'opaque-token' };

function item(
  key: string,
  reference: WorkSourceReference,
  lifecycle: WorkHubItem['lifecycle'] = 'OPEN'
): WorkHubItem {
  return {
    key,
    reference,
    sourceId: 'personal',
    title: `Title ${key}`,
    summary: null,
    lifecycle,
    sourceStatus: lifecycle,
    originSystem: 'DWP',
    priority: 'NORMAL',
    dueAt: null,
    waitingFor: 'ME',
    sourceRoute: null,
    version: 1,
    updatedAt: null,
    reason: null,
    dataClassification: null,
    actions: [],
  };
}

const first = item('PERSONAL_TASK:task-1:', firstReference);
const second = item('PERSONAL_TASK:task-2:', secondReference);
const completed = item(
  'PERSONAL_TASK:task-3:',
  { sourceSystem: 'PERSONAL_TASK', sourceReference: 'task-3' },
  'COMPLETED'
);

let host: HTMLDivElement;
let root: Root;

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function button(label: string) {
  const match = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) =>
      candidate.textContent?.trim() === label || candidate.getAttribute('aria-label') === label
  );
  expect(match).toBeDefined();
  return match!;
}

async function render(props: Partial<ComponentProps<typeof WorkTodayPlanPanel>> = {}) {
  const defaults: ComponentProps<typeof WorkTodayPlanPanel> = {
    items: [first, second, completed],
    draft: [firstReference],
    date: '2026-09-04',
    onDraftChange: vi.fn(),
    onSave: vi.fn(),
  };
  await act(async () => root.render(<WorkTodayPlanPanel {...defaults} {...props} />));
  return { ...defaults, ...props };
}

describe('WorkTodayPlanPanel', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('keeps inaccessible selections opaque and in their saved order', () => {
    const rows = workTodayPlanRows([first], [opaqueReference, firstReference]);
    expect(rows.map((row) => row.item?.title ?? null)).toEqual([null, first.title]);
    expect(rows[0]?.reference).toBe(opaqueReference);
  });

  it('excludes selected and terminal work from add candidates', () => {
    expect(workTodayPlanCandidates([first, second, completed], [firstReference])).toEqual([second]);
  });

  it('allows an opaque selection to move and be removed without exposing its token', async () => {
    const onDraftChange = vi.fn();
    await render({ draft: [opaqueReference, firstReference], onDraftChange });

    expect(document.body.textContent).not.toContain('opaque-token');
    await act(async () => button('workHub.todayPlan.moveDown').click());
    expect(onDraftChange).toHaveBeenLastCalledWith([firstReference, opaqueReference]);

    await act(async () => button('workHub.todayPlan.remove').click());
    expect(onDraftChange).toHaveBeenLastCalledWith([firstReference]);
  });

  it('adds only the canonical reference and never changes lifecycle or due fields', async () => {
    const onDraftChange = vi.fn();
    await render({ onDraftChange });
    await act(async () => button('workHub.todayPlan.add').click());
    expect(onDraftChange).toHaveBeenCalledWith([firstReference, secondReference]);
    expect(second.lifecycle).toBe('OPEN');
    expect(second.dueAt).toBeNull();
  });

  it('reuses the same idempotency key when saving an unchanged draft after failure', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('unknown outcome'));
    await render({ onSave });

    await act(async () => button('workHub.todayPlan.save').click());
    await settle();
    expect(document.body.textContent).toContain('workHub.todayPlan.saveFailed');
    await act(async () => button('workHub.todayPlan.save').click());
    await settle();

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[1]).toEqual(onSave.mock.calls[0]);
  });

  it('uses a new idempotency key for a new save after the prior save succeeded', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    await render({ onSave });

    await act(async () => button('workHub.todayPlan.save').click());
    await settle();
    await act(async () => button('workHub.todayPlan.save').click());
    await settle();

    expect(onSave).toHaveBeenCalledTimes(2);
    expect(onSave.mock.calls[0]?.[0]).toEqual(onSave.mock.calls[1]?.[0]);
    expect(onSave.mock.calls[0]?.[1].idempotencyKey).not.toBe(
      onSave.mock.calls[1]?.[1].idempotencyKey
    );
  });

  it('enforces the 100-item cap and disables candidate addition', async () => {
    const fullDraft = Array.from({ length: 100 }, (_, index) => ({
      sourceSystem: 'PERSONAL_TASK',
      sourceReference: `selected-${index}`,
    }));
    await render({ items: [second], draft: fullDraft });
    expect(document.body.textContent).toContain('workHub.todayPlan.limitReached');
    expect(button('workHub.todayPlan.add').disabled).toBe(true);
  });

  it('blocks every plan mutation while the panel is disabled', async () => {
    const onDraftChange = vi.fn();
    const onSave = vi.fn();
    await render({
      draft: [firstReference, opaqueReference],
      disabled: true,
      onDraftChange,
      onSave,
    });

    expect(button('workHub.todayPlan.moveDown').disabled).toBe(true);
    expect(button('workHub.todayPlan.remove').disabled).toBe(true);
    expect(button('workHub.todayPlan.add').disabled).toBe(true);
    expect(button('workHub.todayPlan.save').disabled).toBe(true);

    await act(async () => button('workHub.todayPlan.save').click());
    expect(onDraftChange).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
