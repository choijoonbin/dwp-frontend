// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MeetingCodeField } from './meeting-code-field';

let root: Root;
let host: HTMLDivElement;
const changed = vi.fn();

function Harness({
  initial = '',
  disabled = false,
  masked = false,
  accessibleLabel,
}: {
  initial?: string;
  disabled?: boolean;
  masked?: boolean;
  accessibleLabel?: string;
}) {
  const [code, setCode] = useState(initial);
  return (
    <MeetingCodeField
      code={code}
      accessibleLabel={accessibleLabel}
      disabled={disabled}
      masked={masked}
      label="Meeting code"
      placeholder="ABCD-EFGH-JKMN"
      supportingText="Enter 10 to 16 characters."
      onCodeChange={(next) => {
        changed(next);
        setCode(next);
      }}
    />
  );
}

async function render(initial = '', disabled = false, masked = false, accessibleLabel?: string) {
  await act(async () =>
    root.render(
      <Harness
        initial={initial}
        disabled={disabled}
        masked={masked}
        accessibleLabel={accessibleLabel}
      />
    )
  );
  return host.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
}

async function replaceValue(
  input: HTMLInputElement,
  value: string,
  selectionStart = value.length,
  inputType = 'insertText',
  isComposing = false
) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.setSelectionRange(selectionStart, selectionStart);
    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        data: value,
        inputType,
        isComposing,
      })
    );
  });
}

describe('meeting join code field', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    changed.mockReset();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('normalizes paste-like input once and keeps an accessible native field contract', async () => {
    const input = await render();
    await replaceValue(input, 'abcd efgh-jkmn', 14, 'insertFromPaste');

    expect(input.value).toBe('ABCD-EFGH-JKMN');
    expect(changed).toHaveBeenLastCalledWith('ABCDEFGHJKMN');
    expect(input.required).toBe(true);
    expect(input.autocomplete).toBe('one-time-code');
    expect(input.getAttribute('aria-label')).toBe('Meeting code');
  });

  it('restores the logical caret when a character is inserted inside a formatted group', async () => {
    const input = await render('ABCDEFGHJKMN');
    await replaceValue(input, 'ABCD-XEFGH-JKMN', 6);

    expect(input.value).toBe('ABCD-XEFG-HJKM-N');
    expect(changed).toHaveBeenLastCalledWith('ABCDXEFGHJKMN');
    expect([input.selectionStart, input.selectionEnd]).toEqual([6, 6]);
  });

  it('does not canonicalize or publish an intermediate IME composition', async () => {
    const input = await render('ABCD');
    await act(async () =>
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '한' }))
    );
    await replaceValue(input, 'ABCD한', 5, 'insertCompositionText', true);

    expect(input.value).toBe('ABCD한');
    expect(changed).not.toHaveBeenCalled();

    await act(async () =>
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '한' }))
    );
    expect(input.value).toBe('ABCD');
    expect(changed).toHaveBeenLastCalledWith('ABCD');
  });

  it('honors the waiting-state lock without exposing a second editable input', async () => {
    const input = await render('ABCDEFGHJKMN', true, true, 'Verified meeting code ending in JKMN');
    expect(input.disabled).toBe(true);
    expect(input.value).toBe('••••-••••-JKMN');
    expect(input.getAttribute('aria-label')).toBe('Verified meeting code ending in JKMN');
    expect(host.querySelectorAll('input[autocomplete="one-time-code"]')).toHaveLength(1);
  });
});
