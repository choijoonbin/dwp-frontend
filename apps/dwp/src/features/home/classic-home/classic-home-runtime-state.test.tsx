import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { resolveClassicCommunicationState } from './classic-home';
import { ClassicPersonalSummary } from './classic-personal-summary';

import type {
  CommunicationItem,
  HomeOverview,
  HomeOverviewSection,
} from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${Object.values(values).join(',')}` : key,
  }),
}));

const NOW = Date.parse('2026-09-16T00:00:00.000Z');

function overviewWithCommunications(
  communications: HomeOverview['communications']
): HomeOverview {
  return { communications } as HomeOverview;
}

function summaryOverview({
  calendarStatus,
  workStatus,
}: {
  calendarStatus: HomeOverview['calendar']['status'];
  workStatus: HomeOverview['work']['status'];
}): HomeOverview {
  const generatedAt = new Date(NOW).toISOString();
  const calendar = {
    status: calendarStatus,
    source: 'DWP_CALENDAR',
    generatedAt,
    data:
      calendarStatus === 'AVAILABLE'
        ? { nextEvent: null, today: [], attention: [], generatedAt }
        : null,
  } as HomeOverview['calendar'];
  const work = {
    status: workStatus,
    source: 'DWP_WORKSPACE',
    generatedAt,
    data: workStatus === 'AVAILABLE' ? { items: [], generatedAt } : null,
  } as HomeOverview['work'];
  return { calendar, work, generatedAt } as HomeOverview;
}

function communicationSection(
  status: HomeOverview['communications']['status'],
  options: { generatedAt?: string; hasStory?: boolean } = {}
): HomeOverviewSection<NonNullable<HomeOverview['communications']['data']>> {
  const generatedAt = options.generatedAt ?? new Date(NOW).toISOString();
  return {
    status,
    source: 'DWP_COMMUNICATIONS',
    generatedAt,
    data:
      status === 'AVAILABLE'
        ? ({
            featured: options.hasStory
              ? ({ communicationId: 1 } as unknown as CommunicationItem)
              : null,
            items: [],
            summary: { total: options.hasStory ? 1 : 0, unread: 0, required: 0, saved: 0 },
            generatedAt,
          } satisfies NonNullable<HomeOverview['communications']['data']>)
        : null,
  };
}

describe('Classic Home source-state truthfulness', () => {
  it('never turns unavailable or forbidden communications into an empty success state', () => {
    expect(
      resolveClassicCommunicationState({
        overview: overviewWithCommunications(communicationSection('UNAVAILABLE')),
        loading: false,
        fetching: false,
        requestFailed: false,
        now: NOW,
      })
    ).toBe('widget-error');
    expect(
      resolveClassicCommunicationState({
        overview: overviewWithCommunications(communicationSection('FORBIDDEN')),
        loading: false,
        fetching: false,
        requestFailed: false,
        now: NOW,
      })
    ).toBe('forbidden');
  });

  it('distinguishes verified empty, refresh, stale, and ready communication snapshots', () => {
    const empty = overviewWithCommunications(communicationSection('AVAILABLE'));
    const ready = overviewWithCommunications(
      communicationSection('AVAILABLE', { hasStory: true })
    );
    const stale = overviewWithCommunications(
      communicationSection('AVAILABLE', {
        hasStory: true,
        generatedAt: new Date(NOW - 6 * 60 * 1000).toISOString(),
      })
    );
    const input = { loading: false, requestFailed: false, now: NOW };

    expect(resolveClassicCommunicationState({ overview: empty, fetching: false, ...input })).toBe(
      'empty'
    );
    expect(resolveClassicCommunicationState({ overview: ready, fetching: true, ...input })).toBe(
      'background-refresh'
    );
    expect(resolveClassicCommunicationState({ overview: stale, fetching: false, ...input })).toBe(
      'stale'
    );
    expect(resolveClassicCommunicationState({ overview: ready, fetching: false, ...input })).toBe(
      null
    );
  });

  it('marks an unavailable calendar inside a partial summary instead of saying there is no event', () => {
    const markup = renderToStaticMarkup(
      createElement(ClassicPersonalSummary, {
        overview: summaryOverview({ calendarStatus: 'UNAVAILABLE', workStatus: 'AVAILABLE' }),
        loading: false,
        fetching: false,
        requestFailed: false,
        onRetry: () => undefined,
      })
    );

    expect(markup).toContain('data-home-content-state="partial"');
    expect(markup).toContain('data-classic-summary-source-state="widget-error"');
    expect(markup).not.toContain('classic.resources.summary.noSchedule');
    expect(markup).toContain('classic.resources.summary.noPriorityWork');
  });

  it('marks a forbidden work source without reporting a zero work count', () => {
    const markup = renderToStaticMarkup(
      createElement(ClassicPersonalSummary, {
        overview: summaryOverview({ calendarStatus: 'AVAILABLE', workStatus: 'FORBIDDEN' }),
        loading: false,
        fetching: false,
        requestFailed: false,
        onRetry: () => undefined,
      })
    );

    expect(markup).toContain('data-classic-summary-source-state="forbidden"');
    expect(markup).not.toContain('classic.resources.summary.noPriorityWork');
  });
});
