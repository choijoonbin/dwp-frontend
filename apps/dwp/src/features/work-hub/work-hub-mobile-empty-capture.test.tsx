// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkHubMobileEmptyCapture } from './work-hub-mobile-empty-capture';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

let host: HTMLDivElement;
let root: Root;

function saveButton() {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (button) => button.textContent?.trim() === 'workHub.taskForm.quickCapture.save'
  )!;
}

async function setTitle(value: string) {
  const title = document.querySelector<HTMLInputElement>('input[required]')!;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setValue.call(title, value);
    title.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return title;
}

describe('WorkHubMobileEmptyCapture owner boundary', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    document.body.replaceChildren();
  });

  it('drops the previous owner draft and request identity before rendering the next owner', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('unknown result'));
    const renderOwner = async (ownerKey: string) => {
      await act(async () =>
        root.render(
          <WorkHubMobileEmptyCapture
            ownerKey={ownerKey}
            canCreate
            canScheduleAfterCreate={false}
            onSubmit={onSubmit}
          />
        )
      );
    };

    await renderOwner('tenant-a:user-1');
    await setTitle('Owner-scoped draft');
    await act(async () => saveButton().click());
    await act(async () => Promise.resolve());
    const firstKey = onSubmit.mock.calls[0]?.[1].idempotencyKey;

    await renderOwner('tenant-b:user-2');
    expect(document.querySelector<HTMLInputElement>('input[required]')?.value).toBe('');
    await setTitle('Owner-scoped draft');
    await act(async () => saveButton().click());
    await act(async () => Promise.resolve());

    expect(onSubmit.mock.calls[1]?.[1].idempotencyKey).not.toBe(firstKey);
  });
});
