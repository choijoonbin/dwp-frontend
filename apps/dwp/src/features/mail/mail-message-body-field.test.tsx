// @vitest-environment jsdom
import { act, createRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MailMessageBodyField, type MailMessageBodyFieldHandle } from './mail-message-body-field';

import type { Root } from 'react-dom/client';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let root: Root;
let host: HTMLDivElement;

describe('mail message body variable insertion', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
  });

  it('inserts a supported variable at the current text selection', async () => {
    const fieldRef = createRef<MailMessageBodyFieldHandle>();
    function Harness() {
      const [value, setValue] = useState('Hello team');
      return (
        <>
          <MailMessageBodyField
            ref={fieldRef}
            format="TEXT"
            value={value}
            disabled={false}
            onChange={setValue}
          />
          <button type="button" onClick={() => fieldRef.current?.insertText('{{recipientName}}')}>
            Insert recipient
          </button>
        </>
      );
    }
    await act(async () => root.render(<Harness />));
    const textarea = host.querySelector('textarea')!;
    await act(async () => {
      textarea.focus();
      textarea.setSelectionRange(6, 10);
      host.querySelector('button')!.click();
      await new Promise((resolve) => setTimeout(resolve, 20));
    });

    expect(textarea.value).toBe('Hello {{recipientName}}');
  });

  it('sanitizes rich clipboard content before inserting it into the live editor', async () => {
    const onChange = vi.fn();
    await act(async () =>
      root.render(
        <MailMessageBodyField
          format="HTML"
          value="<p>Hello </p>"
          disabled={false}
          onChange={onChange}
        />
      )
    );
    const editor = host.querySelector('[contenteditable="true"]') as HTMLDivElement;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const paste = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(paste, 'clipboardData', {
      value: {
        getData: (type: string) =>
          type === 'text/html'
            ? '<strong onclick="steal()">safe</strong><img src=x onerror="steal()"><script>bad()</script>'
            : 'safe',
      },
    });

    await act(async () => editor.dispatchEvent(paste));

    expect(editor.innerHTML).toBe('<p>Hello </p><strong>safe</strong>');
    expect(editor.innerHTML).not.toContain('onclick');
    expect(editor.innerHTML).not.toContain('<img');
    expect(editor.innerHTML).not.toContain('<script');
    expect(onChange).toHaveBeenLastCalledWith('<p>Hello </p><strong>safe</strong>');
  });

  it('sanitizes stored HTML before synchronizing it into the live editor', async () => {
    const onChange = vi.fn();
    await act(async () =>
      root.render(
        <MailMessageBodyField
          format="HTML"
          value={
            '<p>Visible</p><script>steal()</script><style>bad</style><template>hidden</template><img src="https://tracker.example/pixel.png">'
          }
          disabled={false}
          onChange={onChange}
        />
      )
    );

    const editor = host.querySelector('[contenteditable="true"]') as HTMLDivElement;
    expect(editor.innerHTML).toBe('<p>Visible</p>');
    expect(editor.querySelector('script, style, template, img')).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith('<p>Visible</p>');
  });
});
