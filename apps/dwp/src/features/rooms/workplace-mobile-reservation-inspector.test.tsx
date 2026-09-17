// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkplaceMobileReservationInspector } from './workplace-mobile-reservation-inspector';

vi.mock('@mui/material/useMediaQuery', () => ({ default: () => true }));

describe('WorkplaceMobileReservationInspector', () => {
  let host: HTMLDivElement;
  let opener: HTMLButtonElement;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    opener = document.createElement('button');
    document.body.append(opener, host);
    opener.focus();
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue({
      length: 1,
      item: () => null,
    } as unknown as DOMRectList);
  });

  afterEach(() => {
    host.remove();
    opener.remove();
    document.body.style.overflow = '';
    vi.restoreAllMocks();
  });

  it('traps focus, closes with Escape, and restores the keyboard opener', async () => {
    const onClose = vi.fn();
    const root = createRoot(host);
    await act(async () => {
      root.render(
        <WorkplaceMobileReservationInspector
          label="Reservation inspector"
          closeLabel="Close"
          fallbackFocusRef={{ current: null }}
          openerRef={{ current: opener }}
          onClose={onClose}
        >
          <button type="button">First action</button>
          <button type="button">Last action</button>
        </WorkplaceMobileReservationInspector>
      );
    });
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    const dialog = host.querySelector<HTMLElement>('[role="dialog"]')!;
    const close = Array.from(dialog.querySelectorAll('button')).find(
      (button) => button.textContent === 'Close'
    )!;
    const last = Array.from(dialog.querySelectorAll('button')).at(-1)!;
    expect(document.activeElement).toBe(close);
    expect(document.body.style.overflow).toBe('hidden');

    close.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    );
    expect(document.activeElement).toBe(last);
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(close);
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalledOnce();

    await act(async () => root.unmount());
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).toBe('');
  });
});
