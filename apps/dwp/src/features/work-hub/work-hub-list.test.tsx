// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubList } from './work-hub-list';
import { hubItem, NOW } from './work-hub.test-support';

import type { Root } from 'react-dom/client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let host: HTMLDivElement;
let root: Root;

describe('WorkHubList', () => {
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

  it('exposes a stable opener and omits urgency for terminal work', async () => {
    const onOpen = vi.fn();
    const item = hubItem({ lifecycle: 'ARCHIVED', dueAt: '2026-09-05T09:00:00Z' });
    await act(async () =>
      root.render(
        <WorkHubList
          items={[item]}
          selectedKey={null}
          checkedKeys={new Set()}
          now={NOW}
          canCheck={() => false}
          onCheck={vi.fn()}
          onOpen={onOpen}
        />
      )
    );

    expect(host.textContent).toContain('workHub.lifecycle.ARCHIVED');
    expect(host.textContent).not.toContain('workHub.urgency.SCHEDULED');
    const opener = host.querySelector<HTMLButtonElement>('[data-work-open]')!;
    const focusToken = opener.closest('li')!.dataset.workKey!;
    expect(focusToken).toMatch(/^work-row-[a-z0-9]+-[a-z0-9]+$/u);
    expect(focusToken).not.toContain(item.key);
    await act(async () => opener.focus());
    expect(document.activeElement).toBe(opener);

    await act(async () => opener.click());
    expect(onOpen).toHaveBeenCalledWith(item, focusToken);
    expect(document.activeElement).toBe(opener);

    const primaryMouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      button: 0,
      cancelable: true,
    });
    await act(async () => opener.dispatchEvent(primaryMouseDown));
    expect(primaryMouseDown.defaultPrevented).toBe(true);

    const secondaryMouseDown = new MouseEvent('mousedown', {
      bubbles: true,
      button: 2,
      cancelable: true,
    });
    await act(async () => opener.dispatchEvent(secondaryMouseDown));
    expect(secondaryMouseDown.defaultPrevented).toBe(false);
  });

  it('keeps assignment identity opaque and omits generic Work controls', async () => {
    const assignmentId = '11111111-2222-4333-8444-555555555555';
    const sourceReference = 'meeting-secret-reference';
    const item = hubItem({
      key: `WORK_ASSIGNMENT:${assignmentId}:`,
      reference: {
        sourceSystem: 'WORK_ASSIGNMENT',
        sourceReference: assignmentId,
      },
      sourceId: 'work-assignments',
      displayId: undefined,
      title: 'Prepare the reviewed follow-up',
      summary: 'Confirmed assignment terms',
      lifecycle: 'OPEN',
      sourceStatus: 'OPEN',
      originSystem: 'MEETING_FOLLOWUP',
      actions: [{ kind: 'PERSONAL_START', availability: 'AVAILABLE' }],
      sourceContext: {
        kind: 'WORK_ASSIGNMENT',
        assignmentState: 'PENDING',
        workState: 'OPEN',
        requesterIsMe: false,
        assigneeIsMe: true,
        sourceAvailability: 'NOT_REQUESTED',
      },
    });
    const onOpen = vi.fn();
    const onSchedule = vi.fn();
    const onTogglePlan = vi.fn();
    const onAction = vi.fn();

    await act(async () =>
      root.render(
        <WorkHubList
          items={[item]}
          selectedKey={null}
          checkedKeys={new Set()}
          now={NOW}
          canCheck={() => true}
          onCheck={vi.fn()}
          onOpen={onOpen}
          onSchedule={onSchedule}
          inTodayPlan={() => true}
          onTogglePlan={onTogglePlan}
          onAction={onAction}
          selectionMode={false}
        />
      )
    );

    expect(host.textContent).toContain('workHub.assignment.listAssignmentState');
    expect(host.textContent).toContain('workHub.assignment.listSourceReviewNotice');
    expect(host.textContent).toContain('workHub.lifecycle.OPEN');
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();
    expect(host.textContent).not.toContain('workHub.actions.PERSONAL_START');
    expect(host.textContent).not.toContain('workHub.actions.addToPlan');
    expect(host.textContent).not.toContain('workHub.actions.scheduleNamed');
    expect(host.innerHTML).not.toContain(assignmentId);
    expect(host.innerHTML).not.toContain(sourceReference);
    const focusToken = host.querySelector('li')!.dataset.workKey!;
    expect(focusToken).toMatch(/^work-row-[a-z0-9]+-[a-z0-9]+$/u);
    expect(focusToken).not.toContain(assignmentId);

    await act(async () =>
      root.render(
        <WorkHubList
          items={[item]}
          selectedKey={null}
          checkedKeys={new Set()}
          now={NOW}
          canCheck={() => true}
          onCheck={vi.fn()}
          onOpen={onOpen}
          onSchedule={onSchedule}
          inTodayPlan={() => true}
          onTogglePlan={onTogglePlan}
          onAction={onAction}
          selectionMode
        />
      )
    );
    expect(host.querySelector('input[type="checkbox"]')).toBeNull();

    await act(async () =>
      root.render(
        <WorkHubList
          items={[hubItem({ key: 'another-work-row' }), item]}
          selectedKey={null}
          checkedKeys={new Set()}
          now={NOW}
          canCheck={() => true}
          onCheck={vi.fn()}
          onOpen={onOpen}
          onSchedule={onSchedule}
          inTodayPlan={() => true}
          onTogglePlan={onTogglePlan}
          onAction={onAction}
          selectionMode
        />
      )
    );
    const opener = [...host.querySelectorAll<HTMLButtonElement>('[data-work-open]')].find(
      (candidate) => candidate.textContent?.includes(item.title)
    )!;
    expect(opener.closest('li')?.dataset.workKey).toBe(focusToken);
    await act(async () => opener.click());
    expect(onOpen).toHaveBeenCalledWith(item, focusToken);
    expect(onSchedule).not.toHaveBeenCalled();
    expect(onTogglePlan).not.toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
  });
});
