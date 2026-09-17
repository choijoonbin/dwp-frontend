import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FormDialog } from './form-dialog';

import type { Root } from 'react-dom/client';

let container: HTMLDivElement;
let opener: HTMLButtonElement;
let root: Root;
let openDeferredDialog: () => void;
const originalMatchMedia = window.matchMedia;

function setPointerEnvironment(compact: boolean, coarsePointer = false, reducedMotion = false) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches:
        (compact && query === '(max-width:599.95px)') ||
        (coarsePointer && query === '(pointer: coarse)') ||
        (reducedMotion && query === '(prefers-reduced-motion: reduce)'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function DialogHarness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <FormDialog
      open={open}
      title="Review home conflict"
      cancelLabel="Keep editing"
      submitLabel="Reapply my draft"
      secondaryActions={<button type="button">Reload latest</button>}
      onClose={() => {
        onClose();
        setOpen(false);
      }}
      onSubmit={() => undefined}
    >
      <p>Review the latest version before continuing.</p>
    </FormDialog>
  );
}

function DeferredDialogHarness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);
  openDeferredDialog = () => setOpen(true);
  return (
    <FormDialog
      open={open}
      title="Review home conflict"
      cancelLabel="Keep editing"
      submitLabel="Reapply my draft"
      onClose={() => {
        onClose();
        setOpen(false);
      }}
      onSubmit={() => undefined}
    >
      <p>Review the latest version before continuing.</p>
    </FormDialog>
  );
}

async function renderDialog(onClose = () => undefined) {
  await act(async () => {
    root.render(<DialogHarness onClose={onClose} />);
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
  const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
  expect(dialog).not.toBeNull();
  return dialog!;
}

describe('FormDialog keyboard contract', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    opener = document.createElement('button');
    opener.textContent = 'Open dialog';
    document.body.appendChild(opener);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    openDeferredDialog = () => undefined;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    opener.remove();
    container.remove();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: originalMatchMedia,
    });
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('provides 44px mobile footer targets without changing desktop density', async () => {
    setPointerEnvironment(true);
    const mobileDialog = await renderDialog();
    const mobileCancel = Array.from(
      mobileDialog.querySelectorAll<HTMLButtonElement>('button')
    ).find((button) => button.textContent === 'Keep editing');
    const mobileSecondary = Array.from(
      mobileDialog.querySelectorAll<HTMLButtonElement>('button')
    ).find((button) => button.textContent === 'Reload latest');
    const mobileSubmit = mobileDialog.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(mobileCancel).toBeDefined();
    expect(mobileSecondary).toBeDefined();
    expect(mobileSubmit).not.toBeNull();
    expect(getComputedStyle(mobileSecondary!).minHeight).toBe('44px');
    expect(getComputedStyle(mobileSecondary!).minWidth).toBe('44px');
    expect(getComputedStyle(mobileCancel!).minHeight).toBe('44px');
    expect(getComputedStyle(mobileCancel!).minWidth).toBe('44px');
    expect(getComputedStyle(mobileSubmit!).minHeight).toBe('44px');
    expect(getComputedStyle(mobileSubmit!).minWidth).toBe('44px');

    await act(async () => root.unmount());
    root = createRoot(container);
    setPointerEnvironment(false, true);
    const coarseDialog = await renderDialog();
    for (const action of coarseDialog.querySelectorAll<HTMLButtonElement>('button')) {
      expect(getComputedStyle(action).minHeight).toBe('44px');
      expect(getComputedStyle(action).minWidth).toBe('44px');
    }

    await act(async () => root.unmount());
    root = createRoot(container);
    setPointerEnvironment(false);
    const desktopDialog = await renderDialog();
    const desktopSecondary = Array.from(
      desktopDialog.querySelectorAll<HTMLButtonElement>('button')
    ).find((button) => button.textContent === 'Reload latest');
    const desktopSubmit = desktopDialog.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(desktopSecondary).toBeDefined();
    expect(desktopSubmit).not.toBeNull();
    expect(getComputedStyle(desktopSecondary!).minHeight).not.toBe('44px');
    expect(getComputedStyle(desktopSubmit!).minHeight).not.toBe('44px');
  });

  it('makes the scroll region keyboard reachable before the ordered actions', async () => {
    const dialog = await renderDialog();
    const content = dialog.querySelector<HTMLElement>('.MuiDialogContent-root');
    expect(content).not.toBeNull();
    expect(content!.tabIndex).toBe(0);

    const keyboardStops = Array.from(
      dialog.querySelectorAll<HTMLElement>('[tabindex="0"], button:not([disabled])')
    ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
    expect(keyboardStops[0]).toBe(content);
    expect(keyboardStops.slice(1).map((element) => element.textContent)).toEqual([
      'Reload latest',
      'Keep editing',
      'Reapply my draft',
    ]);
  });

  it('keeps initial focus inside, closes on Escape, and restores the opener', async () => {
    const onClose = vi.fn();
    opener.focus();
    const dialog = await renderDialog(onClose);

    await vi.waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
    });

    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('restores the last external focus when the opener blurred before an async dialog opens', async () => {
    const onClose = vi.fn();
    await act(async () => {
      root.render(<DeferredDialogHarness onClose={onClose} />);
    });
    opener.focus();
    expect(document.activeElement).toBe(opener);
    opener.blur();

    await act(async () => {
      openDeferredDialog();
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    await vi.waitFor(() => expect(dialog!.contains(document.activeElement)).toBe(true));

    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    await vi.waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it('removes transition motion across the portal and restores focus after its exit lifecycle', async () => {
    setPointerEnvironment(false, false, true);
    const onClose = vi.fn();
    opener.focus();
    const dialog = await renderDialog(onClose);
    const dialogRoot = dialog.closest<HTMLElement>('.MuiDialog-root');
    expect(dialogRoot).not.toBeNull();
    const movingNodes = Array.from(dialogRoot!.querySelectorAll<HTMLElement>('*')).filter(
      (node) => {
        const style = getComputedStyle(node);
        return (
          parseFloat(style.transitionDuration) > 0.001 ||
          (style.animationName !== 'none' && parseFloat(style.animationDuration) > 0.001)
        );
      }
    );
    expect(movingNodes).toEqual([]);

    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true })
      );
      await new Promise((resolve) => setTimeout(resolve, 250));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});
