import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  getMeetingRecordRetention,
  meetingRecordReference,
  updateMeetingRecordRetention,
  type MeetingRecordRetention,
  type MeetingRecordRetentionCommand,
} from './video-meeting-record-retention-api';

const id = 'a1000000-0000-4000-8000-000000000001';
const other = 'a1000000-0000-4000-8000-000000000002';
const commandId = 'a2000000-0000-4000-8000-000000000001';
const csrfPath = '/api/auth/csrf';
const path = `/api/meetings/v1/admin/record-retention/meetings/${id}`;
const input: MeetingRecordRetentionCommand = {
  expectedMeetingVersion: 4,
  expectedPolicyVersion: 2,
  expectedControlVersion: 0,
  hold: false,
  purgeAuthorized: true,
};
const control = (patch: Partial<MeetingRecordRetention> = {}): MeetingRecordRetention => ({
  meetingId: id,
  meetingVersion: 4,
  policyVersion: 2,
  controlVersion: 1,
  retentionUntil: '2026-09-01T00:00:00Z',
  hold: false,
  purgeAuthorized: true,
  state: 'UNCONFIGURED',
  reasons: ['AUTHORIZATION_AUDIT_NOT_PUBLISHED'],
  authorizationAuditPublished: false,
  workerEnabled: false,
  purgedAt: null,
  ...patch,
});
function response(data: unknown, status = 200): Response {
  return {
    ok: status < 400,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}
function stub(data: unknown, status = 200) {
  const fetcher = vi.fn(async (url: string, _request?: RequestInit) =>
    url === csrfPath
      ? response({ token: 'csrf-fixture', headerName: 'X-XSRF-TOKEN' })
      : response(data, status)
  );
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
});

describe('record retention public API', () => {
  it('normalizes a canonical UUID and sends no guessed tenant, actor or query parameters', async () => {
    const fetcher = stub(control());
    expect(meetingRecordReference(id.toUpperCase())).toBe(id);
    await expect(getMeetingRecordRetention(id.toUpperCase())).resolves.toEqual(control());
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe(path);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: 'GET', credentials: 'include' });
    expect(fetcher.mock.calls[0][1]?.body).toBeUndefined();
  });

  it.each(['', 'private-title', `${id}?tenantId=2`, `${id}/purge`, ` ${id}`, `${id}\n`, null, 1])(
    'rejects malformed meeting or command references %# before any network access',
    async (value) => {
      const fetcher = stub(control());
      expect(meetingRecordReference(value as string)).toBeNull();
      await expect(getMeetingRecordRetention(value as string)).rejects.toThrow(/reference/u);
      await expect(updateMeetingRecordRetention(id, input, value as string)).rejects.toThrow(
        /reference/u
      );
      expect(fetcher).not.toHaveBeenCalled();
    }
  );

  it('projects only administrative metadata and preserves all unconfigured reasons', async () => {
    stub({
      ...control(),
      title: 'private title',
      actor: 'private@example.invalid',
      objectKey: 'secret/path',
    });
    await expect(getMeetingRecordRetention(id)).resolves.toEqual(control());
  });

  it.each([
    control({ controlVersion: 0, purgeAuthorized: false }),
    control(),
    control({ state: 'HELD', hold: true, purgeAuthorized: false, reasons: ['RECORD_LEGAL_HOLD'] }),
    control({ state: 'AWAITING_AUTHORIZATION', workerEnabled: true, purgeAuthorized: false }),
    control({ state: 'BLOCKED', workerEnabled: true }),
    control({
      state: 'ELIGIBLE',
      workerEnabled: true,
      authorizationAuditPublished: true,
      reasons: [],
    }),
    control({
      state: 'PURGED',
      authorizationAuditPublished: true,
      reasons: [],
      purgedAt: '2026-09-07T09:00:00+09:00',
    }),
    control({ retentionUntil: '2026-09-01T09:00:00.123456789+09:00' }),
    control({ retentionUntil: '2024-02-29T00:00:00Z' }),
  ])('accepts actual BE state and offset timestamp projection %#', async (value) => {
    stub(value);
    await expect(getMeetingRecordRetention(id)).resolves.toEqual(value);
  });

  const invalid = [
    null,
    {},
    control({ meetingId: other }),
    control({ meetingVersion: -1 }),
    control({ policyVersion: 1.5 }),
    control({ controlVersion: Number.MAX_SAFE_INTEGER + 1 }),
    { ...control(), meetingVersion: '4' },
    { ...control(), hold: 'false' },
    { ...control(), purgeAuthorized: 1 },
    { ...control(), workerEnabled: undefined },
    { ...control(), authorizationAuditPublished: null },
    control({ hold: true, purgeAuthorized: true }),
    { ...control(), state: 'GUESS_READY' },
    { ...control(), reasons: 'PRIVATE TITLE' },
    control({ reasons: ['Private title'] }),
    control({ reasons: Array(65).fill('BLOCKED') }),
    control({ reasons: ['A'.repeat(97)] }),
    { ...control(), reasons: [null] },
    control({ retentionUntil: 'tomorrow' }),
    control({ retentionUntil: '2026-09-01T00:00:00' }),
    control({ retentionUntil: '2026-02-30T00:00:00Z' }),
    { ...control(), purgedAt: undefined },
    control({ purgedAt: '2026-09-07T09:00:00Z' }),
    control({ state: 'PURGED', purgedAt: null }),
    control({ state: 'HELD', hold: false }),
    control({ state: 'UNCONFIGURED', workerEnabled: true }),
    control({ state: 'AWAITING_AUTHORIZATION', workerEnabled: true, purgeAuthorized: true }),
    control({ state: 'BLOCKED', workerEnabled: true, reasons: [] }),
    control({
      state: 'ELIGIBLE',
      workerEnabled: false,
      authorizationAuditPublished: true,
      reasons: [],
    }),
    control({
      state: 'ELIGIBLE',
      workerEnabled: true,
      purgeAuthorized: false,
      authorizationAuditPublished: true,
      reasons: [],
    }),
    control({
      state: 'ELIGIBLE',
      workerEnabled: true,
      authorizationAuditPublished: false,
      reasons: [],
    }),
    control({
      state: 'ELIGIBLE',
      workerEnabled: true,
      authorizationAuditPublished: true,
      reasons: ['REPORT_LEGAL_HOLD'],
    }),
    control({ controlVersion: 0, purgeAuthorized: true }),
    control({ controlVersion: 0, purgeAuthorized: false, authorizationAuditPublished: true }),
    control({
      state: 'PURGED',
      purgeAuthorized: false,
      authorizationAuditPublished: true,
      reasons: [],
      purgedAt: '2026-09-07T09:00:00Z',
    }),
    control({
      state: 'PURGED',
      authorizationAuditPublished: true,
      reasons: [],
      purgedAt: '2026-08-01T09:00:00Z',
    }),
  ];
  describe.each(['GET', 'PUT'] as const)('%s fail-closed projection', (method) => {
    it.each(invalid)(
      'rejects malformed, substituted or contradictory metadata %#',
      async (value) => {
        stub(value);
        const operation =
          method === 'GET'
            ? getMeetingRecordRetention(id)
            : updateMeetingRecordRetention(id, input, commandId);
        await expect(operation).rejects.toThrow(/retention/u);
      }
    );
    it.each([401, 403, 404, 409, 503])(
      'preserves HTTP %i without manufacturing approval',
      async (status) => {
        stub(null, status);
        const operation =
          method === 'GET'
            ? getMeetingRecordRetention(id)
            : updateMeetingRecordRetention(id, input, commandId);
        await expect(operation).rejects.toMatchObject({ status });
      }
    );
  });

  it('sends exactly five CAS fields, CSRF and the unchanged idempotency key across replay', async () => {
    const fetcher = stub(control());
    for (let count = 0; count < 2; count += 1)
      await updateMeetingRecordRetention(
        id,
        { ...input, actor: 'must-not-leave-client' } as MeetingRecordRetentionCommand,
        commandId
      );
    const writes = fetcher.mock.calls.filter(([, request]) => request?.method === 'PUT');
    expect(writes).toHaveLength(2);
    for (const [url, request] of writes) {
      expect(url).toBe(path);
      expect(JSON.parse(String(request?.body))).toEqual(input);
      expect(new Headers(request?.headers).get('Idempotency-Key')).toBe(commandId);
      expect(new Headers(request?.headers).get('X-XSRF-TOKEN')).toBe('csrf-fixture');
    }
  });

  it('accepts a later current hold on replay instead of restoring the older approval', async () => {
    const held = control({
      controlVersion: 4,
      state: 'HELD',
      hold: true,
      purgeAuthorized: false,
      reasons: ['RECORD_LEGAL_HOLD'],
    });
    stub(held);
    await expect(updateMeetingRecordRetention(id, input, commandId)).resolves.toEqual(held);
  });

  it('rejects a response whose control version did not advance', async () => {
    stub(control());
    await expect(
      updateMeetingRecordRetention(id, { ...input, expectedControlVersion: 1 }, commandId)
    ).rejects.toThrow(/did not advance/u);
  });

  it.each([
    null,
    { ...input, expectedMeetingVersion: -1 },
    { ...input, expectedPolicyVersion: 0.5 },
    { ...input, expectedControlVersion: '0' },
    { ...input, expectedControlVersion: Number.MAX_SAFE_INTEGER + 1 },
    { ...input, hold: 'false' },
    { ...input, purgeAuthorized: undefined },
    { ...input, hold: true },
  ])('rejects invalid command %# before CSRF or mutation requests', async (value) => {
    const fetcher = stub(control());
    await expect(
      updateMeetingRecordRetention(id, value as MeetingRecordRetentionCommand, commandId)
    ).rejects.toThrow(/command/u);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('propagates cancellation to the actual request without returning a stale projection', async () => {
    let sentSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, request?: RequestInit) =>
          new Promise((_resolve, reject) => {
            sentSignal = request?.signal as AbortSignal;
            sentSignal.addEventListener(
              'abort',
              () => reject(new DOMException('Aborted', 'AbortError')),
              { once: true }
            );
          })
      )
    );
    const abort = new AbortController();
    const result = getMeetingRecordRetention(id, abort.signal);
    await vi.waitFor(() => expect(sentSignal).toBeDefined());
    abort.abort();
    await expect(result).rejects.toMatchObject({ name: 'HttpTransportError', reason: 'ABORT' });
    expect(sentSignal?.aborted).toBe(true);
  });
});
