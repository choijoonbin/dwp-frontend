import { describe, expect, it, vi } from 'vitest';

import { workHubCalendarComposerRoute, workHubCalendarRoute } from './work-hub-page-helpers';
import {
  openWorkCalendarComposerDocument,
  openWorkCalendarDocument,
} from './use-work-hub-calendar-handoff';

const now = new Date('2026-09-16T00:00:00.000Z');
const item = {
  reference: {
    sourceSystem: 'PERSONAL_TASK',
    sourceReference: 'b1111111-1111-4111-8111-111111111111',
  },
};

function composerNavigation() {
  return workHubCalendarComposerRoute(
    '2026-09-16',
    '/work/queue?work=PERSONAL_TASK%3Ab1111111-1111-4111-8111-111111111111%3A#selected',
    item,
    {
      title: 'Focus: sensitive customer task',
      startsAt: '2026-09-16T09:00:00+09:00',
      endsAt: '2026-09-16T09:30:00+09:00',
      timeZone: 'Asia/Seoul',
    },
    `sha256:${'a'.repeat(64)}`,
    now
  );
}

describe('Work to Calendar document boundary', () => {
  it('opens a plain Calendar route as a document without a Work return payload', () => {
    const assign = vi.fn();
    const target = workHubCalendarRoute('2026-09-16');

    expect(openWorkCalendarDocument(target, assign)).toBe(true);
    expect(assign).toHaveBeenCalledOnce();
    expect(assign).toHaveBeenCalledWith('/calendar/schedule?date=2026-09-16');
    expect(target).not.toContain('returnTo');
    expect(target).not.toContain('/work');
  });

  it('persists the private composer envelope before assigning the payload-free Calendar URL', () => {
    const navigation = composerNavigation();
    const calls: string[] = [];
    const persist = vi.fn(() => {
      calls.push('persist');
      return true;
    });
    const assign = vi.fn(() => calls.push('assign'));
    const clear = vi.fn();

    expect(
      openWorkCalendarComposerDocument(navigation, now.getTime(), {
        assign,
        clear,
        persist,
      })
    ).toBe(true);
    expect(calls).toEqual(['persist', 'assign']);
    expect(persist).toHaveBeenCalledWith(navigation.state, now.getTime());
    expect(assign).toHaveBeenCalledWith(navigation.to);
    expect(clear).not.toHaveBeenCalled();

    const url = new URL(navigation.to, 'https://dwp.example');
    expect(url.pathname).toBe('/calendar/schedule');
    expect(url.searchParams.get('date')).toBe('2026-09-16');
    expect(url.searchParams.get('create')).toBe('focus');
    expect(url.searchParams.has('returnTo')).toBe(false);
    expect(url.searchParams.has('work')).toBe(false);
    expect(url.searchParams.has('title')).toBe(false);
    expect(navigation.to).not.toContain(item.reference.sourceReference);
  });

  it('fails closed without navigation and clears only its exact command after assign failure', () => {
    const navigation = composerNavigation();
    const persist = vi.fn(() => false);
    const assign = vi.fn();
    const clear = vi.fn();

    expect(
      openWorkCalendarComposerDocument(navigation, now.getTime(), {
        assign,
        clear,
        persist,
      })
    ).toBe(false);
    expect(assign).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();

    persist.mockReturnValue(true);
    assign.mockImplementationOnce(() => {
      throw new Error('navigation blocked');
    });
    expect(
      openWorkCalendarComposerDocument(navigation, now.getTime(), {
        assign,
        clear,
        persist,
      })
    ).toBe(false);
    expect(clear).toHaveBeenCalledWith(navigation.state.workCalendarEventHandoff.handoffId);
  });

  it('rejects foreign or payload-bearing targets before persistence or assignment', () => {
    const navigation = composerNavigation();
    const persist = vi.fn(() => true);
    const assign = vi.fn();
    const clear = vi.fn();

    expect(
      openWorkCalendarComposerDocument(
        { ...navigation, to: `${navigation.to}&returnTo=%2Fwork%2Fqueue` },
        now.getTime(),
        { assign, clear, persist }
      )
    ).toBe(false);
    expect(
      openWorkCalendarComposerDocument(
        {
          ...navigation,
          to: 'https://example.invalid/calendar/schedule?date=2026-09-16&create=focus',
        },
        now.getTime(),
        { assign, clear, persist }
      )
    ).toBe(false);
    expect(persist).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });
});
