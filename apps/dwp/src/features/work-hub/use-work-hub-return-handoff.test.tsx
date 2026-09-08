// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recordWorkHubReturnIntent, type WorkHubReturnFocus } from './work-hub-return-handoff';
import {
  useWorkHubReturnHandoff,
  type WorkHubReturnRefetchResult,
} from './use-work-hub-return-handoff';
import { hubItem } from './work-hub.test-support';

const item = hubItem({ key: 'APPROVAL_TASK:approval-1:SECURITY_REVIEW' });
const another = hubItem({ key: 'APPROVAL_TASK:approval-2:SECURITY_REVIEW' });
const returnTo = `/work/queue?work=${encodeURIComponent(item.key)}#evidence`;

function refetchResult(key = item.key): WorkHubReturnRefetchResult {
  return { isSuccess: true, data: { snapshot: { items: [{ ...item, key }] } } };
}

function Harness({
  focus,
  refetch,
}: {
  focus: WorkHubReturnFocus;
  refetch: () => Promise<WorkHubReturnRefetchResult>;
}) {
  useWorkHubReturnHandoff({ itemKey: item.key, ready: true, refetch });
  return (
    <>
      <button
        data-work-source-trigger
        data-work-item-key={focus === 'SOURCE' ? item.key : another.key}
      >
        Source
      </button>
      <button data-work-ai-trigger data-work-item-key={focus === 'ASSIST' ? item.key : another.key}>
        Assist
      </button>
    </>
  );
}

describe('Work approval return focus revalidation', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      })
    );
    sessionStorage.clear();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  async function render(
    focus: WorkHubReturnFocus,
    refetch: () => Promise<WorkHubReturnRefetchResult>
  ) {
    recordWorkHubReturnIntent(item, returnTo, focus);
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={[returnTo]}>
          <Harness focus={focus} refetch={refetch} />
        </MemoryRouter>
      );
    });
  }

  it.each([
    ['SOURCE', 'data-work-source-trigger'],
    ['ASSIST', 'data-work-ai-trigger'],
  ] as const)(
    'restores %s only after a successful fresh snapshot with the same item',
    async (focus, attribute) => {
      let resolveRefetch!: (result: WorkHubReturnRefetchResult) => void;
      const refetch = vi.fn(
        () =>
          new Promise<WorkHubReturnRefetchResult>((resolve) => {
            resolveRefetch = resolve;
          })
      );
      await render(focus, refetch);
      const trigger = host.querySelector(`[${attribute}]`);
      expect(trigger).not.toBe(document.activeElement);

      await act(async () => {
        resolveRefetch(refetchResult());
        await Promise.resolve();
      });

      expect(trigger).toBe(document.activeElement);
      expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    }
  );

  it('does not restore focus from cached controls when the fresh refetch fails', async () => {
    await render('SOURCE', vi.fn().mockRejectedValue(new Error('network unavailable')));
    expect(host.querySelector('[data-work-source-trigger]')).not.toBe(document.activeElement);
  });

  it('does not restore focus when the fresh snapshot no longer contains the selected item', async () => {
    await render('ASSIST', vi.fn().mockResolvedValue(refetchResult(another.key)));
    expect(host.querySelector('[data-work-ai-trigger]')).not.toBe(document.activeElement);
  });
});
