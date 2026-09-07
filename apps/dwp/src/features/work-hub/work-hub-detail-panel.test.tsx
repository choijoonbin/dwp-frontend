// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubDetailPanel } from './work-hub-detail-panel';
import { hubItem, NOW } from './work-hub.test-support';

import type { ComponentProps } from 'react';
import type { Root } from 'react-dom/client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let host: HTMLDivElement;
let root: Root;

const defaults: ComponentProps<typeof WorkHubDetailPanel> = {
  item: hubItem(),
  now: NOW,
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

  it('disables every detail command while the snapshot is not current', async () => {
    await render({
      commandsDisabled: true,
      canManagePlan: true,
      canSchedule: true,
      canAskAi: true,
      onOpenActivity: vi.fn(),
    });

    const buttons = [...host.querySelectorAll<HTMLButtonElement>('button')];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((candidate) => candidate.disabled)).toBe(true);
  });
});
