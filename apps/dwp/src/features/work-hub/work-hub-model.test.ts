import { describe, expect, it } from 'vitest';
import {
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
import type {
  PersonalDayPlan,
  WorkSourceReference,
} from '@dwp-frontend/shared-utils/api/personal-work-contracts';

describe('Work Hub canonical model', () => {
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
      summary: 'Fix access',
      serviceNameKo: 'IT',
      serviceNameEn: 'IT',
      status: 'AWAITING_REQUESTER',
      priority: 'NORMAL',
      version: 1,
      updatedAt: new Date(NOW).toISOString(),
    } as ServiceRequestSummary;
    expect(serviceRequestToHub(request)).toMatchObject({ lifecycle: 'OPEN', waitingFor: 'ME' });
    expect(serviceRequestToHub({ ...request, status: 'IN_PROGRESS' })).toMatchObject({
      lifecycle: 'WAITING',
      waitingFor: 'OTHERS',
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
