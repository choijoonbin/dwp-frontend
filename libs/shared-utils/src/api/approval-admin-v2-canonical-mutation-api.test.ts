import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  archiveApprovalFormStudioDraft,
  cloneApprovalTemplateDraft,
  recordApprovalAutomationChannelObservation,
  recordApprovalRoutingGroupUsage,
  recordApprovalRoutingResolverObservation,
  reviewApprovalAutomationDelegation,
  saveApprovalAutomationCalendar,
  saveApprovalAutomationChannel,
  saveApprovalAutomationPolicyDraft,
  saveApprovalRoutingResolver,
} from './approval-admin-v2-canonical-mutation-api';

import type { ApprovalMutationExecution } from './approval-governed-mutation';

const targetId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const decisionRevision = `psr-${'d'.repeat(64)}`;
const expectedObjectVersion = 7;

type FetchInput = Parameters<typeof globalThis.fetch>[0];
type FetchInit = Parameters<typeof globalThis.fetch>[1];

function response(data: unknown) {
  return new Response(JSON.stringify({ status: 'SUCCESS', data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function secure(version = expectedObjectVersion): ApprovalMutationExecution {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: decisionRevision,
    contextKey: 'approval-admin',
    contextScopeKey: 'opaque-management-scope',
    objectVersion: version,
    idempotencyKey: 'approval-admin-v2-canonical-attempt',
  };
}

function transport() {
  const fetch = vi.fn(async (input: FetchInput, _init?: FetchInit) => {
    const url = input instanceof Request ? input.url : String(input);
    return url.includes('/csrf')
      ? response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' })
      : response({ accepted: true });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function mutationCall(fetch: ReturnType<typeof transport>) {
  const call = fetch.mock.calls.find(([, init]) => ['POST', 'PUT'].includes(init?.method ?? ''));
  if (!call) throw new Error('Expected a canonical mutation request.');
  return call as [string | URL | Request, RequestInit];
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Approval administration V2 canonical mutation boundaries', () => {
  const cases = [
    {
      name: 'archive form draft',
      method: 'POST',
      path: `/api/approvals/v1/admin/forms/studio-v3/${targetId}/archive`,
      invoke: (execution: ApprovalMutationExecution) =>
        archiveApprovalFormStudioDraft(
          targetId,
          { expectedWorkspaceVersion: expectedObjectVersion },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'save automation calendar',
      method: 'PUT',
      path: `/api/approvals/v1/admin/policies/automation/calendars/${targetId}`,
      invoke: (execution: ApprovalMutationExecution) =>
        saveApprovalAutomationCalendar(
          targetId,
          { calendarId: targetId, expectedVersion: expectedObjectVersion },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'save automation channel',
      method: 'PUT',
      path: `/api/approvals/v1/admin/policies/automation/channels/${targetId}`,
      invoke: (execution: ApprovalMutationExecution) =>
        saveApprovalAutomationChannel(
          targetId,
          { channelId: targetId, expectedVersion: expectedObjectVersion },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'record channel observation',
      method: 'POST',
      path: `/api/approvals/v1/admin/policies/automation/channels/${targetId}/observations`,
      invoke: (execution: ApprovalMutationExecution) =>
        recordApprovalAutomationChannelObservation(
          targetId,
          { expectedVersion: expectedObjectVersion },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'save automation policy',
      method: 'PUT',
      path: `/api/approvals/v1/admin/policies/automation/rules/${targetId}/draft`,
      invoke: (execution: ApprovalMutationExecution) =>
        saveApprovalAutomationPolicyDraft(
          targetId,
          { policyId: targetId, expectedVersion: expectedObjectVersion },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'review automation delegation',
      method: 'POST',
      path: `/api/approvals/v1/admin/policies/automation/delegations/${targetId}/reviews`,
      invoke: (execution: ApprovalMutationExecution) =>
        reviewApprovalAutomationDelegation(
          targetId,
          { expectedDelegationVersion: expectedObjectVersion },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'save routing resolver',
      method: 'PUT',
      path: `/api/approvals/v1/admin/workflows/routing-directory/resolvers/${targetId}`,
      invoke: (execution: ApprovalMutationExecution) =>
        saveApprovalRoutingResolver(
          targetId,
          { resolverId: targetId, expectedVersion: expectedObjectVersion },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'record resolver observation',
      method: 'POST',
      path: `/api/approvals/v1/admin/workflows/routing-directory/resolvers/${targetId}/observations`,
      invoke: (execution: ApprovalMutationExecution) =>
        recordApprovalRoutingResolverObservation(
          targetId,
          { expectedVersion: expectedObjectVersion },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'record group usage',
      method: 'POST',
      path: `/api/approvals/v1/admin/workflows/routing-directory/groups/${targetId}/usages`,
      invoke: (execution: ApprovalMutationExecution) =>
        recordApprovalRoutingGroupUsage(
          targetId,
          { groupId: targetId, expectedGroupVersion: expectedObjectVersion },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'clone template draft',
      method: 'POST',
      path: `/api/approvals/v1/admin/forms/templates/${targetId}/draft`,
      invoke: (execution: ApprovalMutationExecution) =>
        cloneApprovalTemplateDraft(
          targetId,
          {
            templateKey: 'ACCESS_REVIEW',
            nameKo: '접근 검토',
            nameEn: 'Access review',
            descriptionKo: '설명',
            descriptionEn: 'Description',
            ownerGroupRef: 'GROUP.SECURITY',
            categoryKey: 'SECURITY',
            defaultWorkflowKey: 'ACCESS_REVIEW',
            expectedTemplateVersion: expectedObjectVersion,
          },
          expectedObjectVersion,
          execution
        ),
    },
  ] as const;

  for (const testCase of cases) {
    it(`dispatches ${testCase.name} with exact path and authority fencing`, async () => {
      const fetch = transport();
      await testCase.invoke(secure());
      const [input, init] = mutationCall(fetch);
      expect(init.method).toBe(testCase.method);
      expect(new URL(String(input), 'http://test.invalid').pathname).toBe(testCase.path);
      const headers = new Headers(init.headers);
      expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe(decisionRevision);
      expect(headers.get('X-DWP-Expected-Object-Version')).toBe(String(expectedObjectVersion));
      expect(headers.get('Idempotency-Key')).toBe('approval-admin-v2-canonical-attempt');
    });
  }

  it('rejects mismatched body and header versions before transport', async () => {
    const fetch = transport();
    await expect(
      saveApprovalAutomationCalendar(
        targetId,
        { calendarId: targetId, expectedVersion: expectedObjectVersion + 1 },
        expectedObjectVersion,
        secure()
      )
    ).rejects.toThrow('Invalid Approval administration V2 canonical mutation contract.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects mismatched path and body identities before transport', () => {
    const fetch = transport();
    expect(() =>
      saveApprovalRoutingResolver(
        targetId,
        { resolverId: otherId, expectedVersion: expectedObjectVersion },
        expectedObjectVersion,
        secure()
      )
    ).toThrow('Invalid Approval administration V2 canonical mutation contract.');
    expect(fetch).not.toHaveBeenCalled();
  });
});
