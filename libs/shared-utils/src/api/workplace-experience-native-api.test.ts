import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import { HttpError } from '../http-error';
import {
  getWorkplaceFutureBookingImpact,
  getWorkplacePolicyImpact,
} from './workplace-experience-report-api';
import {
  createWorkplaceResourceClosure,
  createWorkplaceFacilityRequest,
  changeWorkplaceFacilityRequestStatus,
} from './workplace-experience-facilities-api';
import {
  applyWorkplaceBookingPolicyChange,
  applyWorkplacePolicyOverrideChange,
  getWorkplaceResourcePhoto,
  getWorkplaceResourcePhotoMetadata,
  saveWorkplaceConnector,
  uploadWorkplaceResourcePhoto,
} from './workplace-collaboration-api';
import type { WorkplacePolicy } from './workplace-api';

function json(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}
function writes(data: unknown = {}) {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(json({ token: 'csrf', headerName: 'X-XSRF-TOKEN' }))
    .mockResolvedValueOnce(json(data));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
describe('Native Workplace experience gateway contracts', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });
  it('uses current controller impact paths and preserves explicit false and zero filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({}));
    vi.stubGlobal('fetch', fetchMock);
    await getWorkplaceFutureBookingImpact(
      'site/1',
      'resource/1',
      '2026-09-15T00:00:00Z',
      '2026-09-16T00:00:00Z'
    );
    await getWorkplacePolicyImpact({
      siteId: 'site/1',
      from: '2026-09-15',
      to: '2026-09-16',
      requireCheckIn: false,
      autoReleaseMinutes: 0,
    });
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      '/api/platform/v1/admin/workplace/resources/resource%2F1/future-booking-impact?siteId=site%2F1'
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/admin/workplace/policy-impact-preview?siteId=site%2F1&from=2026-09-15&to=2026-09-16&requireCheckIn=false&autoReleaseMinutes=0'
    );
  });
  it('sends reason, confirmation, optimistic version and closure retry key unchanged', async () => {
    const fetchMock = writes();
    const body = {
      startsAt: '2026-09-15T00:00:00Z',
      endsAt: '2026-09-15T01:00:00Z',
      version: 3,
      reason: 'Physical repair',
      confirmed: true,
    };
    await createWorkplaceResourceClosure('site/1', 'resource/1', body, 'closure-key');
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/admin/workplace/experience/facilities/resources/resource%2F1/closures?siteId=site%2F1'
    );
    expect(JSON.parse(String(request.body))).toEqual(body);
    expect(new Headers(request.headers).get('Idempotency-Key')).toBe('closure-key');
  });
  it('keeps member request creation separate from versioned administrator status changes', async () => {
    const fetchMock = writes();
    await createWorkplaceFacilityRequest(
      'resource/1',
      { category: 'REPAIR', description: 'Loose bracket' },
      'request-key'
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/workplace/experience/facilities/resources/resource%2F1/requests'
    );
    expect(
      new Headers((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).get('Idempotency-Key')
    ).toBe('request-key');
    fetchMock.mockResolvedValueOnce(json({}));
    const body = {
      status: 'IN_PROGRESS' as const,
      version: 7,
      reason: 'Engineer assigned',
      confirmed: true,
    };
    await changeWorkplaceFacilityRequestStatus('site/1', 'request/1', body);
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/platform/v1/admin/workplace/experience/facilities/requests/request%2F1/status?siteId=site%2F1'
    );
    expect(JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body))).toEqual(body);
  });
  it('uses atomic policy wrappers with exact scope binding and never retries an uncertain write', async () => {
    const fetchMock = writes();
    const proposed = {
      scopeType: 'ZONE' as const,
      scopeId: 'zone/1',
      policyPatch: { requireCheckIn: false },
      state: 'ACTIVE' as const,
      version: 2,
    };
    const body = { proposed, reason: 'Approved local workflow', confirmed: true };
    await applyWorkplacePolicyOverrideChange('override/1', 'ZONE', 'zone/1', body);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/admin/workplace/experience/collaboration/policy-overrides/override%2F1/changes?scopeType=ZONE&scopeId=zone%2F1'
    );
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual(body);
    fetchMock.mockRejectedValueOnce(new TypeError('Connection closed'));
    await expect(
      applyWorkplaceBookingPolicyChange({
        proposed: { version: 4 } as WorkplacePolicy,
        reason: 'Approved tenant policy',
        confirmed: true,
      })
    ).rejects.toMatchObject({ reason: 'NETWORK' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it('stores a nullable opaque connector reference without inventing connection verification', async () => {
    const fetchMock = writes({ status: 'CONFIGURED_UNVERIFIED', lastVerifiedAt: null });
    const input = {
      provider: 'trusted-adapter',
      enabled: true,
      configurationReference: null,
      version: 0,
      reason: 'Enable native configuration',
      confirmed: true,
    };
    const result = await saveWorkplaceConnector('ACTUAL_PRESENCE', input);
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual(input);
    expect(result.status).toBe('CONFIGURED_UNVERIFIED');
    expect(result.lastVerifiedAt).toBeNull();
  });
  it('preserves photo authorization failures and rejects media newer than its metadata', async () => {
    const blob = new Blob(['actual-photo'], { type: 'image/png' });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(null, 403))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ ETag: '"new-sha"' }),
        blob: async () => blob,
      });
    vi.stubGlobal('fetch', fetchMock);
    await expect(getWorkplaceResourcePhotoMetadata('resource/1')).rejects.toMatchObject({
      status: 403,
    });
    await expect(getWorkplaceResourcePhoto('resource/1', false, 'old-sha')).rejects.toBeInstanceOf(
      HttpError
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/workplace/experience/collaboration/resources/resource%2F1/photo/metadata'
    );
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/workplace/experience/collaboration/resources/resource%2F1/photo'
    );
  });
  it('uploads actual binary photo with independent alt, reason and version fields', async () => {
    const fetchMock = writes();
    const file = new File(['photo-bytes'], 'photo.png', { type: 'image/png' });
    await uploadWorkplaceResourcePhoto(
      'resource/1',
      file,
      12,
      'Update registered photo',
      'South desk entrance'
    );
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const form = request.body as FormData;
    expect(form.get('file')).toBe(file);
    expect(form.get('version')).toBe('12');
    expect(form.get('reason')).toBe('Update registered photo');
    expect(form.get('altText')).toBe('South desk entrance');
    expect(new Headers(request.headers).has('Content-Type')).toBe(false);
  });
});
