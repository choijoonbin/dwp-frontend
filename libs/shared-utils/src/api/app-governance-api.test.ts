import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { setTenantId } from '../tenant-util';
import {
  activateAppAdminPresetAssignment,
  createAppAdminPresetSelfServiceRequest,
  createAppAdminPresetAssignment,
  decideAppAdminPresetAssignment,
  decideAppAdminPresetReview,
  getAppAdminPresetSelfServiceOptions,
  revokeAppAdminPresetAssignment,
  type AppAdminPresetAssignment,
  type AppAdminPresetReview,
} from './app-governance-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('app administrator preset API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('keeps request, independent decision, activation, revoke, and backfill review on governed endpoints', async () => {
    setTenantId('11');
    const assignment = {
      presetAssignmentId: 'preset-1',
      version: 4,
    } as AppAdminPresetAssignment;
    const review = { reviewId: 'review-1', version: 7 } as AppAdminPresetReview;
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse(assignment))
      .mockResolvedValueOnce(jsonResponse({ ...assignment, version: 5 }))
      .mockResolvedValueOnce(jsonResponse({ ...assignment, version: 6 }))
      .mockResolvedValueOnce(jsonResponse({ ...assignment, version: 5 }))
      .mockResolvedValueOnce(jsonResponse({ ...review, version: 8 }));
    vi.stubGlobal('fetch', fetchMock);

    const payload = {
      principalType: 'USER' as const,
      principalRef: '42',
      presetCode: 'APPROVAL_DESIGNER',
      resourceSetId: 'scope-1',
      validTo: '2026-12-31T15:00:00.000Z',
      reviewDueAt: '2026-11-30T15:00:00.000Z',
      justification: 'Owns approval workflow design for the pilot.',
    };
    await createAppAdminPresetAssignment(payload);
    await decideAppAdminPresetAssignment(assignment, 'APPROVED', 'Independently verified.');
    await activateAppAdminPresetAssignment(assignment, 'Independent fulfilment verified.');
    await revokeAppAdminPresetAssignment(assignment, 'Administration duty ended.');
    await decideAppAdminPresetReview(review, 'RESOLVED', 'Replaced by a scoped preset.');

    const calls = fetchMock.mock.calls.slice(1);
    expect(calls.map(([url]) => url)).toEqual([
      '/api/auth/admin/access/app-governance/presets/assignments',
      '/api/auth/admin/access/app-governance/presets/assignments/preset-1/decision',
      '/api/auth/admin/access/app-governance/presets/assignments/preset-1/activate',
      '/api/auth/admin/access/app-governance/presets/assignments/preset-1/revoke',
      '/api/auth/admin/access/app-governance/presets/reviews/review-1/decision',
    ]);
    expect(calls.map(([, init]) => (init as RequestInit).method)).toEqual([
      'POST',
      'POST',
      'POST',
      'PATCH',
      'POST',
    ]);
    expect(JSON.parse(String((calls[0]?.[1] as RequestInit).body))).toEqual(payload);
    expect(JSON.parse(String((calls[1]?.[1] as RequestInit).body))).toEqual({
      decision: 'APPROVED',
      reason: 'Independently verified.',
      version: 4,
    });
    expect(JSON.parse(String((calls[2]?.[1] as RequestInit).body))).toEqual({
      reason: 'Independent fulfilment verified.',
      version: 4,
    });
    expect(JSON.parse(String((calls[3]?.[1] as RequestInit).body))).toEqual({
      reason: 'Administration duty ended.',
      version: 4,
    });
    expect(JSON.parse(String((calls[4]?.[1] as RequestInit).body))).toEqual({
      decision: 'RESOLVED',
      reason: 'Replaced by a scoped preset.',
      version: 7,
    });
  });

  it('uses the exact self-service option and idempotent request contracts', async () => {
    setTenantId('11');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(
        jsonResponse({ presetAssignmentId: 'self-service-1', lifecycleState: 'PENDING_APPROVAL' })
      );
    vi.stubGlobal('fetch', fetchMock);

    await getAppAdminPresetSelfServiceOptions('APP.APPROVALS');
    const payload = {
      presetCode: 'APPROVAL_DESIGNER',
      resourceSetId: 'scope-1',
      validTo: '2026-10-01T00:00:00.000Z',
      reviewDueAt: '2026-09-15T00:00:00.000Z',
      justification: 'I need scoped design access for the migration.',
    };
    await createAppAdminPresetSelfServiceRequest(payload, 'app-admin-request-1', 'correlation-1');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/auth/admin/access/app-governance/presets/self-service-options?appResourceKey=APP.APPROVALS'
    );
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('GET');
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/auth/admin/access/app-governance/presets/self-service-requests'
    );
    const request = fetchMock.mock.calls[2]?.[1] as RequestInit;
    expect(request.method).toBe('POST');
    expect(JSON.parse(String(request.body))).toEqual(payload);
    const headers = new Headers(request.headers);
    expect(headers.get('Idempotency-Key')).toBe('app-admin-request-1');
    expect(headers.get('X-Correlation-ID')).toBe('correlation-1');
  });

  it('rejects an invalid self-service idempotency key before transport', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createAppAdminPresetSelfServiceRequest(
        {
          presetCode: 'APPROVAL_DESIGNER',
          resourceSetId: 'scope-1',
          validTo: '2026-10-01T00:00:00.000Z',
          reviewDueAt: '2026-09-15T00:00:00.000Z',
          justification: 'I need scoped design access for the migration.',
        },
        'bad key'
      )
    ).rejects.toThrow('valid idempotency key');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
