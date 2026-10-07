import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';

import {
  applyHrisTimeWorkPlanApproval,
  createHrisTimeWorkPlanDraft,
  publishHrisTimeWorkPlan,
  simulateHrisTimeWorkPlan,
  submitHrisTimeWorkPlanReview,
  validateHrisTimeWorkPlan,
} from './hris-time-work-plan-api';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { WorkPlanSimulationRequest } from '../model/hris-time-work-plan-model';

const WORK_PLAN_ID = '10000000-0000-4000-8000-000000000001';
const VALIDATE_COMMAND = '20000000-0000-4000-8000-000000000001';
const PUBLISH_COMMAND = '20000000-0000-4000-8000-000000000002';

function response(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    text: async () => JSON.stringify({ data }),
  } as Response;
}

type SecureAuthority = Extract<ProductSurfaceGovernedMutationAuthority, { mode: 'SECURE' }>;

function authority(commandId: string): SecureAuthority {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: 'decision-tim-17',
    contextKey: 'hcm.operations.time',
    contextScopeKey: 'scope:tenant/time',
    idempotencyKey: commandId,
  };
}

function publicationAuthority(commandId: string, objectVersion: number): SecureAuthority {
  return {
    ...authority(commandId),
    objectVersion,
    stepUp: {
      challenge: 'signed-work-plan-publication',
      challengeId: 'work-plan-publication-challenge',
      decisionRevision: 'decision-tim-17',
      expiresAt: '2099-01-01T00:00:00Z',
    },
  };
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
});

describe('HRIS time exact command API', () => {
  it('binds authoring, simulation and review commands to exact owner paths and identities', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValue(response({ receipt: { status: 'ACCEPTED' } }));
    vi.stubGlobal('fetch', fetchMock);
    const simulation: WorkPlanSimulationRequest = {
      workPlanId: WORK_PLAN_ID,
      expectedVersion: 6,
      assignmentSnapshotRevision: '12',
      policyRevision: '4',
      purpose: 'PRE_PUBLISH_IMPACT_REVIEW',
    };

    await createHrisTimeWorkPlanDraft(
      {
        regimeKey: 'standard-flex',
        displayName: 'Standard flex schedule',
        arrangementKind: 'FLEX',
        scopeType: 'POPULATION',
        scopeRef: 'population:10000000-0000-4000-8000-000000000099',
        priority: 100,
        effectiveStart: '2026-10-01',
        timeZone: 'Asia/Seoul',
        rulePackPublicId: '10000000-0000-4000-8000-000000000003',
        jurisdiction: 'KR',
        policyRevision: 4,
        templateSchemaVersion: 1,
        workerPublicId: '10000000-0000-4000-8000-000000000004',
        peopleAssignmentPublicId: '10000000-0000-4000-8000-000000000005',
        assignmentSnapshotRevision: 12,
        terms: [],
        segments: [],
      },
      VALIDATE_COMMAND,
      authority(VALIDATE_COMMAND)
    );
    await simulateHrisTimeWorkPlan(simulation, VALIDATE_COMMAND, authority(VALIDATE_COMMAND), {
      contextScopeKey: 'untrusted-caller-scope',
    });
    await validateHrisTimeWorkPlan(
      WORK_PLAN_ID,
      { expectedVersion: 6 },
      VALIDATE_COMMAND,
      authority(VALIDATE_COMMAND)
    );
    await submitHrisTimeWorkPlanReview(
      WORK_PLAN_ID,
      { expectedVersion: 7 },
      VALIDATE_COMMAND,
      authority(VALIDATE_COMMAND)
    );
    await applyHrisTimeWorkPlanApproval(
      WORK_PLAN_ID,
      { expectedVersion: 8 },
      VALIDATE_COMMAND,
      authority(VALIDATE_COMMAND)
    );

    const commands = fetchMock.mock.calls.filter(
      ([url]) => !String(url).includes('/api/auth/csrf')
    );
    expect(commands.map(([url]) => String(url).split('?')[0])).toEqual([
      '/api/time/v1/hris/work-plans/drafts',
      `/api/time/v1/hris/work-plans/${WORK_PLAN_ID}/simulations`,
      `/api/time/v1/hris/work-plans/${WORK_PLAN_ID}/actions/validate`,
      `/api/time/v1/hris/work-plans/${WORK_PLAN_ID}/actions/submit-review`,
      `/api/time/v1/hris/work-plans/${WORK_PLAN_ID}/actions/apply-approval`,
    ]);
    for (const [, init] of commands) {
      const headers = new Headers((init as RequestInit).headers);
      expect(headers.get('Idempotency-Key')).toBe(VALIDATE_COMMAND);
      expect(headers.get('X-DWP-Expected-Decision-Revision')).toBe('decision-tim-17');
    }
    expect(commands[0]?.[0]).toContain('contextScopeKey=scope%3Atenant%2Ftime');
    expect(commands[0]?.[0]).not.toContain('untrusted-caller-scope');
  });

  it('requires the signed command identity and object version for publication', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }))
      .mockResolvedValue(response({ receipt: { status: 'ACCEPTED' } }));
    vi.stubGlobal('fetch', fetchMock);

    await publishHrisTimeWorkPlan(
      WORK_PLAN_ID,
      { expectedVersion: 9 },
      PUBLISH_COMMAND,
      publicationAuthority(PUBLISH_COMMAND, 9)
    );
    const command = fetchMock.mock.calls.at(-1)!;
    const headers = new Headers((command[1] as RequestInit).headers);
    expect(command[0]).toBe(
      `/api/time/v1/hris/work-plans/${WORK_PLAN_ID}/actions/publish?contextScopeKey=scope%3Atenant%2Ftime`
    );
    expect(headers.get('Idempotency-Key')).toBe(PUBLISH_COMMAND);
    expect(headers.get('X-DWP-Step-Up-Challenge')).toBe('signed-work-plan-publication');

    await expect(
      publishHrisTimeWorkPlan(
        WORK_PLAN_ID,
        { expectedVersion: 9 },
        PUBLISH_COMMAND,
        publicationAuthority(PUBLISH_COMMAND, 10)
      )
    ).rejects.toThrow('Work plan publication authority does not match the object version.');
    await expect(
      publishHrisTimeWorkPlan(
        WORK_PLAN_ID,
        { expectedVersion: 9 },
        PUBLISH_COMMAND,
        publicationAuthority(VALIDATE_COMMAND, 9)
      )
    ).rejects.toThrow('Work plan command authority does not match the idempotency key.');
  });
});
