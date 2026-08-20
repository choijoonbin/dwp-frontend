import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import {
  getWorkplaceGovernancePolicyOverrides,
  getWorkplaceGovernanceFloorPlanRevisionSnapshot,
  previewWorkplaceGovernancePolicy,
  saveWorkplaceGovernanceAccessRule,
  saveWorkplaceGovernancePolicyOverride,
  submitWorkplaceGovernanceFloorPlanReview,
  uploadWorkplaceGovernanceFloorPlanBackground,
} from './workplace-governance-api';

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ data }),
  } as Response;
}

describe('Workplace governance API boundary', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('encodes policy scope identifiers through the Gateway boundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ effectivePolicy: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await previewWorkplaceGovernancePolicy('FLOOR', 'floor/12');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/v1/admin/workplace/governance/policy-preview?scopeType=FLOOR&scopeId=floor%2F12',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('scopes delegated policy override reads and creates at the Gateway boundary', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ policyOverrideId: 'override-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await getWorkplaceGovernancePolicyOverrides('SITE', 'site/1');
    await saveWorkplaceGovernancePolicyOverride(null, {
      scopeType: 'SITE',
      scopeId: 'site/1',
      policyPatch: { bookingWindowDays: 14 },
      state: 'ACTIVE',
      version: null,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/platform/v1/admin/workplace/governance/policy-overrides?scopeType=SITE&scopeId=site%2F1'
    );
    expect(fetchMock.mock.calls[2]?.[0]).toBe(
      '/api/platform/v1/admin/workplace/governance/policy-overrides?scopeType=SITE&scopeId=site%2F1'
    );
  });

  it('preserves deny-first access rule attributes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ accessRuleId: 'rule-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await saveWorkplaceGovernanceAccessRule('site-1', null, {
      subjectType: 'GROUP_REF',
      subjectUserId: null,
      subjectGroupRef: '52bdc100-b924-4b5c-bff4-1da349f3d359',
      permission: 'MANAGE',
      effect: 'DENY',
      validFrom: null,
      validUntil: null,
      state: 'ACTIVE',
      version: null,
    });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/admin/workplace/governance/sites/site-1/access-rules'
    );
    expect(JSON.parse(String(request.body))).toMatchObject({
      subjectType: 'GROUP_REF',
      effect: 'DENY',
      permission: 'MANAGE',
    });
  });

  it('sends optimistic version and reason for floor-plan transitions', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ revisionId: 'revision-1', state: 'REVIEW' }));
    vi.stubGlobal('fetch', fetchMock);

    await submitWorkplaceGovernanceFloorPlanReview('revision-1', 7, 'Operations review');

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/admin/workplace/governance/floor-plan-revisions/revision-1/review'
    );
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      version: 7,
      reason: 'Operations review',
    });
  });

  it('loads a persisted draft snapshot through the scoped governance route', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ revision: { revisionId: 'revision-1' }, placements: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await getWorkplaceGovernanceFloorPlanRevisionSnapshot('revision/1');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/platform/v1/admin/workplace/governance/floor-plan-revisions/revision%2F1/snapshot',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );
  });

  it('uploads immutable draft media with an observed revision version', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValueOnce(jsonResponse({ revisionId: 'revision-1', version: 8 }));
    vi.stubGlobal('fetch', fetchMock);
    const file = new File([new Uint8Array([1, 2, 3])], 'floor plan.png', {
      type: 'image/png',
    });

    await uploadWorkplaceGovernanceFloorPlanBackground(
      'revision/1',
      7,
      'Updated evacuation routes',
      file
    );

    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      '/api/platform/v1/admin/workplace/governance/floor-plan-revisions/revision%2F1/background?version=7&changeSummary=Updated+evacuation+routes'
    );
    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(request.method).toBe('POST');
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get('file')).toBe(file);
  });
});
