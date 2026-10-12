import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '../axios-instance';
import {
  addApprovalFormStudioField,
  archiveApprovalFormStudioDraft,
  cancelScheduledApprovalAutomationDelegation,
  cloneApprovalFormStudioField,
  cloneApprovalTemplateDraft,
  createApprovalAutomationDelegation,
  deleteApprovalFormStudioField,
  dryRunApprovalWorkflowStudio,
  importApprovalTemplatePackage,
  recordApprovalAutomationChannelObservation,
  recordApprovalRoutingGroupUsage,
  recordApprovalRoutingResolverObservation,
  reorderApprovalFormStudioSectionFields,
  revokeApprovalAutomationDelegation,
  reviewApprovalAutomationDelegation,
  saveApprovalAutomationCalendar,
  saveApprovalAutomationChannel,
  saveApprovalAutomationPolicyDraft,
  saveApprovalRoutingResolver,
  saveApprovalWorkflowStudioCanvas,
  simulateApprovalAutomationPolicy,
  updateApprovalAutomationDelegation,
  updateApprovalFormStudioFieldProperties,
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
  const call = fetch.mock.calls.find(([, init]) =>
    ['DELETE', 'POST', 'PUT'].includes(init?.method ?? '')
  );
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

  const newMutationCases = [
    {
      name: 'add a form field',
      method: 'POST',
      path: `/api/approvals/v1/admin/forms/studio-v3/${targetId}/fields`,
      body: {
        compatibilityMode: 'STRICT',
        expectedWorkspaceVersion: expectedObjectVersion,
        field: { key: 'requestReason' },
        index: 1,
        pageKey: 'request',
        sectionKey: 'details',
      },
      invoke: (execution: ApprovalMutationExecution) =>
        addApprovalFormStudioField(
          targetId,
          {
            compatibilityMode: 'STRICT',
            expectedWorkspaceVersion: expectedObjectVersion,
            field: { key: 'requestReason' },
            index: 1,
            pageKey: 'request',
            sectionKey: 'details',
          },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'delete a form field with its fenced request body',
      method: 'DELETE',
      path: `/api/approvals/v1/admin/forms/studio-v3/${targetId}/fields/requestReason`,
      body: {
        compatibilityMode: 'STRICT',
        expectedWorkspaceVersion: expectedObjectVersion,
      },
      invoke: (execution: ApprovalMutationExecution) =>
        deleteApprovalFormStudioField(
          targetId,
          'requestReason',
          { compatibilityMode: 'STRICT', expectedWorkspaceVersion: expectedObjectVersion },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'clone a form field',
      method: 'POST',
      path: `/api/approvals/v1/admin/forms/studio-v3/${targetId}/fields/requestReason/clone`,
      body: {
        compatibilityMode: 'STRICT',
        expectedWorkspaceVersion: expectedObjectVersion,
        index: 2,
        targetFieldKey: 'requestReasonCopy',
      },
      invoke: (execution: ApprovalMutationExecution) =>
        cloneApprovalFormStudioField(
          targetId,
          'requestReason',
          {
            compatibilityMode: 'STRICT',
            expectedWorkspaceVersion: expectedObjectVersion,
            index: 2,
            targetFieldKey: 'requestReasonCopy',
          },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'update form field properties',
      method: 'PUT',
      path: `/api/approvals/v1/admin/forms/studio-v3/${targetId}/fields/requestReason/properties`,
      body: {
        compatibilityMode: 'STRICT',
        expectedWorkspaceVersion: expectedObjectVersion,
        properties: { required: true },
      },
      invoke: (execution: ApprovalMutationExecution) =>
        updateApprovalFormStudioFieldProperties(
          targetId,
          'requestReason',
          {
            compatibilityMode: 'STRICT',
            expectedWorkspaceVersion: expectedObjectVersion,
            properties: { required: true },
          },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'reorder form section fields',
      method: 'PUT',
      path: `/api/approvals/v1/admin/forms/studio-v3/${targetId}/sections/details/field-order`,
      body: {
        expectedWorkspaceVersion: expectedObjectVersion,
        fieldKeys: ['requestReason', 'requester'],
        pageKey: 'request',
      },
      invoke: (execution: ApprovalMutationExecution) =>
        reorderApprovalFormStudioSectionFields(
          targetId,
          'details',
          {
            expectedWorkspaceVersion: expectedObjectVersion,
            fieldKeys: ['requestReason', 'requester'],
            pageKey: 'request',
          },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'create an automation delegation',
      method: 'POST',
      path: '/api/approvals/v1/admin/policies/automation/delegations',
      body: {
        delegateUserId: 22,
        delegatedRoleCodes: ['APPROVER'],
        delegationId: targetId,
        delegatorUserId: 11,
        endsAt: '2026-10-31T09:00:00Z',
        expectedVersion: expectedObjectVersion,
        reason: 'Planned coverage',
        scopeType: 'WORKFLOW',
        startsAt: '2026-10-08T09:00:00Z',
        workflowId: otherId,
      },
      invoke: (execution: ApprovalMutationExecution) =>
        createApprovalAutomationDelegation(
          {
            delegateUserId: 22,
            delegatedRoleCodes: ['APPROVER'],
            delegationId: targetId,
            delegatorUserId: 11,
            endsAt: '2026-10-31T09:00:00Z',
            expectedVersion: expectedObjectVersion,
            reason: 'Planned coverage',
            scopeType: 'WORKFLOW',
            startsAt: '2026-10-08T09:00:00Z',
            workflowId: otherId,
          },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'update an automation delegation',
      method: 'PUT',
      path: `/api/approvals/v1/admin/policies/automation/delegations/${targetId}`,
      body: {
        delegateUserId: 22,
        delegatedRoleCodes: ['APPROVER'],
        delegationId: targetId,
        delegatorUserId: 11,
        endsAt: '2026-11-07T09:00:00Z',
        expectedVersion: expectedObjectVersion,
        reason: 'Extended coverage',
        scopeType: 'WORKFLOW',
        startsAt: '2026-10-08T09:00:00Z',
        workflowId: otherId,
      },
      invoke: (execution: ApprovalMutationExecution) =>
        updateApprovalAutomationDelegation(
          targetId,
          {
            delegateUserId: 22,
            delegatedRoleCodes: ['APPROVER'],
            delegationId: targetId,
            delegatorUserId: 11,
            endsAt: '2026-11-07T09:00:00Z',
            expectedVersion: expectedObjectVersion,
            reason: 'Extended coverage',
            scopeType: 'WORKFLOW',
            startsAt: '2026-10-08T09:00:00Z',
            workflowId: otherId,
          },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'revoke an automation delegation',
      method: 'POST',
      path: `/api/approvals/v1/admin/policies/automation/delegations/${targetId}/revoke`,
      body: { expectedVersion: expectedObjectVersion, reason: 'Coverage ended' },
      invoke: (execution: ApprovalMutationExecution) =>
        revokeApprovalAutomationDelegation(
          targetId,
          { expectedVersion: expectedObjectVersion, reason: 'Coverage ended' },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'cancel a scheduled automation delegation',
      method: 'POST',
      path: `/api/approvals/v1/admin/policies/automation/delegations/${targetId}/scheduled-cancel`,
      body: { expectedVersion: expectedObjectVersion, reason: 'Schedule superseded' },
      invoke: (execution: ApprovalMutationExecution) =>
        cancelScheduledApprovalAutomationDelegation(
          targetId,
          { expectedVersion: expectedObjectVersion, reason: 'Schedule superseded' },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'simulate an automation policy',
      method: 'POST',
      path: `/api/approvals/v1/admin/policies/automation/rules/${targetId}/simulations`,
      body: {
        expectedVersion: expectedObjectVersion,
        revisionId: otherId,
        scenario: { amount: 1000 },
        simulationId: targetId,
      },
      invoke: (execution: ApprovalMutationExecution) =>
        simulateApprovalAutomationPolicy(
          targetId,
          {
            expectedVersion: expectedObjectVersion,
            revisionId: otherId,
            scenario: { amount: 1000 },
            simulationId: targetId,
          },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'import a template package',
      method: 'POST',
      path: '/api/approvals/v1/admin/forms/templates/packages/import',
      body: {
        categoryKey: 'SECURITY',
        changeSummaryEn: 'Imported controls',
        changeSummaryKo: '통제 가져오기',
        defaultWorkflowKey: 'ACCESS_REVIEW',
        dependencies: [],
        descriptionEn: 'Access review',
        descriptionKo: '접근 검토',
        expectedTemplateVersion: expectedObjectVersion,
        filterMetadata: {},
        locales: ['ko', 'en'],
        nameEn: 'Access review',
        nameKo: '접근 검토',
        ownerGroupRef: 'GROUP.SECURITY',
        packageId: targetId,
        packageSha256: 'a'.repeat(64),
        packageVersion: '1.0.0',
        schema: {},
        tags: ['security'],
        templateKey: 'ACCESS_REVIEW',
      },
      invoke: (execution: ApprovalMutationExecution) =>
        importApprovalTemplatePackage(
          {
            categoryKey: 'SECURITY',
            changeSummaryEn: 'Imported controls',
            changeSummaryKo: '통제 가져오기',
            defaultWorkflowKey: 'ACCESS_REVIEW',
            dependencies: [],
            descriptionEn: 'Access review',
            descriptionKo: '접근 검토',
            expectedTemplateVersion: expectedObjectVersion,
            filterMetadata: {},
            locales: ['ko', 'en'],
            nameEn: 'Access review',
            nameKo: '접근 검토',
            ownerGroupRef: 'GROUP.SECURITY',
            packageId: targetId,
            packageSha256: 'a'.repeat(64),
            packageVersion: '1.0.0',
            schema: {},
            tags: ['security'],
            templateKey: 'ACCESS_REVIEW',
          },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'save a workflow canvas',
      method: 'PUT',
      path: `/api/approvals/v1/admin/workflows/${targetId}/studio-v3/canvas`,
      body: { definition: { nodes: [] }, expectedVersion: expectedObjectVersion },
      invoke: (execution: ApprovalMutationExecution) =>
        saveApprovalWorkflowStudioCanvas(
          targetId,
          { definition: { nodes: [] }, expectedVersion: expectedObjectVersion },
          expectedObjectVersion,
          execution
        ),
    },
    {
      name: 'dry-run a workflow canvas',
      method: 'POST',
      path: `/api/approvals/v1/admin/workflows/${targetId}/studio-v3/dry-run`,
      body: { expectedVersion: expectedObjectVersion },
      invoke: (execution: ApprovalMutationExecution) =>
        dryRunApprovalWorkflowStudio(
          targetId,
          { expectedVersion: expectedObjectVersion },
          expectedObjectVersion,
          execution
        ),
    },
  ] as const;

  for (const testCase of newMutationCases) {
    it(`dispatches ${testCase.name} with exact transport and request body`, async () => {
      const fetch = transport();
      await testCase.invoke(secure());
      const [input, init] = mutationCall(fetch);
      expect(init.method).toBe(testCase.method);
      expect(new URL(String(input), 'http://test.invalid').pathname).toBe(testCase.path);
      expect(JSON.parse(String(init.body))).toEqual(testCase.body);
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

  it('rejects delegation path/body identity and body/header version mismatches before transport', async () => {
    const fetch = transport();
    const delegation = {
      delegateUserId: 22,
      delegatedRoleCodes: ['APPROVER'],
      delegationId: otherId,
      delegatorUserId: 11,
      endsAt: '2026-11-07T09:00:00Z',
      expectedVersion: expectedObjectVersion,
      reason: 'Extended coverage',
      scopeType: 'WORKFLOW',
      startsAt: '2026-10-08T09:00:00Z',
      workflowId: otherId,
    };
    expect(() =>
      updateApprovalAutomationDelegation(targetId, delegation, expectedObjectVersion, secure())
    ).toThrow('Invalid Approval administration V2 canonical mutation contract.');
    await expect(
      updateApprovalAutomationDelegation(
        otherId,
        { ...delegation, expectedVersion: expectedObjectVersion + 1 },
        expectedObjectVersion,
        secure()
      )
    ).rejects.toThrow('Invalid Approval administration V2 canonical mutation contract.');
    await expect(
      updateApprovalAutomationDelegation(
        otherId,
        delegation,
        expectedObjectVersion,
        secure(expectedObjectVersion + 1)
      )
    ).rejects.toThrow('Invalid Approval administration V2 canonical mutation contract.');
    expect(fetch).not.toHaveBeenCalled();
  });
});
