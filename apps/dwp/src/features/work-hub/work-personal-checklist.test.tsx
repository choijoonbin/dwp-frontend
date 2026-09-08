// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkPersonalChecklist } from './work-personal-checklist';
import type {
  PersonalWorkChecklistItem,
  PersonalWorkTask,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const original = {
  taskId: 'task',
  version: 4,
  checklist: [{ itemId: 'one', title: 'Review source material', completed: false }],
} as PersonalWorkTask;
const concurrent = {
  ...original,
  version: 5,
  checklist: [
    ...original.checklist!,
    { itemId: 'two', title: 'A concurrent step', completed: false },
  ],
};
let host: HTMLDivElement;
let root: Root;
const button = (name: string) =>
  [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => element.textContent === name
  )!;

describe('personal checklist optimistic concurrency', () => {
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
  async function render(
    task: PersonalWorkTask,
    save: (next: PersonalWorkChecklistItem[], version: number) => Promise<void>
  ) {
    await act(async () =>
      root.render(<WorkPersonalChecklist task={task} disabled={false} onSave={save} />)
    );
  }
  async function toggle() {
    await act(async () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
  }

  it('keeps progress at the confirmed value until a saved task version arrives', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await render(original, save);
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
    await toggle();
    expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
    expect(host.textContent).toContain('workHub.checklist.unsavedProgress');
    await act(async () => button('workHub.checklist.save').click());
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
    await render(
      { ...original, version: 5, checklist: [{ ...original.checklist![0], completed: true }] },
      save
    );
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('100');
    expect(host.textContent).not.toContain('workHub.checklist.unsavedProgress');
  });

  it('does not claim complete progress when saving the completed draft fails', async () => {
    await render(original, vi.fn().mockRejectedValue(new Error('transport unavailable')));
    await toggle();
    await act(async () => button('workHub.checklist.save').click());
    expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
    expect(host.textContent).toContain('workHub.checklist.unsavedProgress');
  });

  it('does not silently promote a dirty v4 draft to the refreshed v5 version', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await render(original, save);
    await toggle();
    await render(concurrent, save);
    expect(host.textContent).toContain('A concurrent step');
    expect(host.textContent).toContain('workHub.checklist.conflict');
    expect(button('workHub.checklist.save').disabled).toBe(true);
    await act(async () => button('workHub.checklist.save').click());
    expect(save).not.toHaveBeenCalled();
    await act(async () => button('workHub.checklist.replaceLatest').click());
    expect(save).not.toHaveBeenCalled();
    await act(async () => button('workHub.checklist.save').click());
    expect(save).toHaveBeenCalledWith([{ ...original.checklist![0], completed: true }], 5);
  });

  it('lets the user adopt the latest list without writing or losing concurrent steps', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await render(original, save);
    await toggle();
    await render(concurrent, save);
    await act(async () => button('workHub.checklist.useLatest').click());
    expect(host.querySelectorAll('input[type="checkbox"]')).toHaveLength(2);
    expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(false);
    expect(button('workHub.checklist.save')).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });

  it('requires a fresh review if another update arrives after an explicit replacement choice', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    await render(original, save);
    await toggle();
    await render(concurrent, save);
    await act(async () => button('workHub.checklist.replaceLatest').click());
    expect(button('workHub.checklist.save').disabled).toBe(false);
    await render({ ...concurrent, version: 6 }, save);
    expect(button('workHub.checklist.save').disabled).toBe(true);
    await act(async () => button('workHub.checklist.save').click());
    expect(save).not.toHaveBeenCalled();
  });

  it('saves against the version captured when editing started and preserves failed input', async () => {
    const save = vi.fn().mockRejectedValue(new Error('conflict'));
    await render(original, save);
    await toggle();
    await act(async () => button('workHub.checklist.save').click());
    expect(save).toHaveBeenCalledWith([{ ...original.checklist![0], completed: true }], 4);
    expect(host.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked).toBe(true);
    await render(concurrent, save);
    expect(button('workHub.checklist.save').disabled).toBe(true);
  });
});
