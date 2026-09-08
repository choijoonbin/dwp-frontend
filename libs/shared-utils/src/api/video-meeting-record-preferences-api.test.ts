import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  getVideoMeetingRecordBookmarks,
  setVideoMeetingRecordBookmark,
  type VideoMeetingRecordBookmark,
} from './video-meeting-record-preferences-api';

const meetingId = '81000000-0000-4000-8000-000000000001';
const secondId = '81000000-0000-4000-8000-000000000002';
const otherId = '81000000-0000-4000-8000-000000000099';
const commandId = '82000000-0000-4000-8000-000000000001';
const updatedAt = '2026-09-07T01:00:00.000Z';
const base = '/api/meetings/v1';
const csrfPath = '/api/auth/csrf';
const emptyBookmark = (id = meetingId): VideoMeetingRecordBookmark => ({
  meetingId: id,
  favorite: false,
  version: 0,
  updatedAt: null,
});
const savedBookmark = (id = meetingId): VideoMeetingRecordBookmark => ({
  meetingId: id,
  favorite: true,
  version: 1,
  updatedAt,
});
const response = (data: unknown, status = 200) =>
  ({
    ok: status < 400,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  }) as Response;

function stubResponse(data: unknown, status = 200) {
  const fetcher = vi.fn(async (path: string, _request?: RequestInit) =>
    path === csrfPath
      ? response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' })
      : response(data, status)
  );
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Meeting current-page bookmark reads', () => {
  it('uses the public route and restores requested order from exactly bound response IDs', async () => {
    const fetcher = stubResponse({ items: [savedBookmark(secondId), emptyBookmark()] });
    await expect(getVideoMeetingRecordBookmarks([meetingId, secondId])).resolves.toEqual([
      emptyBookmark(),
      savedBookmark(secondId),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [path, request] = fetcher.mock.calls[0];
    expect(path).toBe(`${base}/history/bookmarks?meetingIds=${meetingId}&meetingIds=${secondId}`);
    expect(request).toMatchObject({ method: 'GET', credentials: 'include' });
    expect(new URL(path, 'https://dwp.example').searchParams.has('userId')).toBe(false);
    expect(request?.body).toBeUndefined();
  });

  it.each([1, 100])('accepts a bounded page of %i distinct references', async (count) => {
    const ids = Array.from(
      { length: count },
      (_, index) => `81000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`
    );
    const fetcher = stubResponse({ items: ids.map(emptyBookmark) });
    expect(await getVideoMeetingRecordBookmarks(ids)).toHaveLength(count);
    expect(
      new URL(fetcher.mock.calls[0][0], 'https://dwp.example').searchParams.getAll('meetingIds')
    ).toEqual(ids);
  });

  it.each(
    [
      [],
      [meetingId, meetingId],
      ['not-a-meeting'],
      [`${meetingId}?tenantId=9`],
      [meetingId, 'private-title'],
      Array.from(
        { length: 101 },
        (_, index) => `81000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
      ),
    ].map((ids) => ({ ids }))
  )(
    'rejects malformed, duplicate or out-of-bound request page %# before any fetch',
    async ({ ids }) => {
      const fetcher = stubResponse({ items: [] });
      await expect(getVideoMeetingRecordBookmarks(ids)).rejects.toThrow(
        /A (bounded unique meeting bookmark page|valid meeting bookmark reference) is required/u
      );
      expect(fetcher).not.toHaveBeenCalled();
    }
  );

  it.each([
    null,
    {},
    { items: null },
    { items: {} },
    { items: [] },
    { items: [emptyBookmark()] },
    { items: [emptyBookmark(), emptyBookmark()] },
    { items: [emptyBookmark(), savedBookmark(otherId)] },
    { items: [emptyBookmark(), null] },
    { items: [emptyBookmark(), savedBookmark(secondId), savedBookmark(otherId)] },
  ])(
    'rejects missing, duplicate, substituted or extra current-page response %#',
    async (payload) => {
      stubResponse(payload);
      await expect(getVideoMeetingRecordBookmarks([meetingId, secondId])).rejects.toThrow(
        /bookmark .*binding is invalid/u
      );
    }
  );

  it('returns only the bookmark allowlist, never unrelated private metadata', async () => {
    stubResponse({
      items: [{ ...savedBookmark(), tenantId: 99, title: 'private title', transcript: 'raw text' }],
    });
    await expect(getVideoMeetingRecordBookmarks([meetingId])).resolves.toEqual([savedBookmark()]);
  });
});

const invalidBookmarks = [
  null,
  { ...savedBookmark(), meetingId: otherId },
  { ...savedBookmark(), favorite: 'true' },
  { ...savedBookmark(), favorite: 1 },
  { ...savedBookmark(), favorite: undefined },
  { ...savedBookmark(), version: -1 },
  { ...savedBookmark(), version: 1.5 },
  { ...savedBookmark(), version: '1' },
  { ...savedBookmark(), version: Number.MAX_SAFE_INTEGER + 1 },
  { ...savedBookmark(), updatedAt: undefined },
  { ...savedBookmark(), updatedAt: 123 },
  { ...savedBookmark(), updatedAt: 'private-invalid-timestamp' },
  { ...savedBookmark(), updatedAt: null },
  { ...emptyBookmark(), favorite: true },
  { ...emptyBookmark(), updatedAt },
];

describe.each(['GET', 'PUT'] as const)('%s bookmark response validation', (method) => {
  it.each(invalidBookmarks)(
    'rejects invalid boolean/version/timestamp/identity binding %#',
    async (item) => {
      stubResponse(method === 'GET' ? { items: [item] } : item);
      const result =
        method === 'GET'
          ? getVideoMeetingRecordBookmarks([meetingId])
          : setVideoMeetingRecordBookmark(meetingId, true, 0, commandId);
      await expect(result).rejects.toThrow(/bookmark .*binding is invalid/u);
    }
  );

  it.each([403, 404, 409, 503])(
    'preserves HTTP %i as a failure instead of manufacturing a default',
    async (status) => {
      const fetcher = stubResponse(null, status);
      const result =
        method === 'GET'
          ? getVideoMeetingRecordBookmarks([meetingId])
          : setVideoMeetingRecordBookmark(meetingId, true, 0, commandId);
      await expect(result).rejects.toMatchObject({ status });
      expect(fetcher.mock.calls.filter(([path]) => path !== csrfPath)).toHaveLength(1);
    }
  );
});

describe('Meeting bookmark compare-and-set commands', () => {
  it('sends only desired state/CAS on the public path and preserves the caller stable command UUID', async () => {
    const fetcher = stubResponse(savedBookmark());
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await expect(setVideoMeetingRecordBookmark(meetingId, true, 0, commandId)).resolves.toEqual(
        savedBookmark()
      );
    }
    const writes = fetcher.mock.calls.filter(([, request]) => request?.method === 'PUT');
    expect(writes).toHaveLength(2);
    for (const [path, request] of writes) {
      expect(path).toBe(`${base}/meetings/${meetingId}/bookmark`);
      expect(request).toMatchObject({ credentials: 'include' });
      expect(JSON.parse(String(request?.body))).toEqual({ favorite: true, expectedVersion: 0 });
      expect(new Headers(request?.headers).get('Idempotency-Key')).toBe(commandId);
      expect(new Headers(request?.headers).get('X-XSRF-TOKEN')).toBe('csrf-token');
    }
  });

  it('accepts an advanced authorized current state on replay rather than reapplying the old desired flag', async () => {
    const current = { ...savedBookmark(), favorite: false, version: 4 };
    stubResponse({ ...current, tenantId: 7, title: 'not state' });
    await expect(setVideoMeetingRecordBookmark(meetingId, true, 0, commandId)).resolves.toEqual(
      current
    );
  });

  it('removes a favorite using the same versioned boolean contract', async () => {
    const current = { ...savedBookmark(), favorite: false, version: 2 };
    const fetcher = stubResponse(current);
    await expect(setVideoMeetingRecordBookmark(meetingId, false, 1, commandId)).resolves.toEqual(
      current
    );
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toEqual({
      favorite: false,
      expectedVersion: 1,
    });
  });

  it.each([0, 1, 2])('rejects a nonadvancing response version %i', async (version) => {
    stubResponse(version === 0 ? emptyBookmark() : { ...savedBookmark(), version });
    await expect(setVideoMeetingRecordBookmark(meetingId, false, 2, commandId)).rejects.toThrow(
      'mutation version did not advance'
    );
  });

  it.each([
    { meetingId: 'wrong' },
    { idempotencyKey: 'unstable' },
    { idempotencyKey: `${commandId}\r\nInjected: true` },
    { favorite: 'false' },
    { expectedVersion: -1 },
    { expectedVersion: 1.5 },
    { expectedVersion: '1' },
    { expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects invalid command input %# before even requesting CSRF', async (patch) => {
    const fetcher = stubResponse(savedBookmark());
    const input = {
      meetingId,
      favorite: true,
      expectedVersion: 0,
      idempotencyKey: commandId,
      ...patch,
    };
    await expect(
      setVideoMeetingRecordBookmark(
        input.meetingId,
        input.favorite as boolean,
        input.expectedVersion as number,
        input.idempotencyKey
      )
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe.each(['GET', 'PUT'] as const)('%s bookmark cancellation transport', (method) => {
  it('propagates caller abort to the actual fetch signal without retry or a successful projection', async () => {
    const caller = new AbortController();
    let transportSignal: AbortSignal | null | undefined;
    const fetcher = vi.fn(async (path: string, request?: RequestInit) => {
      if (path === csrfPath) return response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' });
      transportSignal = request?.signal;
      return new Promise<Response>((_resolve, reject) => {
        transportSignal?.addEventListener(
          'abort',
          () => reject(new DOMException('Cancelled', 'AbortError')),
          { once: true }
        );
      });
    });
    vi.stubGlobal('fetch', fetcher);
    const pending =
      method === 'GET'
        ? getVideoMeetingRecordBookmarks([meetingId], caller.signal)
        : setVideoMeetingRecordBookmark(meetingId, true, 0, commandId, caller.signal);
    const rejected = expect(pending).rejects.toMatchObject({ reason: 'ABORT' });
    await vi.waitFor(() => expect(transportSignal).toBeDefined());
    expect(transportSignal?.aborted).toBe(false);
    caller.abort('scope-changed');
    await rejected;
    expect(transportSignal?.aborted).toBe(true);
    expect(transportSignal?.reason).toBe('scope-changed');
    expect(fetcher.mock.calls.filter(([path]) => path !== csrfPath)).toHaveLength(1);
  });
});
