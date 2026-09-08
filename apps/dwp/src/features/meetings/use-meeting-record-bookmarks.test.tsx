// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

const api = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn(), history: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-record-preferences-api', () => ({
  getVideoMeetingRecordBookmarks: api.read,
  setVideoMeetingRecordBookmark: api.write,
}));
import { useMeetingRecordBookmarks } from './use-meeting-record-bookmarks';

const id = '81000000-0000-4000-8000-000000000301';
const empty = { meetingId: id, favorite: false, version: 0, updatedAt: null };
const saved = { meetingId: id, favorite: true, version: 1, updatedAt: '2026-09-07T05:00:00Z' };
let client: QueryClient;
let root: Root;
let node: HTMLDivElement;
function Harness({ scope = 'tenant1:user7', ids = [id] }: { scope?: string; ids?: string[] }) {
  useQuery({
    queryKey: ['meetings', 'history', scope, false, 0],
    queryFn: api.history,
    retry: false,
  });
  const state = useMeetingRecordBookmarks(scope, ids, true);
  return createElement(
    'div',
    null,
    createElement(
      'output',
      null,
      JSON.stringify({ items: state.items, failed: state.failed, denied: state.accessDenied })
    ),
    createElement(
      'button',
      { disabled: state.busy || !state.items[0], onClick: () => void state.toggle(state.items[0]) },
      'Toggle'
    ),
    createElement('button', { onClick: () => void state.refresh() }, 'Refresh')
  );
}
async function render(scope?: string, ids?: string[]) {
  await act(async () =>
    root.render(
      createElement(QueryClientProvider, { client }, createElement(Harness, { scope, ids }))
    )
  );
}
async function flush(check: () => void) {
  await act(async () => vi.waitFor(check));
}
async function click(index = 0) {
  await act(async () => node.querySelectorAll('button')[index].click());
}
function output() {
  return JSON.parse(node.querySelector('output')!.textContent!) as {
    items: (typeof empty)[];
    failed: boolean;
    denied: boolean;
  };
}

describe('personal Meeting record bookmarks lifecycle', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    api.read.mockReset().mockResolvedValue([empty]);
    api.write.mockReset().mockResolvedValue(saved);
    api.history.mockReset().mockResolvedValue({ items: [{ meetingId: id }], total: 1 });
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    node = document.createElement('div');
    document.body.appendChild(node);
    root = createRoot(node);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    client.clear();
    node.remove();
  });

  it('does not invent an unchecked favorite while the personal read is unresolved', async () => {
    api.read.mockReturnValue(new Promise(() => undefined));
    await render();
    expect(output().items).toEqual([]);
    expect(node.querySelector('button')!.disabled).toBe(true);
    expect(api.read).toHaveBeenCalledWith([id], expect.any(AbortSignal));
  });

  it('waits for committed state and fresh server reads without an optimistic star or duplicate command', async () => {
    let finish!: (value: typeof saved) => void;
    api.write.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    await render();
    await flush(() => expect(output().items).toEqual([empty]));
    await click();
    await click();
    expect(api.write).toHaveBeenCalledTimes(1);
    expect(api.write).toHaveBeenCalledWith(
      id,
      true,
      0,
      expect.stringMatching(/^[0-9a-f-]{36}$/u),
      expect.any(AbortSignal)
    );
    expect(output().items).toEqual([empty]);
    expect(node.querySelector('button')!.disabled).toBe(true);
    api.read.mockResolvedValue([saved]);
    await act(async () => finish(saved));
    await flush(() => expect(output().items).toEqual([saved]));
    expect(node.querySelector('button')!.disabled).toBe(false);
  });

  it('withdraws prior favorite metadata when an authority refresh is denied', async () => {
    api.read.mockResolvedValue([saved]);
    await render();
    await flush(() => expect(output().items).toEqual([saved]));
    api.read.mockRejectedValue(new HttpError('denied', 403));
    await click(1);
    await flush(() => expect(output().denied).toBe(true));
    expect(output().items).toEqual([]);
    expect(node.querySelector('button')!.disabled).toBe(true);
    expect(api.write).not.toHaveBeenCalled();
  });

  it('hides the projection after a mutation denies current meeting access', async () => {
    api.write.mockRejectedValue(new HttpError('revoked', 404));
    await render();
    await flush(() => expect(output().items).toEqual([empty]));
    await click();
    await flush(() => expect(output().denied).toBe(true));
    expect(output().items).toEqual([]);
  });

  it('re-reads current versions after a CAS conflict before another operation', async () => {
    api.write.mockRejectedValueOnce(new HttpError('conflict', 409));
    await render();
    await flush(() => expect(output().items).toEqual([empty]));
    api.read.mockResolvedValue([saved]);
    await click();
    await flush(() => expect(output().items).toEqual([saved]));
    expect(output().failed).toBe(true);
    await click();
    expect(api.write.mock.calls[1].slice(0, 3)).toEqual([id, false, 1]);
    expect(api.write.mock.calls[1][3]).not.toBe(api.write.mock.calls[0][3]);
  });

  it('aborts the old actor command and ignores its late result across identity changes', async () => {
    let finish!: (value: typeof saved) => void;
    api.write.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    await render();
    await flush(() => expect(output().items).toEqual([empty]));
    await click();
    const signal = api.write.mock.calls[0][4] as AbortSignal;
    await render('tenant2:user8');
    expect(signal.aborted).toBe(true);
    await flush(() => expect(output().items).toEqual([empty]));
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    await act(async () => finish(saved));
    expect(invalidate).not.toHaveBeenCalled();
    expect(output().items).toEqual([empty]);
  });

  it('aborts an in-flight read when the authorized page changes', async () => {
    api.read.mockReturnValue(new Promise(() => undefined));
    await render();
    const oldSignal = api.read.mock.calls[0][1] as AbortSignal;
    await render('tenant1:user7', ['81000000-0000-4000-8000-000000000302']);
    expect(oldSignal.aborted).toBe(true);
    expect(output().items).toEqual([]);
  });

  it('does not request an empty or unbounded guessed bookmark page', async () => {
    await render('tenant1:user7', []);
    expect(api.read).not.toHaveBeenCalled();
    expect(api.write).not.toHaveBeenCalled();
  });

  it.each(['mutation', 'read'] as const)(
    'keeps %s denial latched until both fresh bookmark and history reads succeed',
    async (source) => {
      api.read.mockResolvedValue([saved]);
      if (source === 'read') api.read.mockRejectedValueOnce(new HttpError('revoked', 403));
      else api.write.mockRejectedValueOnce(new HttpError('revoked', 403));
      await render();
      if (source === 'mutation') {
        await flush(() => expect(output().items).toEqual([saved]));
        await click();
      }
      await flush(() => expect(output().denied).toBe(true));
      let completeBookmarks!: (items: (typeof saved)[]) => void;
      let completeHistory!: (value: unknown) => void;
      api.read.mockReturnValue(
        new Promise((resolve) => {
          completeBookmarks = resolve;
        })
      );
      api.history.mockReturnValue(
        new Promise((resolve) => {
          completeHistory = resolve;
        })
      );
      await click(1);
      expect(output().denied).toBe(true);
      expect(output().items).toEqual([]);
      await act(async () => completeBookmarks([saved]));
      expect(output().denied).toBe(true);
      expect(output().items).toEqual([]);
      await act(async () => completeHistory({ items: [{ meetingId: id }], total: 1 }));
      await flush(() => expect(output().denied).toBe(false));
      expect(output().items).toEqual([saved]);
    }
  );

  it.each(['bookmark', 'history'] as const)(
    'does not clear denial when %s revalidation fails even if its peer succeeds',
    async (failing) => {
      api.read.mockResolvedValue([saved]);
      api.write.mockRejectedValueOnce(new HttpError('revoked', 403));
      await render();
      await flush(() => expect(output().items).toEqual([saved]));
      await click();
      await flush(() => expect(output().denied).toBe(true));
      (failing === 'bookmark' ? api.read : api.history).mockRejectedValue(
        new HttpError('not ready', 503)
      );
      await click(1);
      await flush(() => expect(output().failed).toBe(true));
      expect(output().denied).toBe(true);
      expect(output().items).toEqual([]);
      expect(node.querySelector('button')!.disabled).toBe(true);
    }
  );

  it('does not let an old actor recovery clear a new actor denial after late success', async () => {
    api.read.mockRejectedValueOnce(new HttpError('revoked', 403));
    await render();
    await flush(() => expect(output().denied).toBe(true));
    let completeBookmarks!: (value: unknown) => void;
    let completeHistory!: (value: unknown) => void;
    api.read.mockReturnValueOnce(
      new Promise((resolve) => {
        completeBookmarks = resolve;
      })
    );
    api.history.mockReturnValueOnce(
      new Promise((resolve) => {
        completeHistory = resolve;
      })
    );
    await click(1);
    api.read.mockRejectedValue(new HttpError('new actor denied', 403));
    await render('tenant2:user8');
    await flush(() => expect(output().denied).toBe(true));
    await act(async () => {
      completeBookmarks([saved]);
      completeHistory({ items: [{ meetingId: id }], total: 1 });
    });
    expect(output().denied).toBe(true);
    expect(output().items).toEqual([]);
  });

  it('does not let an old page recovery clear denial after page replacement', async () => {
    api.read.mockRejectedValueOnce(new HttpError('revoked', 403));
    await render();
    await flush(() => expect(output().denied).toBe(true));
    let completeBookmarks!: (value: unknown) => void;
    api.read.mockReturnValueOnce(
      new Promise((resolve) => {
        completeBookmarks = resolve;
      })
    );
    await click(1);
    await render('tenant1:user7', ['81000000-0000-4000-8000-000000000302']);
    await act(async () => completeBookmarks([saved]));
    expect(output().denied).toBe(true);
    expect(output().items).toEqual([]);
  });
});
