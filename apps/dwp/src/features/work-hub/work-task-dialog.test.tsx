// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkTaskDialog, validateWorkTaskDraft, workTaskSubmission } from './work-task-dialog';

import type { Root } from 'react-dom/client';
import type { ComponentProps } from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

let host: HTMLDivElement;
let root: Root;

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

function button(label: string) {
  const match = [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
  expect(match).toBeDefined();
  return match!;
}

async function render(props: Partial<ComponentProps<typeof WorkTaskDialog>> = {}) {
  const defaults: ComponentProps<typeof WorkTaskDialog> = {
    open: true,
    mode: 'create',
    initialValue: { title: 'Prepare customer note', priority: 'NORMAL' },
    onClose: vi.fn(),
    onSubmit: vi.fn(),
  };
  await act(async () => root.render(<WorkTaskDialog {...defaults} {...props} />));
  await settle();
  return { ...defaults, ...props };
}

describe('WorkTaskDialog', () => {
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

  it('validates the exact title and description boundaries', () => {
    expect(
      validateWorkTaskDraft({ title: '   ', description: '', priority: 'NORMAL', dueAt: null })
    ).toEqual({ title: 'required' });
    expect(
      validateWorkTaskDraft({
        title: 'x'.repeat(501),
        description: 'x'.repeat(10_001),
        priority: 'NORMAL',
        dueAt: null,
      })
    ).toEqual({ title: 'tooLong', description: 'tooLong' });
    expect(
      validateWorkTaskDraft({
        title: 'x'.repeat(500),
        description: 'x'.repeat(10_000),
        priority: 'URGENT',
        dueAt: null,
      })
    ).toEqual({});
  });

  it('preserves the initial source reference and edit version without rendering opaque ids', async () => {
    const sourceReference = {
      sourceSystem: 'MAIL_THREAD',
      sourceReference: 'private-thread-id',
      obligationKey: 'follow-up',
    };
    const onSubmit = vi.fn();
    await render({
      mode: 'edit',
      sourceLabel: 'Mail',
      initialValue: {
        title: 'Prepare customer note',
        description: 'Review first',
        priority: 'HIGH',
        dueAt: null,
        sourceReference,
        version: 4,
      },
      onSubmit,
    });

    await act(async () => button('workHub.taskForm.edit.submit').click());
    await settle();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ sourceReference, version: 4 }),
      expect.objectContaining({ idempotencyKey: expect.any(String) })
    );
    expect(document.body.textContent).not.toContain('private-thread-id');
    expect(document.body.textContent).not.toContain('follow-up');
  });

  it('announces a reference-only source without exposing opaque identifiers', async () => {
    await render({
      mode: 'edit',
      sourceLabel: null,
      initialValue: {
        title: 'Prepare customer note',
        priority: 'NORMAL',
        sourceReference: {
          sourceSystem: 'MAIL_THREAD',
          sourceReference: 'private-thread-id',
          obligationKey: 'follow-up',
        },
        version: 4,
      },
    });

    expect(document.body.textContent).toContain('workHub.taskForm.sourceLinkedReferenceOnly');
    expect(document.body.textContent).not.toContain('private-thread-id');
    expect(document.body.textContent).not.toContain('follow-up');
  });

  it('only emits clearSourceReference after an explicit unlink selection', async () => {
    const sourceReference = {
      sourceSystem: 'APPROVAL',
      sourceReference: 'opaque-approval-id',
    };
    const onSubmit = vi.fn();
    await render({
      mode: 'edit',
      initialValue: {
        title: 'Review approval',
        priority: 'HIGH',
        sourceReference,
        version: 7,
      },
      onSubmit,
    });

    const unlink = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    const descriptionId = unlink.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)).not.toBeNull();

    await act(async () => unlink.click());
    expect(document.body.textContent).toContain('workHub.taskForm.sourceUnlinkPending');
    await act(async () => button('workHub.taskForm.edit.submit').click());
    await settle();

    const submitted = onSubmit.mock.calls[0]?.[0];
    expect(submitted).toEqual(expect.objectContaining({ clearSourceReference: true, version: 7 }));
    expect(submitted).not.toHaveProperty('sourceReference');
  });

  it('treats unlink as a dirty, identity-changing edit intent', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('unknown outcome'));
    const onClose = vi.fn();
    await render({
      mode: 'edit',
      initialValue: {
        title: 'Review approval',
        priority: 'HIGH',
        sourceReference: {
          sourceSystem: 'APPROVAL',
          sourceReference: 'opaque-approval-id',
        },
        version: 7,
      },
      onClose,
      onSubmit,
    });

    await act(async () => button('workHub.taskForm.edit.submit').click());
    await settle();
    const firstKey = onSubmit.mock.calls[0]?.[1].idempotencyKey;

    const unlink = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => unlink.click());
    await act(async () => button('workHub.taskForm.edit.submit').click());
    await settle();

    expect(onSubmit.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ clearSourceReference: true })
    );
    expect(onSubmit.mock.calls[1]?.[1].idempotencyKey).not.toBe(firstKey);

    await act(async () => button('workHub.taskForm.cancel').click());
    await settle();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('workHub.taskForm.discard.title');
  });

  it('reuses the command identity after a failed identical submission and preserves input', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('unknown outcome'));
    await render({ onSubmit });

    await act(async () => button('workHub.taskForm.create.submit').click());
    await settle();
    expect(document.body.textContent).toContain('workHub.taskForm.errors.submitFailed');
    expect(document.querySelector<HTMLInputElement>('input[required]')?.value).toBe(
      'Prepare customer note'
    );

    await act(async () => button('workHub.taskForm.create.submit').click());
    await settle();
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onSubmit.mock.calls[1]?.[1]).toEqual(onSubmit.mock.calls[0]?.[1]);
    expect(onSubmit.mock.calls[1]?.[0]).toEqual(onSubmit.mock.calls[0]?.[0]);
  });

  it('requires confirmation before discarding a dirty draft', async () => {
    const onClose = vi.fn();
    await render({ onClose });
    const title = document.querySelector<HTMLInputElement>('input[required]')!;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    await act(async () => {
      valueSetter.call(title, 'Changed title');
      title.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await act(async () => button('workHub.taskForm.cancel').click());
    await settle();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('workHub.taskForm.discard.title');

    await act(async () => button('workHub.taskForm.discard.confirm').click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('prevents Enter from submitting while Korean IME composition is active', async () => {
    const onSubmit = vi.fn();
    await render({ onSubmit });
    const title = document.querySelector<HTMLInputElement>('input[required]')!;
    const event = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(event, 'isComposing', { value: true });

    await act(async () => title.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('moves focus to the title field when the full-screen capture dialog opens', async () => {
    await render({ initialValue: undefined });

    expect(document.activeElement).toBe(
      document.querySelector<HTMLInputElement>('input[required]')
    );
  });

  it('submits the create-only today-plan intent outside the task payload', async () => {
    const onSubmit = vi.fn();
    await render({ onSubmit });
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    await act(async () => checkbox.click());
    await act(async () => button('workHub.taskForm.create.submit').click());
    await settle();

    expect(onSubmit).toHaveBeenCalledWith(
      expect.not.objectContaining({ addToTodayPlan: expect.anything() }),
      expect.objectContaining({ addToTodayPlan: true, idempotencyKey: expect.any(String) })
    );
  });

  it('normalizes whitespace while retaining optional values in the submit model', () => {
    expect(
      workTaskSubmission(
        {
          title: '  Prepare note  ',
          description: '   ',
          priority: 'LOW',
          dueAt: '2026-09-04T05:00:00.000Z',
        },
        undefined
      )
    ).toEqual({
      title: 'Prepare note',
      description: null,
      priority: 'LOW',
      dueAt: '2026-09-04T05:00:00.000Z',
    });
  });

  it('keeps a linked source by default and replaces it with an explicit unlink command', () => {
    const draft = {
      title: 'Review approval',
      description: '',
      priority: 'HIGH' as const,
      dueAt: null,
    };
    const sourceReference = {
      sourceSystem: 'APPROVAL',
      sourceReference: 'opaque-approval-id',
    };
    const initial = { sourceReference, version: 7 };

    expect(workTaskSubmission(draft, initial)).toEqual(
      expect.objectContaining({ sourceReference, version: 7 })
    );
    expect(workTaskSubmission(draft, initial, true)).toEqual(
      expect.objectContaining({ clearSourceReference: true, version: 7 })
    );
    expect(workTaskSubmission(draft, initial, true)).not.toHaveProperty('sourceReference');
    expect(workTaskSubmission(draft, undefined, true)).not.toHaveProperty('clearSourceReference');
  });
});
