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
  it('leaves portaled confirmation key events to the dialog focus trap', () => {
    const panel = overlay();
    const dialogButton = document.createElement('button');
    document.body.append(dialogButton);
    dialogButton.focus();
    const preventDefault = vi.fn();
    expect(
      containMeetingOverlayTab(
        { key: 'Tab', shiftKey: false, target: dialogButton, preventDefault },
        panel
      )
    ).toBe(false);
    expect(document.activeElement).toBe(dialogButton);
    expect(preventDefault).not.toHaveBeenCalled();
    panel.remove();
    dialogButton.remove();
  });
  it('wraps to the selected roving tab and excludes disabled, hidden and inactive controls', () => {
    const rail = document.createElement('div');
    rail.dataset.meetingFocusOverlay = 'true';
    rail.innerHTML = `
      <button tabindex="-1">Inactive agenda</button>
      <button tabindex="0" disabled>Disabled tab</button>
      <button style="display:none">Hidden tab</button>
      <button style="visibility:hidden">Invisible tab</button>
      <button style="opacity:0">Transparent tab</button>
      <button tabindex="0" aria-selected="true">Selected chat</button>
    `;
    const panel = overlay();
    rail.append(panel);
    document.body.append(rail);
    const selected = rail.querySelector<HTMLElement>('[aria-selected="true"]')!;
    const last = panel.querySelector<HTMLElement>('textarea')!;
    last.focus();
    expect(
      containMeetingOverlayTab({ key: 'Tab', shiftKey: false, preventDefault: vi.fn() }, rail)
    ).toBe(true);
    expect(document.activeElement).toBe(selected);
    expect(
      containMeetingOverlayTab({ key: 'Tab', shiftKey: true, preventDefault: vi.fn() }, rail)
    ).toBe(true);
    expect(document.activeElement).toBe(last);
    rail.remove();
  });

  it('includes the mobile rail tabs and never traps a desktop inline rail', () => {
    const rail = document.createElement('div');
    rail.dataset.meetingFocusOverlay = 'true';
    const tab = document.createElement('button');
    tab.textContent = 'Agenda';
    rail.append(tab);
    const panel = overlay();
    rail.append(panel);
    document.body.append(rail);
    const last = panel.querySelector<HTMLElement>('textarea')!;
    last.focus();
    expect(
      containMeetingOverlayTab({ key: 'Tab', shiftKey: false, preventDefault: vi.fn() }, panel)
    ).toBe(true);
    expect(document.activeElement).toBe(tab);
    rail.dataset.meetingFocusOverlay = 'false';
    last.focus();
    expect(
      containMeetingOverlayTab({ key: 'Tab', shiftKey: false, preventDefault: vi.fn() }, panel)
    ).toBe(false);
    rail.remove();
  });

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
