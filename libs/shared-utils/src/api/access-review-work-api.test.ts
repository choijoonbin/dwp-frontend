import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { setTenantId } from '../tenant-util';
import {
  ACCESS_REVIEW_WORK_ENDPOINT,
  decideAccessReviewWork,
  getAccessReviewWorkDetail,
  isAccessReviewDecisionSource,
  isExactAccessReviewDecisionReceipt,
} from './access-review-work-api';

import type { AccessReviewWorkDetail } from './access-review-work-api';

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

  it('accepts only the exact owner decision receipt for the reviewed assignment', () => {
    const reviewed: AccessReviewWorkDetail = {
      workItemRef: 'opaque-1',
      campaignName: 'Quarterly access review',
      dueAt: '2026-09-09T00:00:00.000Z',
      subjectUserId: 7,
      subjectDisplayName: 'Reviewer',
      roleId: 9,
      roleCode: 'FINANCE_ADMIN',
      roleName: 'Finance admin',
      accessSourceType: 'DIRECT',
      sourceKey: null,
      privileged: true,
      recommendation: 'REVIEW',
      recommendationReason: 'PRIVILEGED_ROLE',
      decision: 'PENDING',
      remediationState: 'NOT_REQUIRED',
      version: 7,
    };
    const submitted = {
      decision: 'APPROVE' as const,
      reason: '  Access remains required for assigned responsibilities.  ',
      version: reviewed.version,
    };
    const receipt: AccessReviewWorkDetail = {
      ...reviewed,
      decision: submitted.decision,
      decisionReason: submitted.reason.trim(),
      decidedAt: '2026-09-08T00:00:00.000Z',
      version: reviewed.version + 1,
    };

    expect(isExactAccessReviewDecisionReceipt(receipt, reviewed, submitted)).toBe(true);
    for (const mismatch of [
      { ...receipt, workItemRef: 'another-ref' },
      { ...receipt, subjectUserId: 8 },
      { ...receipt, roleId: 10 },
      { ...receipt, accessSourceType: 'GROUP' as const },
      { ...receipt, sourceKey: 'another-source' },
      { ...receipt, decision: 'REVOKE' as const },
      { ...receipt, decisionReason: 'A different reason was returned.' },
      { ...receipt, version: reviewed.version },
      { ...receipt, version: reviewed.version + 2 },
      { ...receipt, remediationState: 'PENDING' as const },
      { ...receipt, decidedAt: null },
      { ...receipt, decidedAt: 'invalid' },
      { ...receipt, decidedAt: '2026-09-08' },
      { ...receipt, decidedAt: '1' },
    ]) {
      expect(isExactAccessReviewDecisionReceipt(mismatch, reviewed, submitted)).toBe(false);
    }
  });

  it('requires the decision-specific remediation state', () => {
    const reviewed = {
      workItemRef: 'opaque-group',
      subjectUserId: 7,
      roleId: 9,
      accessSourceType: 'GROUP',
      sourceKey: 'finance-reviewers',
      decision: 'PENDING',
      version: 2,
    } as const;
    const submitted = {
      decision: 'REVOKE' as const,
      reason: 'Group-owned access requires manual remediation.',
      version: 2,
    };
    const receipt = {
      ...reviewed,
      decision: 'REVOKE',
      decisionReason: submitted.reason,
      decidedAt: '2026-09-08T00:00:00.000Z',
      remediationState: 'MANUAL_REQUIRED',
      version: 3,
    };

    expect(isExactAccessReviewDecisionReceipt(receipt, reviewed, submitted)).toBe(true);
    const directReviewed = { ...reviewed, accessSourceType: 'DIRECT' as const, sourceKey: null };
    expect(
      isExactAccessReviewDecisionReceipt(
        {
          ...receipt,
          ...directReviewed,
          decision: 'REVOKE',
          remediationState: 'PENDING',
          version: 3,
        },
        directReviewed,
        submitted
      )
    ).toBe(true);
    expect(
      isExactAccessReviewDecisionReceipt(
        { ...receipt, remediationState: 'PENDING' },
        reviewed,
        submitted
      )
    ).toBe(false);
    expect(
      isExactAccessReviewDecisionReceipt(
        { ...receipt, sourceKey: 'another-group' },
        reviewed,
        submitted
      )
    ).toBe(false);

    for (const malformedReviewed of [
      { ...reviewed, subjectUserId: Number.NaN },
      { ...reviewed, roleId: 0 },
      { ...reviewed, accessSourceType: 'TEAM' },
      { ...reviewed, sourceKey: '' },
    ]) {
      expect(
        isExactAccessReviewDecisionReceipt(receipt, malformedReviewed as typeof reviewed, submitted)
      ).toBe(false);
    }
  });

  it('rejects malformed decision source authority before an owner mutation is dispatched', () => {
    const reviewed = {
      workItemRef: 'opaque-ref',
      subjectUserId: 7,
      roleId: 9,
      accessSourceType: 'DIRECT',
      sourceKey: null,
      decision: 'PENDING',
      version: 0,
    };
    expect(isAccessReviewDecisionSource(reviewed)).toBe(true);
    for (const malformed of [
      null,
      [],
      { ...reviewed, workItemRef: ' ' },
      { ...reviewed, subjectUserId: 0 },
      { ...reviewed, roleId: Number.NaN },
      { ...reviewed, sourceKey: {} },
      { ...reviewed, accessSourceType: 'GROUP' },
      { ...reviewed, sourceKey: ' ' },
      { ...reviewed, decision: 'APPROVE' },
      { ...reviewed, version: -1 },
      { ...reviewed, version: Number.MAX_SAFE_INTEGER },
    ]) {
      expect(isAccessReviewDecisionSource(malformed)).toBe(false);
    }
  });

  it('loads reviewer evidence only through an encoded opaque Work reference', async () => {
    setTenantId('11');
    const detail = { workItemRef: 'work/ref', version: 3 };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data: detail }));
    vi.stubGlobal('fetch', fetchMock);

    const controller = new AbortController();
    await expect(getAccessReviewWorkDetail('work/ref', controller.signal)).resolves.toEqual(detail);

    expect(fetchMock.mock.calls[0]?.[0]).toBe(`${ACCESS_REVIEW_WORK_ENDPOINT}/work%2Fref`);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', body: undefined });
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
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

    const controller = new AbortController();
    await decideAccessReviewWork(
      'opaque-1',
      {
        decision: 'REVOKE',
        reason: 'The assignment is no longer required.',
        version: 7,
      },
      controller.signal
    );

    expect(fetchMock.mock.calls[1]?.[0]).toBe(`${ACCESS_REVIEW_WORK_ENDPOINT}/opaque-1/decision`);
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      decision: 'REVOKE',
      reason: 'The assignment is no longer required.',
      version: 7,
    });
    expect(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)).not.toContain('campaignId');
    expect(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)).not.toContain('itemId');
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('propagates caller cancellation through detail and decision network requests', async () => {
    setTenantId('11');
    let detailSignal: AbortSignal | undefined;
    const detailFetch = vi.fn((_url: string, init: RequestInit) => {
      detailSignal = init.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        detailSignal?.addEventListener(
          'abort',
          () => reject(new DOMException('cancelled', 'AbortError')),
          { once: true }
        );
      });
    });
    vi.stubGlobal('fetch', detailFetch);
    const detailController = new AbortController();
    const detailRequest = getAccessReviewWorkDetail('opaque-1', detailController.signal);

    expect(detailSignal?.aborted).toBe(false);
    detailController.abort();
    expect(detailSignal?.aborted).toBe(true);
    await expect(detailRequest).rejects.toMatchObject({ reason: 'ABORT' });

    resetCsrfToken();
    let decisionSignal: AbortSignal | undefined;
    const decisionFetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        decisionSignal = init.signal as AbortSignal;
        return new Promise<Response>((_resolve, reject) => {
          decisionSignal?.addEventListener(
            'abort',
            () => reject(new DOMException('cancelled', 'AbortError')),
            { once: true }
          );
        });
      });
    vi.stubGlobal('fetch', decisionFetch);
    const decisionController = new AbortController();
    const decisionRequest = decideAccessReviewWork(
      'opaque-1',
      { decision: 'APPROVE', reason: 'The assignment remains required.', version: 3 },
      decisionController.signal
    );
    await vi.waitFor(() => expect(decisionFetch).toHaveBeenCalledTimes(2));

    expect(decisionSignal?.aborted).toBe(false);
    decisionController.abort();
    expect(decisionSignal?.aborted).toBe(true);
    await expect(decisionRequest).rejects.toMatchObject({ reason: 'ABORT' });
  });
});
