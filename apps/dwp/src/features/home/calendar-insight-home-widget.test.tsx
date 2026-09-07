import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import {
  CalendarInsightHomeWidget,
  resolveCalendarInsightState,
} from './calendar-insight-home-widget';

import type { HomeOverview } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      `${key}${values ? `:${JSON.stringify(values)}` : ''}`,
  }),
}));

function overview(): HomeOverview {
  const generatedAt = '2026-09-03T09:00:00Z';
  return {
    audience: { profile: 'MEMBER', ruleVersion: 'v1', reasons: [] },
    generatedAt,
    work: { status: 'UNAVAILABLE', source: 'DWP_WORK', generatedAt },
    communications: { status: 'UNAVAILABLE', source: 'DWP_COMMUNICATIONS', generatedAt },
    activity: { status: 'UNAVAILABLE', source: 'DWP_ACTIVITY', generatedAt },
    recommendations: { status: 'UNAVAILABLE', source: 'DWP_RECOMMENDATIONS', generatedAt },
    calendar: {
      status: 'AVAILABLE',
      source: 'DWP_CALENDAR',
      generatedAt,
      data: {
        date: '2026-09-03',
        timeZone: 'Asia/Seoul',
        today: [],
        metrics: {
          eventCount: 4,
          meetingMinutes: 180,
          focusMinutes: 240,
          focusTargetMinutes: 300,
          conflictCount: 1,
          awaitingResponseCount: 0,
          availableRoomCount: 3,
        },
        weekLoad: [
          {
            date: '2026-09-02',
            meetingMinutes: 90,
            focusMinutes: 210,
            eventCount: 2,
            conflictCount: 0,
            loadPercent: 44,
          },
          {
            date: '2026-09-03',
            meetingMinutes: 180,
            focusMinutes: 240,
            eventCount: 4,
            conflictCount: 1,
            loadPercent: 88,
          },
        ],
        attention: [],
        generatedAt,
      },
    },
  };
}

function renderWidget(
  widgetKey: 'focus-balance' | 'meeting-load',
  data: HomeOverview = overview()
): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(CalendarInsightHomeWidget, {
        widgetKey,
        overview: data,
        loading: false,
        requestFailed: false,
        onRetry: vi.fn(),
      })
    )
  );
}

describe('CalendarInsightHomeWidget', () => {
  it('derives focus balance exclusively from the available calendar contract', () => {
    const state = resolveCalendarInsightState('focus-balance', overview(), false, false);

    expect(state.kind).toBe('available');
    if (state.kind !== 'available') return;
    expect(state.signal).toMatchObject({ key: 'focus-time', value: 240 });
    expect(state.focusTargetMinutes).toBe(300);
    expect(state.meetingMinutes).toBe(180);
  });

  it('derives the meeting load and week profile from the current calendar day', () => {
    const state = resolveCalendarInsightState('meeting-load', overview(), false, false);

    expect(state.kind).toBe('available');
    if (state.kind !== 'available') return;
    expect(state.signal).toMatchObject({ key: 'schedule-load', value: 88 });
    expect(state.weekLoad).toHaveLength(2);
    expect(state.conflictCount).toBe(1);
  });

  it('does not invent a meeting load when the current day is absent', () => {
    const missingToday = overview();
    missingToday.calendar.data!.weekLoad = missingToday.calendar.data!.weekLoad.filter(
      (point) => point.date !== missingToday.calendar.data!.date
    );

    expect(resolveCalendarInsightState('meeting-load', missingToday, false, false)).toEqual({
      kind: 'empty',
    });
  });

  it('keeps loading, permission, and transport failures distinct', () => {
    expect(resolveCalendarInsightState('focus-balance', undefined, true, false)).toEqual({
      kind: 'loading',
    });

    const restricted = overview();
    restricted.calendar = { ...restricted.calendar, status: 'FORBIDDEN', data: undefined };
    expect(resolveCalendarInsightState('focus-balance', restricted, false, false)).toEqual({
      kind: 'restricted',
    });

    expect(resolveCalendarInsightState('focus-balance', overview(), false, true)).toEqual({
      kind: 'unavailable',
    });
  });

  it('renders focus value, target progress, and the real focus-to-meeting balance', () => {
    const markup = renderWidget('focus-balance');

    expect(markup).toContain('data-calendar-insight-widget="focus-balance"');
    expect(markup).toContain('data-calendar-insight-state="available"');
    expect(markup).toContain('data-calendar-insight-value="true"');
    expect(markup).toContain('>240<');
    expect(markup).toContain('flow.calendarInsights.focusVsMeetings');
    expect(markup).toContain('&quot;focus&quot;:240');
    expect(markup).toContain('&quot;meetings&quot;:180');
    expect(markup).toContain('href="/calendar/insights"');
  });

  it('renders the real week load as an accessible visual and data table', () => {
    const markup = renderWidget('meeting-load');

    expect(markup).toContain('data-calendar-insight-widget="meeting-load"');
    expect(markup).toContain('data-calendar-insight-week-bars="true"');
    expect(markup.match(/data-calendar-insight-day=/g)).toHaveLength(2);
    expect(markup.match(/data-calendar-insight-day-current="true"/g)).toHaveLength(1);
    expect(markup).toContain('<table');
    expect(markup).toContain('table-layout:fixed');
    expect(markup).toContain('<td>2026-09-03</td>');
    expect(markup).toContain('<td>88%</td>');
  });

  it.each(['focus-balance', 'meeting-load'] as const)(
    'stacks the %s graphic heading at compact mobile widths without breaking Korean words',
    (widgetKey) => {
      const markup = renderWidget(widgetKey);

      expect(markup).toContain(`data-calendar-insight-graphic-header="${widgetKey}"`);
      expect(markup).toMatch(
        /@media\s*\(max-width: 479\.95px\)\{[^}]*flex-direction:column;[^}]*align-items:flex-start;/u
      );
      expect(markup).toContain('word-break:keep-all');
      expect(markup).toContain('overflow-wrap:break-word');
      expect(markup).toContain('data-calendar-insight-value-unit="primary"');
      expect(markup).toContain('white-space:nowrap');
      expect(markup).toContain('flex-wrap:nowrap');
    }
  );

  it('keeps focus and meeting minute values with their units in the narrow stacked legend', () => {
    const markup = renderWidget('focus-balance');

    expect(markup).toContain('data-calendar-insight-legend="focus-balance"');
    expect(markup).toMatch(
      /<span[^>]* data-calendar-insight-value-unit="focus-minutes"[^>]*>240flow\.signals\.unit\.minutes<\/span>/u
    );
    expect(markup).toContain('data-calendar-insight-value-unit="meeting-minutes"');
    expect(markup).toContain('flow.calendarInsights.meetingMinutes:{&quot;minutes&quot;:180}');
    expect(markup).toContain('href="/calendar/insights"');
  });

  it('does not replace an absent focus target with a meeting-conflict comparison', () => {
    const data = overview();
    data.calendar.data!.metrics.focusTargetMinutes = 0;

    const markup = renderWidget('focus-balance', data);

    expect(markup).toContain('flow.signals.baselinePending');
    expect(markup).not.toContain('flow.calendarInsights.conflicts');
    expect(markup).not.toContain('flow.calendarInsights.noConflicts');
  });
});
