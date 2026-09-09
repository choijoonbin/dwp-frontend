// @vitest-environment jsdom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkHubKeyboardShortcuts } from './use-work-hub-keyboard-shortcuts';
import { WorkHubPageHeader } from './work-hub-page-header';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

type Commands = Parameters<typeof useWorkHubKeyboardShortcuts>[0];
function Harness(props: Commands) {
  const onKeyDown = useWorkHubKeyboardShortcuts(props);
  return (
    <section tabIndex={0} onKeyDown={onKeyDown}>
      <button>Action</button>
      <input />
      <div contentEditable suppressContentEditableWarning>
        Draft
      </div>
    </section>
  );
}

let host: HTMLDivElement;
let root: Root;
let commands: Required<Commands>;
const region = () => host.querySelector('section')!;
async function render(props: Commands = commands) {
  await act(async () => root.render(<Harness {...props} />));
  region().focus();
}
async function key(target: Element | Window, init: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  await act(async () => target.dispatchEvent(event));
  return event.defaultPrevented;
}

describe('Work keyboard scope and browser-safe create alternative', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    commands = { onCreate: vi.fn(), onComplete: vi.fn(), onEdit: vi.fn() };
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('runs C/E only inside the focused personal component and leaves outside keys alone', async () => {
    await render();
    expect(await key(region(), { key: 'c' })).toBe(true);
    expect(await key(region(), { key: 'e' })).toBe(true);
    expect(commands.onComplete).toHaveBeenCalledOnce();
    expect(commands.onEdit).toHaveBeenCalledOnce();
    expect(await key(document.body, { key: 'c' })).toBe(false);
    expect(await key(window, { key: 'e' })).toBe(false);
    expect(commands.onComplete).toHaveBeenCalledOnce();
    expect(commands.onEdit).toHaveBeenCalledOnce();
  });

  it.each([
    { key: 'n', metaKey: true },
    { key: 'n', ctrlKey: true },
    { key: 'N', code: 'KeyN', altKey: true, shiftKey: true },
    { key: '˜', code: 'KeyN', altKey: true, shiftKey: true },
  ])(
    'accepts a delivered create gesture %j (without claiming browser reservation interception)',
    async (gesture) => {
      await render();
      expect(await key(region(), gesture)).toBe(true);
      expect(commands.onCreate).toHaveBeenCalledOnce();
    }
  );

  it.each([
    { key: 'c', repeat: true },
    { key: 'e', isComposing: true },
    { key: 'c', keyCode: 229 },
    { key: 'e', altKey: true },
    { key: 'c', ctrlKey: true },
    { key: 'e', metaKey: true },
    { key: 'C', shiftKey: true },
    { key: 'n' },
    { key: 'n', ctrlKey: true, metaKey: true },
    { key: 'n', ctrlKey: true, shiftKey: true },
  ])('does not hijack repeat, IME, or unrelated modifiers %j', async (gesture) => {
    await render();
    expect(await key(region(), gesture)).toBe(false);
    Object.values(commands).forEach((command) => expect(command).not.toHaveBeenCalled());
  });

  it.each(['input', '[contenteditable]'])('does not execute while editing %s', async (selector) => {
    await render();
    const input = host.querySelector<HTMLElement>(selector)!;
    input.focus();
    for (const gesture of [
      { key: 'c' },
      { key: 'e' },
      { key: 'n', ctrlKey: true },
      { key: 'N', altKey: true, shiftKey: true },
    ])
      expect(await key(input, gesture)).toBe(false);
    Object.values(commands).forEach((command) => expect(command).not.toHaveBeenCalled());
  });

  it.each(['aria-modal', 'drawer', 'menu', 'native-dialog'])(
    'blocks every shortcut while a %s is active even if focus escaped it',
    async (kind) => {
      await render();
      const modal = document.createElement(kind === 'native-dialog' ? 'dialog' : 'div');
      if (kind === 'aria-modal') modal.setAttribute('aria-modal', 'true');
      if (kind === 'drawer') modal.className = 'MuiModal-root';
      if (kind === 'menu') modal.setAttribute('role', 'menu');
      if (kind === 'native-dialog') modal.setAttribute('open', '');
      host.appendChild(modal);
      for (const gesture of [{ key: 'c' }, { key: 'e' }, { key: 'n', metaKey: true }])
        expect(await key(region(), gesture)).toBe(false);
      Object.values(commands).forEach((command) => expect(command).not.toHaveBeenCalled());
      modal.remove();
      expect(await key(region(), { key: 'e' })).toBe(true);
    }
  );

  it('ignores closed modal DOM and respects an already handled key', async () => {
    await render();
    const modal = document.createElement('div');
    modal.setAttribute('aria-modal', 'true');
    modal.style.display = 'none';
    host.appendChild(modal);
    expect(await key(region(), { key: 'e' })).toBe(true);
    const prevent = (event: Event) => event.preventDefault();
    region().addEventListener('keydown', prevent);
    await key(region(), { key: 'c' });
    expect(commands.onComplete).not.toHaveBeenCalled();
  });

  it('does not execute for a blurred scope, disabled control, or commands withdrawn by pending/permission changes', async () => {
    await render();
    region().blur();
    expect(await key(region(), { key: 'c' })).toBe(false);
    const action = host.querySelector('button')!;
    action.disabled = true;
    region().focus();
    expect(await key(action, { key: 'e' })).toBe(false);
    await render({});
    for (const gesture of [{ key: 'c' }, { key: 'e' }, { key: 'n', ctrlKey: true }])
      expect(await key(region(), gesture)).toBe(false);
    Object.values(commands).forEach((command) => expect(command).not.toHaveBeenCalled());
  });

  it('uses the latest owner handlers and unregisters create on unmount', async () => {
    await render();
    const latest = { onCreate: vi.fn(), onComplete: vi.fn(), onEdit: vi.fn() };
    await render(latest);
    await key(region(), { key: 'c' });
    await key(region(), { key: 'n', ctrlKey: true });
    expect(latest.onComplete).toHaveBeenCalledOnce();
    expect(latest.onCreate).toHaveBeenCalledOnce();
    Object.values(commands).forEach((command) => expect(command).not.toHaveBeenCalled());
    await act(async () => root.render(null));
    expect(await key(document.body, { key: 'n', ctrlKey: true })).toBe(false);
    expect(latest.onCreate).toHaveBeenCalledOnce();
  });

  it('wires the header alternative to the same create action and withdraws it during refresh', async () => {
    const props: ComponentProps<typeof WorkHubPageHeader> = {
      view: 'queue',
      count: 1,
      complete: true,
      freshness: 'live',
      canCreate: true,
      refreshing: false,
      onRefresh: vi.fn(),
      onSources: vi.fn(),
      onCreate: commands.onCreate,
    };
    await act(async () => root.render(<WorkHubPageHeader {...props} />));
    const trigger = host.querySelector<HTMLButtonElement>('[aria-keyshortcuts]')!;
    trigger.focus();
    expect(
      document.getElementById(trigger.getAttribute('aria-describedby')!)?.textContent
    ).toContain('workHub.keyboardShortcuts.createHelp');
    expect(await key(trigger, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true })).toBe(true);
    expect(commands.onCreate).toHaveBeenCalledOnce();
    await act(async () => root.render(<WorkHubPageHeader {...props} refreshing />));
    expect(await key(trigger, { key: 'N', code: 'KeyN', altKey: true, shiftKey: true })).toBe(
      false
    );
    expect(commands.onCreate).toHaveBeenCalledOnce();
  });
});
