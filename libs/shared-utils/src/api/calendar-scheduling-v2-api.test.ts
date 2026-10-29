import { afterEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import {
  evaluateCalendarSchedulingV2,
  hardRecheckCalendarSchedulingV2,
  type CalendarSchedulingEvaluationInputV2,
  type CalendarSchedulingEvaluationV2,
  type CalendarSchedulingHardRecheckInputV2,
  type CalendarSchedulingHardRecheckV2,
} from './calendar-scheduling-v2-api';

const input: CalendarSchedulingEvaluationInputV2 = {
  participants: [
    {
      clientRef: 'attendee-1',
      personPublicId: '00ba0853-02a8-7499-b6d8-009251e6a464',
      role: 'REQUIRED',
    },
  ],
  searchWindow: { from: '2026-11-01T04:00:00Z', to: '2026-11-02T05:00:00Z' },
  candidateSlot: {
    startsAt: '2026-11-01T15:00:00Z',
    endsAt: '2026-11-01T15:30:00Z',
  },
  durationMinutes: 30,
  searchTimeZone: 'America/New_York',
  roomCriteria: {
    requiredFeatures: [],
    preferredFeatures: ['VIDEO'],
    approvalPreference: 'PREFER_NO_APPROVAL',
  },
};

describe('calendar scheduling v2 API', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps participant roles in the private POST body', async () => {
    const evaluation = {
      evaluationId: 'evaluation-2',
      criteriaHash: 'criteria-2',
      challengeToken: 'challenge-2',
      completeness: 'COMPLETE',
      participants: [],
      suggestions: [],
      sources: [],
      rooms: [],
      generatedAt: '2026-11-01T14:00:00Z',
      validUntil: '2026-11-01T14:05:00Z',
    } as unknown as CalendarSchedulingEvaluationV2;
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: evaluation } });

    await expect(evaluateCalendarSchedulingV2(input)).resolves.toEqual(evaluation);
    expect(post).toHaveBeenCalledWith(
      '/api/platform/v2/calendar/scheduling/evaluations',
      input,
      undefined
    );
  });

  it('binds the hard recheck to the evaluation, criteria, and one-time challenge', async () => {
    const request: CalendarSchedulingHardRecheckInputV2 = {
      challengeToken: 'challenge-2',
      criteriaHash: 'criteria-2',
      selection: {
        startsAt: '2026-11-01T15:00:00Z',
        endsAt: '2026-11-01T15:30:00Z',
      },
      roomId: 'room/1',
    };
    const result: CalendarSchedulingHardRecheckV2 = {
      evaluationId: '019a3d6e-4be8-779c-8a6d-893fe39b74ca',
      criteriaHash: 'criteria-2',
      status: 'PASS',
      hardRecheckToken: 'hard-recheck-2',
      selectionHash: 'selection-2',
      conflicts: [],
      room: null,
      checkedAt: '2026-11-01T14:00:01Z',
      validUntil: '2026-11-01T14:00:31Z',
    };
    const post = vi.spyOn(axiosInstance, 'post').mockResolvedValue({ data: { data: result } });

    await expect(
      hardRecheckCalendarSchedulingV2('019a3d6e-4be8-779c-8a6d-893fe39b74ca', request)
    ).resolves.toEqual(result);
    expect(post).toHaveBeenCalledWith(
      '/api/platform/v2/calendar/scheduling/evaluations/019a3d6e-4be8-779c-8a6d-893fe39b74ca/hard-recheck',
      request,
      undefined
    );
  });

  it('rejects a non-canonical evaluation id before issuing a request', async () => {
    const post = vi.spyOn(axiosInstance, 'post');
    await expect(
      hardRecheckCalendarSchedulingV2('evaluation/2', {
        challengeToken: 'challenge-2',
        criteriaHash: 'criteria-2',
        selection: {
          startsAt: '2026-11-01T15:00:00Z',
          endsAt: '2026-11-01T15:30:00Z',
        },
      })
    ).rejects.toThrow('canonical UUID');
    await expect(
      hardRecheckCalendarSchedulingV2('019A3D6E-4BE8-779C-8A6D-893FE39B74CA', {
        challengeToken: 'challenge-2',
        criteriaHash: 'criteria-2',
        selection: {
          startsAt: '2026-11-01T15:00:00Z',
          endsAt: '2026-11-01T15:30:00Z',
        },
      })
    ).rejects.toThrow('canonical UUID');
    expect(post).not.toHaveBeenCalled();
  });
});
