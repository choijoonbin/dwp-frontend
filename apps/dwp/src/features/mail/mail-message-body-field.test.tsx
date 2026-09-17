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
});
