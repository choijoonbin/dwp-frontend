import { describe, expect, it } from 'vitest';

import { hubItem } from './work-hub.test-support';
import {
  filterWorkTodayPlanCandidates,
  isWorkDueOnPlanDate,
  type WorkTodayPlanCandidateFilters,
} from './work-today-plan-candidate-model';

const context = {
  date: '2026-09-08',
  timeZone: 'Asia/Seoul',
  now: Date.parse('2026-09-08T01:00:00Z'),
};
const all: WorkTodayPlanCandidateFilters = { query: '', due: 'all', status: 'all' };
const candidates = [
  hubItem({ key: 'prior', title: 'Prior day', dueAt: '2026-09-07T14:59:59Z' }),
  hubItem({ key: 'early', title: 'Earlier today', dueAt: '2026-09-07T15:00:00Z' }),
  hubItem({ key: 'today', title: 'Later today', dueAt: '2026-09-08T14:59:59Z' }),
  hubItem({ key: 'later', title: 'Tomorrow', dueAt: '2026-09-08T15:00:00Z' }),
  hubItem({ key: 'none', title: 'Unscheduled', dueAt: null }),
  hubItem({ key: 'invalid', title: 'Unknown date', dueAt: 'invalid' }),
];
const filter = (filters: Partial<WorkTodayPlanCandidateFilters>) =>
  filterWorkTodayPlanCandidates(
    candidates,
    { ...all, ...filters },
    context,
    () => 'Personal task'
  ).map((item) => item.key);

describe('today plan candidate date and state filters', () => {
  it('uses the selected date in its time zone, including already overdue work today', () => {
    expect(filter({ due: 'today' })).toEqual(['early', 'today']);
    expect(isWorkDueOnPlanDate(candidates[1]!, context)).toBe(true);
    expect(
      isWorkDueOnPlanDate(candidates[1]!, { ...context, timeZone: 'America/Los_Angeles' })
    ).toBe(false);
  });

  it('separates overdue instants, later calendar dates, and explicit absence of a deadline', () => {
    expect(filter({ due: 'has' })).toEqual(['prior', 'early', 'today', 'later']);
    expect(filter({ due: 'overdue' })).toEqual(['prior', 'early']);
    expect(filter({ due: 'scheduled' })).toEqual(['later']);
    expect(filter({ due: 'none' })).toEqual(['none']);
    expect(filter({})).toContain('invalid');
  });

  it('handles a daylight-saving date without assuming a 24-hour local day', () => {
    const dstContext = {
      date: '2026-03-08',
      timeZone: 'America/New_York',
      now: Date.parse('2026-03-08T12:00:00Z'),
    };
    const rows = [
      '2026-03-08T04:59:59Z',
      '2026-03-08T05:00:00Z',
      '2026-03-09T03:59:59Z',
      '2026-03-09T04:00:00Z',
    ].map((dueAt) => hubItem({ key: dueAt, dueAt }));
    expect(
      filterWorkTodayPlanCandidates(rows, { ...all, due: 'today' }, dstContext, () => '').map(
        (item) => item.key
      )
    ).toEqual(['2026-03-08T05:00:00Z', '2026-03-09T03:59:59Z']);
  });

  it('combines search and lifecycle filters and searches translated source labels', () => {
    const rows = [
      hubItem({
        key: 'mine',
        title: 'Quarterly review',
        displayId: 'NAT-008',
        lifecycle: 'IN_PROGRESS',
        dueAt: null,
        waitingFor: 'ME',
      }),
      hubItem({
        key: 'waiting',
        title: 'Quarterly review',
        lifecycle: 'WAITING',
        dueAt: null,
        waitingFor: 'OTHERS',
      }),
    ];
    const select = (filters: Partial<WorkTodayPlanCandidateFilters>) =>
      filterWorkTodayPlanCandidates(rows, { ...all, ...filters }, context, () => '개인 할 일').map(
        (item) => item.key
      );
    expect(select({ due: 'none', status: 'IN_PROGRESS', query: 'quarterly' })).toEqual(['mine']);
    expect(select({ status: 'actionable', query: 'NAT-008' })).toEqual(['mine']);
    expect(select({ status: 'WAITING', query: '개인 할 일' })).toEqual(['waiting']);
    expect(select({ due: 'today', query: 'review' })).toEqual([]);
  });
});
