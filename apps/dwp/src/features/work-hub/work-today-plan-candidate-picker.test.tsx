// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkTodayPlanCandidatePicker } from './work-today-plan-candidate-picker';
import { hubItem } from './work-hub.test-support';
import type { ComponentProps } from 'react';
import type { Root } from 'react-dom/client';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@mui/material/useMediaQuery', () => ({ default: () => true }));

const first = hubItem({ key: 'first', title: 'First task', dueAt: null });
const second = hubItem({ key: 'second', title: 'Second task', dueAt: null });
let host: HTMLDivElement;
let root: Root;

function button(label: string) {
  const result = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) =>
      candidate.textContent?.trim() === label || candidate.getAttribute('aria-label') === label
  );
  expect(result).toBeDefined();
  return result!;
}
function checkbox(index: number) {
  return [...document.querySelectorAll<HTMLInputElement>('[role="dialog"] input[type="checkbox"]')][
    index
  ]!;
}
async function finishDialogTransition() {
  await act(async () => new Promise((resolve) => setTimeout(resolve, 300)));
}
async function render(props: Partial<ComponentProps<typeof WorkTodayPlanCandidatePicker>> = {}) {
  const defaults: ComponentProps<typeof WorkTodayPlanCandidatePicker> = {
    candidates: [first, second],
    context: {
      date: '2026-09-08',
      timeZone: 'Asia/Seoul',
      now: Date.parse('2026-09-08T01:00:00Z'),
    },
    planCount: 1,
    availablePlanCount: 1,
    remaining: 100,
    disabled: false,
    headingId: 'candidates',
    registerEntry: vi.fn(),
    registerCandidate: () => vi.fn(),
    onAdd: vi.fn(),
    onAddedFocus: vi.fn(),
  };
  await act(async () => root.render(<WorkTodayPlanCandidatePicker {...defaults} {...props} />));
  return { ...defaults, ...props };
}

describe('mobile today plan candidate picker', () => {
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

  it('stages multiple selections and changes only the plan draft after explicit addition', async () => {
    const props = await render();
    await act(async () => button('workHub.todayPlan.openCandidatePicker').click());
    await act(async () => checkbox(0).click());
    await act(async () => checkbox(1).click());
    expect(props.onAdd).not.toHaveBeenCalled();
    await act(async () => button('workHub.todayPlan.addSelectedCandidates').click());
    expect(props.onAdd).toHaveBeenCalledExactlyOnceWith([first, second], 1);
    await finishDialogTransition();
    expect(props.onAddedFocus).toHaveBeenCalledExactlyOnceWith(first.key);
  });

  it('focuses search after entry and restores the opener after cancellation', async () => {
    await render();
    const opener = button('workHub.todayPlan.openCandidatePicker');
    await act(async () => opener.focus());
    expect(document.activeElement).toBe(opener);

    await act(async () => opener.click());
    await finishDialogTransition();
    const search = document.querySelector<HTMLInputElement>('[role="dialog"] input[type="text"]')!;
    expect(document.activeElement).toBe(search);

    await act(async () => button('workHub.todayPlan.cancelCandidatePicker').click());
    await finishDialogTransition();
    expect(document.activeElement).toBe(opener);
  });

  it('cancels staged selections without changing the plan', async () => {
    const props = await render();
    await act(async () => button('workHub.todayPlan.openCandidatePicker').click());
    await act(async () => checkbox(0).click());
    await act(async () => button('workHub.todayPlan.cancelCandidatePicker').click());
    expect(props.onAdd).not.toHaveBeenCalled();
    await act(async () => button('workHub.todayPlan.openCandidatePicker').click());
    expect(checkbox(0).checked).toBe(false);
  });

  it('revalidates selection against latest candidates and the remaining plan capacity', async () => {
    const props = await render({ remaining: 1 });
    await act(async () => button('workHub.todayPlan.openCandidatePicker').click());
    await act(async () => checkbox(0).click());
    expect(checkbox(1).disabled).toBe(true);
    await render({ ...props, candidates: [second] });
    expect(button('workHub.todayPlan.addSelectedCandidates').disabled).toBe(true);
    expect(checkbox(0).disabled).toBe(false);
    expect(props.onAdd).not.toHaveBeenCalled();
  });

  it('keeps search readable while all plan mutations are disabled', async () => {
    const props = await render({ disabled: true });
    await act(async () => button('workHub.todayPlan.openCandidatePicker').click());
    expect(checkbox(0).disabled).toBe(true);
    expect(button('workHub.todayPlan.addSelectedCandidates').disabled).toBe(true);
    expect(
      document.querySelector<HTMLInputElement>('[role="dialog"] input[type="text"]')?.disabled
    ).toBe(false);
    await act(async () => button('workHub.todayPlan.addSelectedCandidates').click());
    expect(props.onAdd).not.toHaveBeenCalled();
  });
});
