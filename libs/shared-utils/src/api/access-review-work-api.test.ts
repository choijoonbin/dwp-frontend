import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { setTenantId } from '../tenant-util';
import {
  ACCESS_REVIEW_WORK_ENDPOINT,
  decideAccessReviewWork,
  getAccessReviewWorkDetail,
} from './access-review-work-api';

function jsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
  } as Response;
}

describe('access review Work API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('loads reviewer evidence only through an encoded opaque Work reference', async () => {
    setTenantId('11');
    const detail = { workItemRef: 'work/ref', version: 3 };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data: detail }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getAccessReviewWorkDetail('work/ref')).resolves.toEqual(detail);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${ACCESS_REVIEW_WORK_ENDPOINT}/work%2Fref`);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', body: undefined });
  });

  it('submits the expected version to the exact non-admin decision endpoint', async () => {
    setTenantId('11');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(jsonResponse({ data: { workItemRef: 'opaque-1', version: 8 } }));
    vi.stubGlobal('fetch', fetchMock);

    await decideAccessReviewWork('opaque-1', {
      decision: 'REVOKE',
      reason: 'The assignment is no longer required.',
      version: 7,
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${ACCESS_REVIEW_WORK_ENDPOINT}/opaque-1/decision`);
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      decision: 'REVOKE',
      reason: 'The assignment is no longer required.',
      version: 7,
    });
    expect(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)).not.toContain('campaignId');
    expect(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)).not.toContain('itemId');
  });
});
