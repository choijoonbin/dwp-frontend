import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetCsrfToken } from '../axios-instance';
import { HttpError } from '../http-error';
import { setTenantId } from '../tenant-util';
import {
  evaluateGovernedRouteAccess,
  evaluateProductSurfaceAccess,
  getOidcCallback,
  getProductSurfaceContexts,
  getProductSurfaceStepUpContinuation,
  GOVERNED_ROUTE_EVALUATION_ENDPOINT,
  issueProductSurfaceStepUpChallenge,
  login,
  PRODUCT_SURFACE_CONTEXTS_ENDPOINT,
  PRODUCT_SURFACE_EVALUATION_ENDPOINT,
  PRODUCT_SURFACE_STEP_UP_CHALLENGE_ENDPOINT,
} from './auth-api';

function jsonResponse(payload: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(payload),
    headers: new Headers(headers),
  } as Response;
}

describe('auth login API', () => {
  afterEach(() => {
    resetCsrfToken();
    vi.unstubAllGlobals();
  });

  it('sends company email without the retired username field', async () => {
    setTenantId('default');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { token: 'csrf-token', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(jsonResponse({ data: { userId: '1', tenantId: '1' } }));
    vi.stubGlobal('fetch', fetchMock);

    await login({ email: 'employee@example.com', password: 'Valid-password-1!' });

    const request = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toEqual({
      email: 'employee@example.com',
      password: 'Valid-password-1!',
      tenantId: 'default',
    });
    expect(String(request.body)).not.toContain('username');
  });

  it('calls the exact Gateway context endpoint without client subject inputs', async () => {
    setTenantId('11');
    const data = {
      contractVersion: '1',
      decisionRevision: 'psr-1',
      sourceRevisions: {},
      activeAccessMode: 'NORMAL',
      generatedAt: '2026-08-24T01:00:00Z',
      contexts: [],
      rollouts: [],
    };
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getProductSurfaceContexts()).resolves.toEqual(data);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(PRODUCT_SURFACE_CONTEXTS_ENDPOINT);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', body: undefined });
  });

  it('keeps product and governed direct-evaluation subject unions disjoint', async () => {
    setTenantId('11');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { token: 'csrf-one', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(jsonResponse({ data: { decision: 'ROUTE_DENIED' } }))
      .mockResolvedValueOnce(jsonResponse({ data: { decision: 'ALLOWED' } }));
    vi.stubGlobal('fetch', fetchMock);
    const evaluationController = new AbortController();

    await evaluateProductSurfaceAccess(
      {
        subject: {
          type: 'PRODUCT',
          productKey: 'communications',
          surfaceKey: 'communications.management',
        },
        routeContractKey: 'route.communications.management.content.page',
        contextKey: 'ctx-1',
        contextScopeKey: 'scope-1',
      },
      { signal: evaluationController.signal }
    );
    await evaluateGovernedRouteAccess({
      subject: { type: 'GOVERNED_CONTEXT' },
      navigationContextId: 'work.work',
      routeContractKey: 'route.context.work__work.review-decision.action',
      target: { opaqueTargetRef: 'work-ref', expectedObjectVersion: '7' },
      contextKey: 'governed-ctx-1',
    });

    expect(fetchMock.mock.calls[1]?.[0]).toBe(PRODUCT_SURFACE_EVALUATION_ENDPOINT);
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body))).toEqual({
      subject: {
        type: 'PRODUCT',
        productKey: 'communications',
        surfaceKey: 'communications.management',
      },
      routeContractKey: 'route.communications.management.content.page',
      contextKey: 'ctx-1',
      contextScopeKey: 'scope-1',
    });
    expect(fetchMock.mock.calls[2]?.[0]).toBe(GOVERNED_ROUTE_EVALUATION_ENDPOINT);
    const governedBody = JSON.parse(String((fetchMock.mock.calls[2]?.[1] as RequestInit).body));
    expect(governedBody).toEqual({
      subject: { type: 'GOVERNED_CONTEXT' },
      navigationContextId: 'work.work',
      routeContractKey: 'route.context.work__work.review-decision.action',
      target: { opaqueTargetRef: 'work-ref', expectedObjectVersion: '7' },
      contextKey: 'governed-ctx-1',
    });
    expect(governedBody.subject).not.toHaveProperty('productKey');
    expect(governedBody.subject).not.toHaveProperty('surfaceKey');
  });

  it('posts only the exact server-issued step-up command binding fields', async () => {
    setTenantId('11');
    const issued = {
      state: 'ISSUED' as const,
      challenge: 'signed-opaque-challenge',
      challengeId: 'challenge-1',
      decisionRevision: 'server-current-revision',
      expiresAt: '2026-08-24T01:05:00Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { token: 'csrf-step-up', headerName: 'X-XSRF-TOKEN' } })
      )
      .mockResolvedValueOnce(jsonResponse({ data: issued }));
    vi.stubGlobal('fetch', fetchMock);
    const issuerController = new AbortController();

    await expect(
      issueProductSurfaceStepUpChallenge(
        {
          commandMethod: 'POST',
          commandPath: '/api/approvals/v1/admin/workflows/workflow-1/publish',
          targetType: 'WORKFLOW',
          targetId: 'workflow-1',
          expectedObjectVersion: 7,
          idempotencyKey: 'attempt-1',
          payload: { expectedVersion: 7 },
          contextScopeKey: 'scope-1',
          returnTo: '/approvals/admin/workflows?scope=scope-1',
        },
        'user-visible-revision',
        { signal: issuerController.signal }
      )
    ).resolves.toEqual(issued);

    expect(fetchMock.mock.calls[1]?.[0]).toBe(PRODUCT_SURFACE_STEP_UP_CHALLENGE_ENDPOINT);
    const body = JSON.parse(String((fetchMock.mock.calls[1]?.[1] as RequestInit).body));
    expect(body).toEqual({
      commandMethod: 'POST',
      commandPath: '/api/approvals/v1/admin/workflows/workflow-1/publish',
      targetType: 'WORKFLOW',
      targetId: 'workflow-1',
      expectedObjectVersion: 7,
      idempotencyKey: 'attempt-1',
      payload: { expectedVersion: 7 },
      contextScopeKey: 'scope-1',
      returnTo: '/approvals/admin/workflows?scope=scope-1',
    });
    expect(body).not.toHaveProperty('contextKey');
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).toMatchObject({
      'X-DWP-Expected-Decision-Revision': 'user-visible-revision',
    });
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).not.toHaveProperty(
      'X-DWP-Context-Scope'
    );
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).headers).not.toHaveProperty('X-DWP-Scope');
    expect(body).not.toHaveProperty('expectedDecisionRevision');
    expect(body).not.toHaveProperty('routeContractKey');
    expect(body).not.toHaveProperty('capabilityContractKey');
    expect(body).not.toHaveProperty('acr');
    expect(body).not.toHaveProperty('amr');
    expect(body).not.toHaveProperty('auth_time');
  });

  it('rejects forbidden client authority fields before issuing a challenge', async () => {
    const request = {
      commandMethod: 'POST' as const,
      commandPath: '/api/approvals/v1/admin/workflows/workflow-1/publish',
      targetType: 'WORKFLOW',
      targetId: 'workflow-1',
      expectedObjectVersion: 7,
      idempotencyKey: 'attempt-1',
      payload: { expectedVersion: 7 },
      contextKey: 'approvals-management',
      contextScopeKey: 'scope-1',
      capabilityContractKey: 'approvals.design.publish',
    };
    await expect(
      issueProductSurfaceStepUpChallenge(request as never, 'revision-1')
    ).rejects.toThrowError('Product surface step-up challenge request is invalid.');
  });

  it('accepts only an opaque OIDC continuation on STEP_UP_REQUIRED', () => {
    const continuation = getProductSurfaceStepUpContinuation(
      new HttpError('Step-up required', 403, {
        errorCode: 'STEP_UP_REQUIRED',
        data: {
          state: 'CONTINUATION_REQUIRED',
          continuation: {
            type: 'OIDC',
            authorizationUrl: 'https://identity.example.test/authorize?state=opaque',
            expiresAt: '2026-08-24T01:05:00Z',
            flowRef: '8f879f98-2476-4c33-a228-2984567ab889',
          },
        },
      })
    );
    expect(continuation?.continuation.authorizationUrl).not.toContain('challenge=');
    expect(continuation?.continuation.authorizationUrl).not.toContain('jwt=');
    expect(continuation?.continuation).toMatchObject({
      flowRef: '8f879f98-2476-4c33-a228-2984567ab889',
    });
    expect(
      getProductSurfaceStepUpContinuation(
        new HttpError('Bad continuation', 403, {
          errorCode: 'STEP_UP_REQUIRED',
          data: { state: 'CONTINUATION_REQUIRED', continuation: { type: 'LOCAL' } },
        })
      )
    ).toBeNull();

    expect(
      getProductSurfaceStepUpContinuation(
        new HttpError('Unsafe continuation', 403, {
          errorCode: 'STEP_UP_REQUIRED',
          data: {
            state: 'CONTINUATION_REQUIRED',
            continuation: {
              type: 'OIDC',
              authorizationUrl: 'javascript:alert(1)',
              expiresAt: '2026-08-24T01:05:00Z',
              flowRef: '8f879f98-2476-4c33-a228-2984567ab889',
            },
          },
        })
      )
    ).toBeNull();

    expect(
      getProductSurfaceStepUpContinuation(
        new HttpError('Choose provider', 403, {
          errorCode: 'STEP_UP_REQUIRED',
          data: {
            state: 'CONTINUATION_REQUIRED',
            continuation: {
              type: 'OIDC_PROVIDER_SELECTION',
              authorizationUrl: null,
              expiresAt: null,
              providerKeys: ['workforce-sso', 'secure-idp'],
            },
          },
        })
      )
    ).toMatchObject({
      continuation: {
        type: 'OIDC_PROVIDER_SELECTION',
        providerKeys: ['workforce-sso', 'secure-idp'],
      },
    });
    expect(
      getProductSurfaceStepUpContinuation(
        new HttpError('No provider', 403, {
          errorCode: 'STEP_UP_REQUIRED',
          data: {
            state: 'CONTINUATION_REQUIRED',
            continuation: {
              type: 'OIDC_PROVIDER_SELECTION',
              authorizationUrl: null,
              expiresAt: null,
              providerKeys: [],
            },
          },
        })
      )
    ).toBeNull();
  });

  it('distinguishes login and step-up callbacks only from the paired server headers', async () => {
    setTenantId('11');
    const callback = { status: 'OK', message: 'ok', data: { userId: '1' } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(callback))
      .mockResolvedValueOnce(
        jsonResponse(callback, {
          'X-DWP-Step-Up-Flow-ID': '8f879f98-2476-4c33-a228-2984567ab889',
          'X-DWP-Step-Up-Return-To': '/approvals/admin/workflows?scope=S1',
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(callback, {
          'X-DWP-Step-Up-Flow-ID': '8f879f98-2476-4c33-a228-2984567ab889',
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(getOidcCallback({ code: 'code-1', state: 'state-1' })).resolves.toMatchObject({
      purpose: 'LOGIN',
    });
    await expect(getOidcCallback({ code: 'code-2', state: 'state-2' })).resolves.toMatchObject({
      purpose: 'STEP_UP',
      flowId: '8f879f98-2476-4c33-a228-2984567ab889',
      returnTo: '/approvals/admin/workflows?scope=S1',
    });
    await expect(getOidcCallback({ code: 'code-3', state: 'state-3' })).rejects.toMatchObject({
      status: 502,
    });
  });
});
