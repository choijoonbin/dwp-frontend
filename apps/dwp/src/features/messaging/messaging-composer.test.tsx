// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessagingComposer } from './messaging-composer';

import type { Root } from 'react-dom/client';
import type { MessagingMentionDraft } from './messaging-composer-model';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));
vi.mock('./messaging-expression-picker', () => ({ MessagingExpressionPicker: () => null }));
vi.mock('./messaging-attachment-drafts', () => ({ MessagingAttachmentDrafts: () => null }));
vi.mock('./messaging-mention-menu', () => ({ MessagingMentionMenu: () => null }));

let root: Root;
let host: HTMLDivElement;
const onSend = vi.fn();
const onMentions = vi.fn();

function ComposerHarness({
  initialValue = 'Review @Kim',
  sending = false,
}: {
  initialValue?: string;
  sending?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [mentions, setMentions] = useState<MessagingMentionDraft[]>([
    { token: '@Kim', userIds: [2] },
  ]);
  return (
    <MessagingComposer
      value={value}
      onChange={setValue}
      onSend={() => onSend(value, mentions)}
      isSending={sending}
      hasError={false}
      attachments={[]}
      attachmentBusy={false}
      onAttachFiles={() => undefined}
      onRetryAttachment={() => undefined}
      onRemoveAttachment={() => undefined}
      mentions={mentions}
      onMentionsChange={(next) => {
        setMentions(next);
        onMentions(next);
      }}
    />
  );
}

async function render(initialValue?: string, sending = false) {
  await act(async () =>
    root.render(<ComposerHarness initialValue={initialValue} sending={sending} />)
  );
  return host.querySelector<HTMLTextAreaElement>('textarea:not([aria-hidden])')!;
}

function button(label: string) {
  const element = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(element).not.toBeNull();
  return element!;
}

async function click(label: string) {
  await act(async () => button(label).click());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

async function key(input: HTMLElement, options: KeyboardEventInit) {
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...options })
    )
  );
}

describe('Messenger compact formatting toolbar', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    onSend.mockReset();
    onMentions.mockReset();
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 0)
    );
    vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('formats the selection, restores focus and selection, and sends the existing text contract', async () => {
    const input = await render();
    await act(async () => {
      input.focus();
      input.setSelectionRange(7, 11);
    });
    await click('Bold');
    expect(input.value).toBe('Review **@Kim**');
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([9, 13]);
    expect(onMentions).toHaveBeenLastCalledWith([{ token: '@Kim', userIds: [2] }]);
    await key(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('Review **@Kim**', [{ token: '@Kim', userIds: [2] }]);
  });

  it('removes notification recipients when their only mention is converted to code', async () => {
    const input = await render('@Kim');
    await act(async () => {
      input.focus();
      input.setSelectionRange(0, 4);
    });
    await click('Inline code');
    expect(input.value).toBe('`@Kim`');
    expect(onMentions).toHaveBeenLastCalledWith([]);
    await key(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('`@Kim`', []);
  });

  it('keeps IME composition and Shift+Enter from sending or changing formatting', async () => {
    const input = await render('한글');
    await act(async () => {
      input.focus();
      input.setSelectionRange(0, 2);
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    });
    await key(input, { key: 'Enter', isComposing: true });
    await key(input, { key: 'b', ctrlKey: true, isComposing: true });
    await click('Bold');
    expect(input.value).toBe('한글');
    expect(onSend).not.toHaveBeenCalled();
    await act(async () =>
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    );
    await key(input, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
    await key(input, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('provides one keyboard stop and arrow navigation, with selection retained across Tab', async () => {
    const input = await render('Review');
    await act(async () => {
      input.focus();
      input.setSelectionRange(0, 6);
      button('Bold').focus();
    });
    expect(host.querySelectorAll('[role="toolbar"] button[tabindex="0"]')).toHaveLength(1);
    await key(button('Bold'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(button('Italic'));
    await click('Italic');
    expect(input.value).toBe('*Review*');
  });

  it('supports the platform bold shortcut without submitting', async () => {
    const input = await render('Review');
    await act(async () => {
      input.focus();
      input.setSelectionRange(0, 6);
    });
    await key(input, { key: 'b', metaKey: true });
    expect(input.value).toBe('**Review**');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables formatting while the current message is being sent', async () => {
    const input = await render('Review', true);
    expect(
      Array.from(host.querySelectorAll<HTMLButtonElement>('[role="toolbar"] button')).every(
        (item) => item.disabled
      )
    ).toBe(true);
    await key(input, { key: 'b', ctrlKey: true });
    expect(input.value).toBe('Review');
  });
});
