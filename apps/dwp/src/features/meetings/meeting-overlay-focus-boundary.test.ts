// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';

import { containMeetingOverlayTab } from './meeting-overlay-focus-boundary';

function overlay() {
  const container = document.createElement('aside');
  container.innerHTML = `
    <button type="button">Close</button>
    <button type="button" tabindex="-1">Inactive tab</button>
    <textarea aria-label="Message"></textarea>
    <button type="button" disabled>Send</button>
  `;
  document.body.appendChild(container);
  return container;
}

describe('meeting overlay focus boundary', () => {
  it('wraps forward from the last enabled control to the first', () => {
    const container = overlay();
    const close = container.querySelector<HTMLElement>('button')!;
    const textarea = container.querySelector<HTMLElement>('textarea')!;
    const preventDefault = vi.fn();
    textarea.focus();

    expect(
      containMeetingOverlayTab({ key: 'Tab', shiftKey: false, preventDefault }, container)
    ).toBe(true);
    expect(document.activeElement).toBe(close);
    expect(preventDefault).toHaveBeenCalledOnce();
    container.remove();
  });

  it('wraps backward from the first enabled control to the last', () => {
    const container = overlay();
    const close = container.querySelector<HTMLElement>('button')!;
    const textarea = container.querySelector<HTMLElement>('textarea')!;
    close.focus();

    expect(
      containMeetingOverlayTab({ key: 'Tab', shiftKey: true, preventDefault: vi.fn() }, container)
    ).toBe(true);
    expect(document.activeElement).toBe(textarea);
    container.remove();
  });
});
