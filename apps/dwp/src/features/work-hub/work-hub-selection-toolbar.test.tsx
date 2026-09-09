// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubSelectionToolbar } from './work-hub-selection-toolbar';

import type { ComponentProps } from 'react';
import type { Root } from 'react-dom/client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let host: HTMLDivElement;
let root: Root;

const defaults: ComponentProps<typeof WorkHubSelectionToolbar> = {
  count: 2,
  selecting: false,
  selectedCount: 0,
  eligibleCount: 0,
  pending: false,
  onToggleSelection: vi.fn(),
  onBatch: vi.fn(),
};

async function render(props: Partial<ComponentProps<typeof WorkHubSelectionToolbar>> = {}) {
  await act(async () => root.render(<WorkHubSelectionToolbar {...defaults} {...props} />));
}

function button(label: string) {
  return [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent?.trim() === label
  );
}

async function activateWithEnter(target: HTMLButtonElement) {
  target.focus();
  await act(async () => {
    const accepted = target.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    );
    if (accepted) target.click();
  });
}

describe('WorkHubSelectionToolbar outage controls', () => {
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

  it('blocks entering selection while commands are unavailable', async () => {
    const onToggleSelection = vi.fn();
    await render({ disabled: true, onToggleSelection });

    const select = button('workHub.batch.selectMode');
    expect(select?.disabled).toBe(true);
    await act(async () => select!.click());
    expect(onToggleSelection).not.toHaveBeenCalled();
  });

  it('cancels an existing selection with Escape through an outage and leaves dialog Escape to its owner', async () => {
    const onToggleSelection = vi.fn();
    await render({ disabled: true, selecting: true, onToggleSelection });
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    host.appendChild(dialog);
    await act(async () =>
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    );
    expect(onToggleSelection).not.toHaveBeenCalled();
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    );
    expect(onToggleSelection).toHaveBeenCalledOnce();
    dialog.remove();
  });

  it('keeps cancel selection keyboard-accessible while batch mutations remain disabled', async () => {
    const onToggleSelection = vi.fn();
    const onBatch = vi.fn();
    await render({
      disabled: true,
      selecting: true,
      selectedCount: 1,
      eligibleCount: 1,
      onToggleSelection,
      onBatch,
    });

    const cancel = button('workHub.batch.cancelSelection');
    expect(cancel?.tagName).toBe('BUTTON');
    expect(cancel?.disabled).toBe(false);
    expect(button('workHub.batch.start')?.disabled).toBe(true);
    expect(button('workHub.batch.complete')?.disabled).toBe(true);

    await activateWithEnter(cancel!);
    expect(document.activeElement).toBe(cancel);
    expect(onToggleSelection).toHaveBeenCalledTimes(1);
    expect(onBatch).not.toHaveBeenCalled();
  });
});
