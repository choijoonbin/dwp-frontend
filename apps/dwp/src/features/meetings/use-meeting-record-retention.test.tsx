// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';
import type { MeetingRecordRetention } from '@dwp-frontend/shared-utils/api/video-meeting-record-retention-api';

const api = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock('@dwp-frontend/shared-utils/api/video-meeting-record-retention-api', () => ({
  getMeetingRecordRetention: api.read,
  updateMeetingRecordRetention: api.write,
}));
import { useMeetingRecordRetention } from './use-meeting-record-retention';

const id = 'a1000000-0000-4000-8000-000000000001';
const other = 'a1000000-0000-4000-8000-000000000002';
const record: MeetingRecordRetention = {
  meetingId: id,
  meetingVersion: 4,
  policyVersion: 2,
  controlVersion: 0,
  retentionUntil: '2026-09-01T00:00:00Z',
  hold: false,
  purgeAuthorized: false,
  state: 'UNCONFIGURED',
  reasons: ['AUTHORIZATION_AUDIT_NOT_PUBLISHED'],
  authorizationAuditPublished: false,
  workerEnabled: false,
  purgedAt: null,
};
const saved = { ...record, controlVersion: 1, purgeAuthorized: true };
let state: ReturnType<typeof useMeetingRecordRetention>;
let root: Root | null;
let node: HTMLDivElement;
function Harness({ canManage = true }: { canManage?: boolean }) {
  state = useMeetingRecordRetention(canManage);
  return null;
}
async function render(canManage = true) {
  await act(async () => root!.render(createElement(Harness, { canManage })));
}
async function invoke(command: () => void) {
  await act(async () => command());
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  api.read.mockReset().mockResolvedValue(record);
  api.write.mockReset().mockResolvedValue(saved);
  node = document.createElement('div');
  document.body.appendChild(node);
  root = createRoot(node);
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  node.remove();
});

describe('record retention administrative command lifecycle', () => {
  it('starts empty, reads only on demand, and exposes every unconfigured reason', async () => {
    await render();
    expect(state.phase).toBe('idle');
    expect(state.data).toBeNull();
    expect(api.read).not.toHaveBeenCalled();
    await invoke(() => state.load(id));
    expect(state.phase).toBe('ready');
    expect(state.data).toEqual(record);
    expect(api.read).toHaveBeenCalledWith(id, expect.any(AbortSignal));
  });

  it('waits for the durable mutation projection and submits current CAS only once', async () => {
    const pending = deferred<MeetingRecordRetention>();
    api.write.mockReturnValue(pending.promise);
    await render();
    await invoke(() => state.load(id));
    await invoke(() => {
      state.update(record, false, true);
      state.update(record, false, true);
    });
    expect(api.write).toHaveBeenCalledTimes(1);
    expect(api.write).toHaveBeenCalledWith(
      id,
      {
        expectedMeetingVersion: 4,
        expectedPolicyVersion: 2,
        expectedControlVersion: 0,
        hold: false,
        purgeAuthorized: true,
      },
      expect.stringMatching(/^[0-9a-f-]{36}$/u),
      expect.any(AbortSignal)
    );
    expect(state.phase).toBe('saving');
    expect(state.data).toBeNull();
    expect(state.busy).toBe(true);
    await invoke(() => pending.resolve(saved));
    expect(state.data).toEqual(saved);
    expect(state.phase).toBe('ready');
  });

  it('retries an uncertain mutation with exactly the same key, meeting and body', async () => {
    api.write.mockRejectedValueOnce(new Error('connection interrupted'));
    await render();
    await invoke(() => state.load(id));
    await invoke(() => state.update(record, false, true));
    expect(state.phase).toBe('uncertain');
    expect(state.data).toBeNull();
    await invoke(() => {
      state.load(other);
      state.update(record, true, false);
    });
    expect(api.read).toHaveBeenCalledTimes(1);
    expect(api.write).toHaveBeenCalledTimes(1);
    await invoke(() => state.retry());
    expect(api.write).toHaveBeenCalledTimes(2);
    expect(api.write.mock.calls[1].slice(0, 3)).toEqual(api.write.mock.calls[0].slice(0, 3));
    expect(state.phase).toBe('ready');
    expect(state.data).toEqual(saved);
  });

  it('accepts the current server hold returned by an idempotent retry', async () => {
    const current = {
      ...saved,
      controlVersion: 3,
      hold: true,
      purgeAuthorized: false,
      state: 'HELD' as const,
    };
    api.write.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(current);
    await render();
    await invoke(() => state.load(id));
    await invoke(() => state.update(record, false, true));
    await invoke(() => state.retry());
    expect(state.data).toEqual(current);
    expect(state.data?.purgeAuthorized).toBe(false);
  });

  it.each([401, 403, 404, 410])(
    'clears all previous metadata and retry evidence on mutation HTTP %i',
    async (status) => {
      api.write.mockRejectedValue(new HttpError('authority denied', status));
      await render();
      await invoke(() => state.load(id));
      await invoke(() => state.update(record, false, true));
      expect(state.phase).toBe('denied');
      expect(state.data).toBeNull();
      await invoke(() => state.retry());
      expect(api.write).toHaveBeenCalledTimes(1);
    }
  );

  it('clears the previous record while loading and after a 403 refresh', async () => {
    const pending = deferred<MeetingRecordRetention>();
    await render();
    await invoke(() => state.load(id));
    api.read.mockReturnValue(pending.promise);
    await invoke(() => state.load(id));
    expect(state.phase).toBe('loading');
    expect(state.data).toBeNull();
    await invoke(() => pending.reject(new HttpError('revoked', 403)));
    expect(state.phase).toBe('denied');
    expect(state.data).toBeNull();
  });

  it.each([400, 409, 422])(
    'requires a fresh snapshot after definite command HTTP %i',
    async (status) => {
      api.write.mockRejectedValueOnce(new HttpError('stale control', status));
      await render();
      await invoke(() => state.load(id));
      await invoke(() => state.update(record, false, true));
      expect(state.phase).toBe('conflict');
      expect(state.data).toBeNull();
      await invoke(() => state.retry());
      expect(api.write).toHaveBeenCalledTimes(1);
      api.read.mockResolvedValue(saved);
      await invoke(() => state.load(id));
      await invoke(() => state.update(saved, true, false));
      expect(api.write.mock.calls[1][1].expectedControlVersion).toBe(1);
      expect(api.write.mock.calls[1][2]).not.toBe(api.write.mock.calls[0][2]);
    }
  );

  it('does not approve using a copied/stale snapshot or a purged tombstone', async () => {
    await render();
    await invoke(() => state.load(id));
    await invoke(() => state.update({ ...record }, false, true));
    const purged = { ...saved, state: 'PURGED' as const, purgedAt: '2026-09-07T09:00:00Z' };
    api.read.mockResolvedValue(purged);
    await invoke(() => state.load(id));
    await invoke(() => state.update(purged, true, false));
    expect(api.write).not.toHaveBeenCalled();
  });

  it('allows view-only reads but never starts or retries a command without manage authority', async () => {
    await render(false);
    await invoke(() => state.load(id));
    await invoke(() => state.update(record, false, true));
    await invoke(() => state.retry());
    expect(api.read).toHaveBeenCalledTimes(1);
    expect(api.write).not.toHaveBeenCalled();
    await render(true);
    api.write.mockRejectedValueOnce(new Error('uncertain'));
    await invoke(() => state.update(record, false, true));
    await render(false);
    await invoke(() => state.retry());
    expect(api.write).toHaveBeenCalledTimes(1);
  });

  it('aborts a reset record read and rejects its late success over the new record', async () => {
    const old = deferred<MeetingRecordRetention>();
    api.read
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce({ ...record, meetingId: other });
    await render();
    await invoke(() => state.load(id));
    const signal = api.read.mock.calls[0][1] as AbortSignal;
    await invoke(() => state.reset());
    expect(signal.aborted).toBe(true);
    expect(state.phase).toBe('idle');
    await invoke(() => state.load(other));
    await invoke(() => old.resolve(record));
    expect(state.data?.meetingId).toBe(other);
    expect(state.phase).toBe('ready');
  });

  it('rejects old mutation completion after reset and a newer 403 denial', async () => {
    const old = deferred<MeetingRecordRetention>();
    api.write.mockReturnValue(old.promise);
    await render();
    await invoke(() => state.load(id));
    await invoke(() => state.update(record, false, true));
    const signal = api.write.mock.calls[0][3] as AbortSignal;
    await invoke(() => state.reset());
    expect(signal.aborted).toBe(true);
    api.read.mockRejectedValue(new HttpError('revoked', 403));
    await invoke(() => state.load(id));
    await invoke(() => old.resolve(saved));
    expect(state.phase).toBe('denied');
    expect(state.data).toBeNull();
  });

  it.each(['read', 'write'] as const)(
    'aborts an in-flight %s on unmount and ignores late completion',
    async (kind) => {
      const pending = deferred<MeetingRecordRetention>();
      await render();
      if (kind === 'read') api.read.mockReturnValue(pending.promise);
      await invoke(() => state.load(id));
      if (kind === 'write') {
        api.write.mockReturnValue(pending.promise);
        await invoke(() => state.update(record, false, true));
      }
      const signal =
        kind === 'read'
          ? (api.read.mock.calls[0][1] as AbortSignal)
          : (api.write.mock.calls[0][3] as AbortSignal);
      const previous = state;
      await act(async () => root!.unmount());
      root = null;
      expect(signal.aborted).toBe(true);
      await invoke(() => pending.resolve(saved));
      expect(state).toBe(previous);
    }
  );
});
