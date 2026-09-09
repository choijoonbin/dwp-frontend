// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Shared from '@dwp-frontend/shared-utils';
import { MeetingScheduleAvailability } from './meeting-schedule-availability';
import {
  meetingCalendarCriteria,
  readMeetingCalendarObservation,
} from './meeting-schedule-availability-model';
import { emptyMeetingSchedule, type MeetingScheduleDraft } from './meeting-schedule-model';

const runtime = vi.hoisted(() => ({
  user: {
    tenantId: 1,
    userId: 7,
    identityPlane: 'TENANT',
    displayName: 'Organizer',
    personPublicId: '11000000-0000-4000-8000-000000000001',
  },
  evaluate: vi.fn(),
}));
vi.mock('@dwp-frontend/shared-utils', async (original) => ({
  ...(await original<typeof Shared>()),
  useAuth: () => ({ isAuthenticated: true, user: runtime.user }),
}));
vi.mock('@dwp-frontend/shared-utils/api/calendar-api', () => ({
  evaluateCalendarScheduling: runtime.evaluate,
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const personId = '11000000-0000-4000-8000-000000000002';
const clock = Date.parse('2026-09-10T00:00:00Z');
function draft(): MeetingScheduleDraft {
  return {
    ...emptyMeetingSchedule('Asia/Seoul', undefined, new Date(clock)),
    startsAt: '2026-09-10T01:00:00Z',
    durationMinutes: 30,
    participants: [
      {
        userId: 8,
        personPublicId: personId,
        displayName: 'Shared colleague',
        emailAddress: 'colleague@example.test',
      },
    ],
  };
}
function observation(busy = 20, now = Date.now()) {
  const generatedAt = new Date(now).toISOString();
  return {
    evaluationId: '11000000-0000-4000-8000-000000000003',
    criteriaHash: 'a'.repeat(64),
    completeness: 'COMPLETE',
    sources: [{ sourceType: 'DWP_NATIVE', status: 'HEALTHY' }],
    generatedAt,
    validUntil: new Date(now + 30_000).toISOString(),
    availability: {
      generatedAt,
      participants: [
        { personPublicId: runtime.user.personPublicId, busyMinutes: 0 },
        { personPublicId: personId, busyMinutes: busy },
      ],
    },
  };
}

describe('Meeting Calendar availability boundary', () => {
  it('requests the exact slot and includes the organizer once', () => {
    const criteria = meetingCalendarCriteria(draft(), runtime.user)!;
    expect(criteria.input.personIds).toEqual([runtime.user.personPublicId, personId]);
    expect(criteria.input).toMatchObject({
      from: '2026-09-10T01:00:00.000Z',
      to: '2026-09-10T01:30:00.000Z',
      durationMinutes: 30,
    });
    expect(
      meetingCalendarCriteria(
        { ...draft(), participants: [{ ...draft().participants[0], personPublicId: null }] },
        runtime.user
      )
    ).toBeNull();
  });
  it('accepts only complete identity coverage and discards partial, stale, or untrusted sources', () => {
    const criteria = meetingCalendarCriteria(draft(), runtime.user)!;
    expect(
      readMeetingCalendarObservation(observation(20, clock), criteria, clock).conflictingPeople
    ).toEqual([{ id: personId, name: 'Shared colleague' }]);
    for (const mutation of [
      { completeness: 'PARTIAL' },
      { validUntil: new Date(clock).toISOString() },
      { sources: [{ sourceType: 'EXTERNAL', status: 'HEALTHY' }] },
      {
        availability: {
          generatedAt: new Date(clock).toISOString(),
          participants: [{ personPublicId: runtime.user.personPublicId, busyMinutes: 0 }],
        },
      },
      {
        availability: {
          generatedAt: new Date(clock).toISOString(),
          participants: [
            { personPublicId: runtime.user.personPublicId, busyMinutes: 0 },
            { personPublicId: runtime.user.personPublicId, busyMinutes: 20 },
          ],
        },
      },
    ])
      expect(() =>
        readMeetingCalendarObservation({ ...observation(20, clock), ...mutation }, criteria, clock)
      ).toThrow();
  });
});

describe('Meeting Calendar availability interaction', () => {
  let host: HTMLDivElement;
  let root: Root;
  const render = async (value = draft()) => {
    await act(async () => root.render(<MeetingScheduleAvailability draft={value} />));
  };
  const check = async () => {
    await act(async () => host.querySelector<HTMLButtonElement>('button')!.click());
  };
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    runtime.evaluate.mockReset();
    runtime.user.tenantId = 1;
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.useRealTimers();
  });
  it('queries only explicitly, then expires the private names after the server TTL', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(clock);
    runtime.evaluate.mockResolvedValue(observation());
    await render();
    expect(runtime.evaluate).not.toHaveBeenCalled();
    await check();
    expect(runtime.evaluate).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Shared colleague');
    await act(async () => {
      vi.advanceTimersByTime(30_001);
    });
    expect(host.textContent).not.toContain('Shared colleague');
    expect(host.textContent).toContain('scheduleWorkspace.availability.expired');
  });
  it('cannot restore a previous slot after its response finishes late', async () => {
    let finish!: (value: ReturnType<typeof observation>) => void;
    runtime.evaluate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    runtime.evaluate.mockResolvedValueOnce(observation(0));
    await render();
    await check();
    await render({ ...draft(), startsAt: '2026-09-10T02:00:00Z' });
    await check();
    expect(host.textContent).toContain('scheduleWorkspace.availability.clear');
    await act(async () => finish(observation(20)));
    expect(host.textContent).not.toContain('Shared colleague');
  });
  it('retires pending and completed evidence when the caller leaves and returns to a scope', async () => {
    let finish!: (value: ReturnType<typeof observation>) => void;
    runtime.evaluate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    await render();
    await check();
    runtime.user.tenantId = 2;
    await render();
    runtime.user.tenantId = 1;
    await render();
    await act(async () => finish(observation()));
    expect(host.textContent).not.toContain('Shared colleague');
    expect(host.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false);
    runtime.evaluate.mockResolvedValueOnce(observation());
    await check();
    expect(host.textContent).toContain('Shared colleague');
    await render({ ...draft(), startsAt: '2026-09-10T02:00:00Z' });
    await render();
    expect(host.textContent).not.toContain('Shared colleague');
  });
  it('clears a successful observation immediately when retry fails or tenant identity changes', async () => {
    runtime.evaluate.mockResolvedValueOnce(observation());
    runtime.evaluate.mockRejectedValueOnce(new Error('Calendar sharing revoked'));
    await render();
    await check();
    expect(host.textContent).toContain('Shared colleague');
    await check();
    expect(host.textContent).not.toContain('Shared colleague');
    expect(host.textContent).toContain('scheduleWorkspace.availability.error');
    runtime.evaluate.mockResolvedValueOnce(observation());
    await check();
    runtime.user.tenantId = 2;
    await render();
    expect(host.textContent).not.toContain('Shared colleague');
  });
});
