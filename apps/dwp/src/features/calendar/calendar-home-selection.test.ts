import { describe, expect, it } from 'vitest';
import { calendarReconcileHomeEvent } from './calendar-home-selection';
import type { CalendarEvent, CalendarHome } from '@dwp-frontend/shared-utils';

const event = {
  eventId: 'shared-event',
  startsAt: '2026-09-04T00:00:00Z',
  title: 'Confidential',
  version: 1,
  redacted: false,
  detailLevel: 'FULL',
  capabilities: { canViewDetails: true },
} as CalendarEvent;
const home = (today: CalendarEvent[], nextEvent: CalendarEvent | null = null) =>
  ({ today, nextEvent }) as CalendarHome;

describe('home selection follows successful feed authority', () => {
  it('replaces stale details and capabilities with the owner response', () => {
    const fresh = { ...event, title: 'Updated', version: 2 };
    expect(calendarReconcileHomeEvent(event, home([fresh]))).toBe(fresh);
  });
  it('discards removed events and does not borrow another recurring occurrence', () => {
    expect(calendarReconcileHomeEvent(event, home([]))).toBeNull();
    expect(
      calendarReconcileHomeEvent(event, home([{ ...event, startsAt: '2026-09-05T00:00:00Z' }]))
    ).toBeNull();
  });
  it('discards redacted, busy-only and detail-denied responses', () => {
    for (const denied of [
      { ...event, redacted: true },
      { ...event, detailLevel: 'FREE_BUSY' as const },
      { ...event, capabilities: { ...event.capabilities!, canViewDetails: false } },
      { ...event, capabilities: undefined },
    ]) {
      expect(calendarReconcileHomeEvent(event, home([denied]))).toBeNull();
    }
  });
  it('retains an authorized next event outside today without inventing a selection', () => {
    expect(calendarReconcileHomeEvent(event, home([], event))).toBe(event);
    expect(calendarReconcileHomeEvent(null, home([event]))).toBeNull();
  });
});
