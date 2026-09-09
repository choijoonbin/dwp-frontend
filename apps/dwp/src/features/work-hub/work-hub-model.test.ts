import { describe, expect, it } from 'vitest';
import {
  approvalRequestToHub,
  approvalTaskToHub,
  personalWorkToHub,
  serviceRequestToHub,
  workspaceWorkToHub,
} from './work-hub-source-adapters';
import {
  dayPlanHasReference,
  parseWorkHubFilters,
  removeDayPlanWorkReference,
  resolveDayPlanReference,
  resolveDayPlanReferences,
  selectWorkHubDetail,
  selectWorkHubItems,
  workHubSummary,
} from './work-hub-model';
import { workHubReferenceKey, workHubUrgency } from './work-hub-contracts';
import { hydrateWorkSource } from './work-hub-source-hydration';
import { hubItem, KEY, NOW, personal, snapshot, workspace } from './work-hub.test-support';
import type { ServiceRequestSummary } from '@dwp-frontend/shared-utils/api/service-center-api';
import type { ApprovalRequest, ApprovalTask } from '@dwp-frontend/shared-utils/api/approval-api';
import type {
  PersonalDayPlan,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

describe('Work Hub canonical model', () => {
  it('defaults the unified inbox to all work and isolates the in-progress view', () => {
    const state = snapshot([
      hubItem({ key: 'open', lifecycle: 'OPEN' }),
      hubItem({ key: 'progress', lifecycle: 'IN_PROGRESS' }),
      hubItem({ key: 'waiting', lifecycle: 'WAITING', waitingFor: 'OTHERS' }),
      hubItem({ key: 'done', lifecycle: 'COMPLETED', waitingFor: 'NONE' }),
    ]);
    expect(parseWorkHubFilters(new URLSearchParams()).scope).toBe('ALL');
    expect(selectWorkHubItems(state, parseWorkHubFilters(new URLSearchParams()), NOW)).toHaveLength(
      4
    );
    expect(
      selectWorkHubItems(
        state,
        parseWorkHubFilters(new URLSearchParams({ scope: 'IN_PROGRESS' })),
        NOW
      ).map((item) => item.key)
    ).toEqual(['progress']);
  });
  it('does not launder an unknown source into native work or advertise generic completion', () => {
    const projected = workspaceWorkToHub(
      workspace({ sourceSystem: 'HR', capabilities: { canStart: true, canComplete: true } })
    );
    expect(projected.reference.sourceSystem).toBe('LEGACY_PROJECTION');
    expect(projected.originSystem).toBe('HR');
    expect(projected.actions).toEqual([]);
  });
  it.each([
    ['completed', 'COMPLETED'],
    ['cancelled', 'CANCELLED'],
    ['archived', 'ARCHIVED'],
  ] as const)('maps terminal Workspace status %s to no pending actor', (status, lifecycle) => {
    expect(workspaceWorkToHub(workspace({ status }))).toMatchObject({
      lifecycle,
      waitingFor: 'NONE',
    });
  });
  it('does not advertise personal mutations to read-only users', () => {
    expect(personalWorkToHub(personal()).actions).toEqual([]);
    expect(personalWorkToHub(personal(), true).actions.map((action) => action.kind)).toContain(
      'PERSONAL_COMPLETE'
    );
  });
  it('keeps an approval task as a source-app handoff instead of lending Work its commands', () => {
    const task: ApprovalTask = {
      taskId: 'approval-1',
      requestId: 'request-1',
      requestNumber: 'APR-001',
      title: 'Review access',
      summary: 'Verify the requested access',
      workflowNameKo: '접근 검토',
      workflowNameEn: 'Access review',
      stepKey: 'manager',
      stepName: 'Manager review',
      stepSequence: 1,
      status: 'PENDING',
      priority: 'HIGH',
      dataClassification: 'INTERNAL',
      riskScore: 30,
      version: 2,
    };

    expect(approvalTaskToHub(task, 'approval-inbox')).toMatchObject({
      sourceRoute: '/approvals/inbox?task=approval-1',
      actions: [{ kind: 'OPEN_SOURCE', availability: 'AVAILABLE' }],
      sourceContext: {
        kind: 'APPROVAL_TASK',
        requestId: 'request-1',
        requesterName: null,
        requesterOrgName: null,
        submittedAt: null,
        workflowNameKo: '접근 검토',
        workflowNameEn: 'Access review',
        currentStep: { key: 'manager', name: 'Manager review', sequence: 1 },
        riskScore: 30,
      },
    });
  });
  it('permits only restore for an archived personal task', () => {
    expect(personalWorkToHub(personal({ status: 'ARCHIVED' }), true).actions).toEqual([
      { kind: 'PERSONAL_REOPEN', availability: 'AVAILABLE' },
    ]);
  });
  it('keeps archived and cancelled outcomes separate from completed work', () => {
    const state = snapshot([
      hubItem(),
      hubItem({ key: 'complete', lifecycle: 'COMPLETED' }),
      hubItem({ key: 'cancelled', lifecycle: 'CANCELLED' }),
      hubItem({ key: 'archived', lifecycle: 'ARCHIVED' }),
    ]);
    expect(workHubSummary(state, NOW)).toMatchObject({
      active: 1,
      completed: 1,
      cancelled: 1,
      archived: 1,
    });
    expect(
      selectWorkHubItems(
        state,
        parseWorkHubFilters(new URLSearchParams({ scope: 'COMPLETED' })),
        NOW
      ).map((item) => item.key)
    ).toEqual(['complete']);
  });
  it('separates urgency from lifecycle and excludes terminal deadlines from overdue', () => {
    expect(workHubUrgency(hubItem({ dueAt: new Date(NOW - 1).toISOString() }), NOW)).toBe(
      'OVERDUE'
    );
    expect(
      workHubUrgency(
        hubItem({ lifecycle: 'COMPLETED', dueAt: new Date(NOW - 1).toISOString() }),
        NOW
      )
    ).toBe('SCHEDULED');
    expect(workHubUrgency(hubItem({ dueAt: 'invalid' }), NOW)).toBe('NO_DUE_DATE');
  });
  it('never silently falls back from a missing requested detail to an unrelated row', () => {
    const state = snapshot();
    expect(selectWorkHubDetail(state, 'revoked-item', state.items)).toEqual({
      state: 'UNAVAILABLE',
    });
  });
  it('treats requester input as my action and provider work as waiting for others', () => {
    const request = {
      requestId: 's-1',
      requestNumber: 'SR-001',
      serviceKey: 'it-support',
      summary: 'Fix access',
      serviceNameKo: 'IT',
      serviceNameEn: 'IT',
      dataClassification: 'INTERNAL',
      status: 'AWAITING_REQUESTER',
      priority: 'NORMAL',
      assignedGroup: 'IT Service',
      assignedTo: 'Alex Kim',
      submittedAt: '2026-09-04T00:00:00Z',
      slaDueAt: null,
      version: 1,
      updatedAt: new Date(NOW).toISOString(),
    } satisfies ServiceRequestSummary;
    expect(serviceRequestToHub(request)).toMatchObject({
      lifecycle: 'OPEN',
      waitingFor: 'ME',
      sourceRoute: '/services/my/s-1',
      sourceContext: {
        kind: 'SERVICE_REQUEST',
        serviceKey: 'it-support',
        serviceNameKo: 'IT',
        serviceNameEn: 'IT',
        assignedGroup: 'IT Service',
        assignedTo: 'Alex Kim',
        submittedAt: '2026-09-04T00:00:00Z',
      },
    });
    expect(serviceRequestToHub({ ...request, status: 'DRAFT' }).sourceRoute).toBe(
      '/services/drafts/s-1'
    );
    expect(serviceRequestToHub({ ...request, status: 'IN_PROGRESS' })).toMatchObject({
      lifecycle: 'IN_PROGRESS',
      waitingFor: 'OTHERS',
    });
  });
  it('opens requester information in the official approval list with its detail selected', () => {
    const request = {
      requestId: 'request/1',
      requestNumber: 'APR-002',
      title: 'Provide cost evidence',
      summary: 'Cost evidence is required',
      workflowNameKo: '구매 승인',
      workflowNameEn: 'Purchase approval',
      currentStepKey: 'REQUEST_INFORMATION',
      currentStepName: '보완 요청',
      currentStepSequence: 2,
      totalSteps: 3,
      status: 'NEEDS_INFO',
      priority: 'HIGH',
      dataClassification: 'INTERNAL',
      latestInformationRequest: '비교 견적을 추가해 주세요.',
      submittedAt: '2026-09-04T00:00:00Z',
      dueAt: null,
      completedAt: null,
      version: 4,
    } satisfies ApprovalRequest;
    expect(approvalRequestToHub(request)).toMatchObject({
      sourceRoute: '/approvals/requests/needs-info?request=request%2F1',
      sourceContext: {
        kind: 'APPROVAL_REQUEST',
        submittedAt: '2026-09-04T00:00:00Z',
        workflowNameKo: '구매 승인',
        workflowNameEn: 'Purchase approval',
        currentStep: {
          key: 'REQUEST_INFORMATION',
          name: '보완 요청',
          sequence: 2,
          totalSteps: 3,
        },
      },
    });
  });
  it('never hydrates a reference-only source from missing or denied evidence', () => {
    const source = {
      availability: 'REFERENCE_ONLY' as const,
      reference: { sourceSystem: 'PERSONAL_TASK', sourceReference: personal().taskId },
      title: null,
      sourceRoute: null,
      status: null,
      dueAt: null,
    };
    expect(hydrateWorkSource(source, snapshot())).toMatchObject({
      state: 'AVAILABLE',
      source: { title: 'Prepare brief' },
    });
    const denied = snapshot([]);
    denied.sources[0].state = 'FORBIDDEN';
    expect(hydrateWorkSource(source, denied)).toEqual({ state: 'FORBIDDEN', source: null });
  });
  it('does not promote a workspace review projection into proof of Auth access', () => {
    const reference = { sourceSystem: 'IDENTITY_GOVERNANCE', sourceReference: KEY };
    const item = hubItem({ key: workHubReferenceKey(reference), reference, sourceId: 'workspace' });
    const source = {
      availability: 'REFERENCE_ONLY' as const,
      reference: item.reference,
      title: null,
      sourceRoute: null,
      status: null,
      dueAt: null,
    };
    expect(hydrateWorkSource(source, snapshot([item], 'workspace'))).toEqual({
      state: 'NOT_VERIFIED',
      source: null,
    });
  });
  it('resolves and removes a persisted opaque plan selection by its verified source reference', () => {
    const selection: WorkSourceReference = {
      sourceSystem: 'DAY_PLAN_SELECTION',
      sourceReference: 'opaque-selection',
    };
    const reference: WorkSourceReference = {
      sourceSystem: 'PERSONAL_TASK',
      sourceReference: KEY,
    };
    const plan: PersonalDayPlan = {
      date: '2026-09-04',
      version: 2,
      updatedAt: new Date(NOW).toISOString(),
      items: [
        {
          position: 0,
          selectionReference: selection,
          source: {
            availability: 'AVAILABLE',
            reference,
            title: 'Prepare brief',
            sourceRoute: '/work/queue',
            status: 'OPEN',
            dueAt: null,
          },
        },
      ],
    };

    expect(resolveDayPlanReference(plan, selection)).toEqual(reference);
    expect(resolveDayPlanReferences(plan, [selection])).toEqual([reference]);
    expect(dayPlanHasReference(plan, [selection], reference)).toBe(true);
    expect(removeDayPlanWorkReference(plan, [selection], reference)).toEqual([]);
  });
  it('preserves an unavailable opaque plan selection when removing unrelated work', () => {
    const selection: WorkSourceReference = {
      sourceSystem: 'DAY_PLAN_SELECTION',
      sourceReference: 'opaque-unavailable',
    };
    const plan: PersonalDayPlan = {
      date: '2026-09-04',
      version: 2,
      updatedAt: new Date(NOW).toISOString(),
      items: [
        {
          position: 0,
          selectionReference: selection,
          source: {
            availability: 'UNAVAILABLE',
            reference: null,
            title: null,
            sourceRoute: null,
            status: null,
            dueAt: null,
          },
        },
      ],
    };

    expect(resolveDayPlanReference(plan, selection)).toBeNull();
    expect(
      removeDayPlanWorkReference(plan, [selection], {
        sourceSystem: 'PERSONAL_TASK',
        sourceReference: KEY,
      })
    ).toEqual([selection]);
  });
});
