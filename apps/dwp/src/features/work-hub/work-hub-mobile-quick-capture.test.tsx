// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubMobileQuickCapture } from './work-hub-mobile-quick-capture';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let host: HTMLDivElement;
let root: Root;

function button(label: string) {
  const match = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  expect(match).toBeDefined();
  return match!;
}

function checkbox(label: string) {
  const match = [...document.querySelectorAll<HTMLLabelElement>('label')].find((candidate) =>
    candidate.textContent?.includes(label)
  );
  expect(match).toBeDefined();
  return match!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

describe('WorkHubMobileQuickCapture', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.body.replaceChildren();
  });

  it('submits a real 500-character-bounded task with independent plan and schedule intents', async () => {
    const onSubmit = vi.fn();
    await act(async () =>
      root.render(
        <WorkHubMobileQuickCapture canScheduleAfterCreate onCancel={vi.fn()} onSubmit={onSubmit} />
      )
    );
    const title = document.querySelector<HTMLInputElement>('input[required]')!;
    const progress = document.querySelector<HTMLOListElement>(
      'ol[aria-label="workHub.taskForm.quickFlow.label"]'
    );
    expect(title.maxLength).toBe(500);
    expect(progress?.querySelector('[aria-current="step"]')?.textContent).toContain(
      'workHub.taskForm.quickFlow.steps.queue'
    );
    expect(checkbox('workHub.taskForm.addToTodayPlan').checked).toBe(true);
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      title.focus();
      setValue.call(title, '  Prepare the close report  ');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(progress?.querySelector('[aria-current="step"]')?.textContent).toContain(
      'workHub.taskForm.quickFlow.steps.add'
    );
    await act(async () => title.blur());
    expect(progress?.querySelector('[aria-current="step"]')?.textContent).toContain(
      'workHub.taskForm.quickFlow.steps.plan'
    );
    await act(async () => button('workHub.taskForm.quickCapture.save').click());
    await settle();

    expect(onSubmit).toHaveBeenCalledWith(
      {
        title: 'Prepare the close report',
        description: null,
        priority: 'NORMAL',
        dueAt: null,
      },
      expect.objectContaining({
        idempotencyKey: expect.any(String),
        addToTodayPlan: true,
        scheduleAfterCreate: true,
      })
    );
  });

  it('blocks Korean IME confirmation and reuses the same identity after an unknown result', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('unknown result'));
    await act(async () =>
      root.render(
        <WorkHubMobileQuickCapture canScheduleAfterCreate onCancel={vi.fn()} onSubmit={onSubmit} />
      )
    );
    const title = document.querySelector<HTMLInputElement>('input[required]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      setValue.call(title, '고객 안내 초안 정리');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const ime = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    Object.defineProperty(ime, 'isComposing', { value: true });
    await act(async () => title.dispatchEvent(ime));
    expect(ime.defaultPrevented).toBe(true);
    const safariIme = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(safariIme, 'keyCode', { value: 229 });
    await act(async () => title.dispatchEvent(safariIme));
    expect(safariIme.defaultPrevented).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();

    await act(async () => button('workHub.taskForm.quickCapture.save').click());
    await settle();
    await act(async () => button('workHub.taskForm.quickCapture.save').click());
    await settle();
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit.mock.calls[1]?.[1].idempotencyKey).toBe(
      onSubmit.mock.calls[0]?.[1].idempotencyKey
    );
    expect(title.value).toBe('고객 안내 초안 정리');
  });

  it('keeps the Calendar follow-up read-only and unavailable without verified capability', async () => {
    await act(async () =>
      root.render(
        <WorkHubMobileQuickCapture
          canScheduleAfterCreate={false}
          onCancel={vi.fn()}
          onSubmit={vi.fn()}
        />
      )
    );

    expect(document.querySelectorAll('input[type="checkbox"]')).toHaveLength(1);
    const status = document.querySelector(
      '[role="status"][aria-label="workHub.taskForm.scheduleAfterCreate"]'
    );
    expect(status?.textContent).toContain('workHub.taskForm.scheduleAfterCreateUnavailable');
    expect(status?.textContent).toContain('workHub.taskForm.scheduleAfterCreateUnavailableShort');
  });
});
