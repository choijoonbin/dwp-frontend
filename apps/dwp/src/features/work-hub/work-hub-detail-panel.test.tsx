// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubDetailPanel } from './work-hub-detail-panel';
import { hubItem, NOW } from './work-hub.test-support';

import type { ComponentProps } from 'react';
import type { Root } from 'react-dom/client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { date?: string }) =>
      options?.date === undefined ? key : `${key}:${options.date}`,
  }),
}));

vi.mock('@dwp-frontend/shared-i18n', () => ({
  formatDate: (value: string) => `formatted:${value}`,
}));

let host: HTMLDivElement;
let root: Root;

const defaults: ComponentProps<typeof WorkHubDetailPanel> = {
  item: hubItem(),
  now: NOW,
  verifiedAt: '2026-09-04T02:00:00Z',
  mobile: false,
  inTodayPlan: false,
  canManagePlan: false,
  canSchedule: false,
  canAskAi: false,
  onBack: vi.fn(),
  onAction: vi.fn(),
  onTogglePlan: vi.fn(),
  onSchedule: vi.fn(),
  onAskAi: vi.fn(),
};

async function render(props: Partial<ComponentProps<typeof WorkHubDetailPanel>> = {}) {
  await act(async () => root.render(<WorkHubDetailPanel {...defaults} {...props} />));
}

function activityButton() {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === 'workHub.actions.OPEN_ACTIVITY'
  );
}

function button(label: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}

describe('WorkHubDetailPanel Activity handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('does not imply Activity access when no authorized handoff was supplied', async () => {
    await render();
    expect(activityButton()).toBeUndefined();
  });

  it('offers a separate read-only Activity handoff when the caller authorized it', async () => {
    const onOpenActivity = vi.fn();
    await render({ onOpenActivity });

    const button = activityButton();
    expect(button).toBeDefined();
    await act(async () => button!.click());
    expect(onOpenActivity).toHaveBeenCalledTimes(1);
    expect(defaults.onAction).not.toHaveBeenCalled();
  });

  it('focuses the detail heading after a mobile list-to-detail transition', async () => {
    await render({ mobile: true });
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

    expect(document.activeElement).toBe(host.querySelector('h2'));
  });

  it('keeps a terminal due date without showing a contradictory urgency chip', async () => {
    await render({
      item: hubItem({ lifecycle: 'COMPLETED', dueAt: '2026-09-05T09:00:00Z' }),
    });

    expect(host.textContent).toContain('workHub.lifecycle.COMPLETED');
    expect(host.textContent).not.toContain('workHub.urgency.SCHEDULED');
  });

  it('shows the source verification receipt instead of the item modification time', async () => {
    await render({
      item: hubItem({ updatedAt: '2026-09-03T01:00:00Z' }),
      verifiedAt: '2026-09-04T02:00:00Z',
    });

    expect(host.textContent).toContain('workHub.detail.verifiedAt:formatted:2026-09-04T02:00:00Z');
    expect(host.textContent).not.toContain('formatted:2026-09-03T01:00:00Z');
  });

  it('keeps read-only source handoffs available while stale-state commands stay disabled', async () => {
    const onAction = vi.fn();
    const onOpenActivity = vi.fn();
    await render({
      item: hubItem({
        actions: [
          { kind: 'PERSONAL_COMPLETE', availability: 'AVAILABLE' },
          { kind: 'OPEN_SOURCE', availability: 'AVAILABLE' },
        ],
      }),
      commandsDisabled: true,
      canManagePlan: true,
      canSchedule: true,
      canAskAi: true,
      onAction,
      onOpenActivity,
    });

    const source = button('workHub.actions.OPEN_SOURCE');
    const activity = button('workHub.actions.OPEN_ACTIVITY');
    expect(source?.disabled).toBe(false);
    expect(activity?.disabled).toBe(false);

    for (const label of [
      'workHub.actions.PERSONAL_COMPLETE',
      'workHub.actions.addToPlan',
      'workHub.actions.schedule',
      'workHub.actions.askAi',
    ]) {
      expect(button(label)?.disabled).toBe(true);
    }

    await act(async () => source!.click());
    await act(async () => activity!.click());
    expect(onAction).toHaveBeenCalledWith('OPEN_SOURCE');
    expect(onOpenActivity).toHaveBeenCalledTimes(1);
  });

  it('keeps assignment identity out of generic detail actions and DOM metadata', async () => {
    const assignmentId = '11111111-2222-4333-8444-555555555555';
    const assignment = hubItem({
      key: `WORK_ASSIGNMENT:${assignmentId}:`,
      reference: { sourceSystem: 'WORK_ASSIGNMENT', sourceReference: assignmentId },
      sourceId: 'work-assignments',
      title: 'Reviewed assignment',
      lifecycle: 'OPEN',
      sourceStatus: 'OPEN',
      actions: [
        { kind: 'OPEN_SOURCE', availability: 'AVAILABLE' },
        { kind: 'PERSONAL_START', availability: 'AVAILABLE' },
      ],
      sourceContext: {
        kind: 'WORK_ASSIGNMENT',
        assignmentState: 'PENDING',
        workState: 'OPEN',
        requesterIsMe: false,
        assigneeIsMe: true,
        sourceAvailability: 'NOT_REQUESTED',
      },
    });

    await render({
      item: assignment,
      canManagePlan: true,
      canSchedule: true,
      canAskAi: true,
      onOpenActivity: vi.fn(),
      specializedContent: <div>safe assignment detail</div>,
    });

    for (const label of [
      'workHub.actions.OPEN_SOURCE',
      'workHub.actions.OPEN_ACTIVITY',
      'workHub.actions.PERSONAL_START',
      'workHub.actions.addToPlan',
      'workHub.actions.schedule',
      'workHub.actions.askAi',
    ]) {
      expect(button(label)).toBeUndefined();
    }
    expect(host.innerHTML).not.toContain(assignmentId);
    expect(host.querySelector('[data-work-source-trigger]')).toBeNull();
    expect(host.querySelector('[data-work-activity-trigger]')).toBeNull();
    expect(host.querySelector('[data-work-item-key]')).toBeNull();
    expect(host.textContent).toContain('workHub.detail.assignmentOwnerNotice');
    expect(host.textContent).not.toContain('workHub.detail.sourceOwnerNotice');
  });
});
