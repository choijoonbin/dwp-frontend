import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  installApprovalTemplateDraft,
  saveApprovalFormStudioDraft,
  saveApprovalRoutingGroup,
} from './approval-admin-v2-governed-api';

const templateVersionId = '11111111-1111-4111-8111-111111111111';
const formId = '22222222-2222-4222-8222-222222222222';
const groupId = '33333333-3333-4333-8333-333333333333';
const memberId = '44444444-4444-4444-8444-444444444444';
const personId = '55555555-5555-4555-8555-555555555555';
const decisionRevision = `psr-${'d'.repeat(64)}`;

type FetchInput = Parameters<typeof globalThis.fetch>[0];
type FetchInit = Parameters<typeof globalThis.fetch>[1];

function response(data: unknown) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function secure(version: number) {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: decisionRevision,
    contextKey: 'approval-admin',
    contextScopeKey: 'opaque-management-scope',
    objectVersion: version,
    idempotencyKey: 'governed-from-dispatch',
    stepUp: {
      challenge: 'signed-step-up-proof',
      challengeId: '66666666-6666-4666-8666-666666666666',
      decisionRevision,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
  } as const;
}

function transport(result: unknown) {
  const fetch = vi.fn(async (input: FetchInput, _init?: FetchInit) => {
    const url = input instanceof Request ? input.url : String(input);
    return url.includes('/csrf')
      ? response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' })
      : response(result);
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function mutationCall(fetch: ReturnType<typeof transport>, method: 'POST' | 'PUT') {
  const call = fetch.mock.calls.find(([, init]) => init?.method === method);
  if (!call) throw new Error(`Expected ${method} mutation request.`);
  return call as [string | URL | Request, RequestInit];
}

function assertSecurity(init: RequestInit, version: number) {
  const headers = new Headers(init.headers);
  expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(decisionRevision);
  expect(headers.get('X-DWP-Expected-Object-Version')).toBe(String(version));
  expect(headers.get('X-DWP-Step-Up-Challenge')).toBe('signed-step-up-proof');
  expect(headers.get('Idempotency-Key')).toBe('approval-admin-v2-attempt');
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Approval administration V2 governed drafts', () => {
  const options = { idempotencyKey: 'approval-admin-v2-attempt', beforeDispatch: vi.fn() };

  it('installs a released template version with the exact body and security headers', async () => {
    const fetch = transport({
      sourceTemplateId: '77777777-7777-4777-8777-777777777777',
      sourceTemplateVersionId: templateVersionId,
      draft: { formId, workspaceVersion: 1 },
    });
    await installApprovalTemplateDraft(
      {
        templateVersionId,
        expectedTemplateVersion: 4,
        formKey: 'ACCESS_REQUEST',
        nameKo: '접근 요청',
        nameEn: 'Access request',
        descriptionKo: '설명',
        descriptionEn: 'Description',
        ownerGroupRef: 'GROUP.SECURITY',
        categoryKey: 'SECURITY',
        defaultWorkflowKey: 'SECURITY_REVIEW',
      },
      secure(4),
      options
    );
    const [input, init] = mutationCall(fetch, 'POST');
    expect(new URL(String(input), 'http://test.invalid').pathname).toBe(
      `/api/approvals/v1/admin/forms/templates/versions/${templateVersionId}/install`
    );
    expect(JSON.parse(String(init.body))).toEqual({
      formKey: 'ACCESS_REQUEST',
      nameKo: '접근 요청',
      nameEn: 'Access request',
      descriptionKo: '설명',
      descriptionEn: 'Description',
      ownerGroupRef: 'GROUP.SECURITY',
      categoryKey: 'SECURITY',
      defaultWorkflowKey: 'SECURITY_REVIEW',
      expectedTemplateVersion: 4,
    });
    assertSecurity(init, 4);
  });

  it('saves the exact Form V3 schema with a version-fenced PUT', async () => {
    const fetch = transport({ formId, workspaceVersion: 8 });
    await saveApprovalFormStudioDraft(
      {
        formId,
        expectedWorkspaceVersion: 7,
        schema: { schemaContract: 'DWP_FORM_SCHEMA_V3', schemaVersion: 3, pages: [] },
      },
      secure(7),
      options
    );
    const [input, init] = mutationCall(fetch, 'PUT');
    expect(new URL(String(input), 'http://test.invalid').pathname).toBe(
      `/api/approvals/v1/admin/forms/studio-v3/${formId}/draft`
    );
    expect(JSON.parse(String(init.body))).toEqual({
      expectedWorkspaceVersion: 7,
      schema: { schemaContract: 'DWP_FORM_SCHEMA_V3', schemaVersion: 3, pages: [] },
    });
    assertSecurity(init, 7);
  });

  it('saves a complete routing-group draft without dropping members or effective dates', async () => {
    const fetch = transport({ groupId, version: 10 });
    await saveApprovalRoutingGroup(
      {
        groupId,
        groupKey: 'FINANCE_APPROVERS',
        displayName: 'Finance approvers',
        description: 'Current regional approvers',
        lifecycle: 'DRAFT',
        effectiveFrom: '2026-09-16T00:00:00Z',
        effectiveTo: null,
        expectedVersion: 9,
        members: [
          {
            memberId,
            kind: 'SUBJECT',
            userId: 42,
            personPublicId: personId,
            nestedGroupId: null,
            resolverId: null,
            priority: 1,
            required: true,
          },
        ],
      },
      secure(9),
      options
    );
    const [input, init] = mutationCall(fetch, 'PUT');
    expect(new URL(String(input), 'http://test.invalid').pathname).toBe(
      `/api/approvals/v1/admin/workflows/routing-directory/groups/${groupId}`
    );
    expect(JSON.parse(String(init.body))).toMatchObject({
      groupId,
      lifecycle: 'DRAFT',
      effectiveFrom: '2026-09-16T00:00:00Z',
      expectedVersion: 9,
      members: [{ memberId, personPublicId: personId }],
    });
    assertSecurity(init, 9);
  });
});
