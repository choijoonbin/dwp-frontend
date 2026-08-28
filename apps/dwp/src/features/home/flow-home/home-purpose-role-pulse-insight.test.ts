import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Activity } from 'lucide-react';

import type { NormalizedHomeContribution } from '../contributions';
import type { FlowSignal } from './flow-home-model';
import {
  RolePulseInsight,
  rolePulseLayoutPolicy,
  type RolePulseInsightDensity,
} from './home-purpose-role-pulse-insight';
import { HomePurposeWidget } from './home-purpose-widget';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      `${key}${values ? `:${JSON.stringify(values)}` : ''}`,
  }),
}));

const signals: readonly FlowSignal[] = [
  {
    key: 'activity-attention',
    label: 'activityAttention',
    value: 4,
    unit: 'items',
    tone: 'warning',
    comparison: { kind: 'none' },
    source: 'activity',
    generatedAt: '2026-08-27T08:00:00Z',
    route: '/activity',
  },
  {
    key: 'schedule-load',
    label: 'scheduleLoad',
    value: 80,
    unit: 'percent',
    tone: 'risk',
    comparison: { kind: 'threshold', value: 1 },
    source: 'calendar',
    generatedAt: '2026-08-27T08:00:00Z',
    route: '/calendar/insights',
    series: [
      {
        date: '2026-08-24',
        meetingMinutes: 90,
        focusMinutes: 60,
        eventCount: 2,
        conflictCount: 0,
        loadPercent: 40,
      },
      {
        date: '2026-08-25',
        meetingMinutes: 180,
        focusMinutes: 30,
        eventCount: 4,
        conflictCount: 1,
        loadPercent: 80,
      },
    ],
  },
  {
    key: 'focus-time',
    label: 'focusTime',
    value: 90,
    unit: 'minutes',
    tone: 'warning',
    comparison: { kind: 'target', value: 600 },
    source: 'calendar',
    generatedAt: '2026-08-27T08:00:00Z',
    route: '/calendar/insights',
  },
  {
    key: 'open-work',
    label: 'openWork',
    value: 10,
    unit: 'items',
    tone: 'warning',
    comparison: { kind: 'threshold', value: 3 },
    source: 'work',
    generatedAt: '2026-08-27T08:00:00Z',
    route: '/work',
  },
];

function renderInsight(
  input: readonly FlowSignal[] = signals,
  density: RolePulseInsightDensity = 'standard'
): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(RolePulseInsight, {
        signals: input,
        density,
      })
    )
  );
}

function exception(id: string, title: string): NormalizedHomeContribution {
  return {
    id,
    providerKey: 'activity',
    owner: { source: 'DWP_ACTIVITY', appKey: 'ACTIVITY', appLabel: 'Activity' },
    kind: 'PULSE',
    scope: 'ME',
    priority: 'HIGH',
    status: 'ATTENTION_REQUIRED',
    title,
    description: null,
    count: 1,
    dueAt: null,
    route: `/activity/${id}`,
    deepLink: `/activity/${id}`,
    dedupeKey: `activity:${id}`,
    sourceReference: id,
    sourceReferences: [id],
    generatedAt: '2026-08-27T08:00:00Z',
    freshness: { state: 'FRESH', expiresAt: null },
    privacy: { classification: 'INTERNAL', sensitive: false, redaction: 'NONE' },
    redacted: false,
    duplicateCount: 0,
  };
}

describe('RolePulseInsight', () => {
  it('renders the four source-backed signals as independently keyboard reachable lenses', () => {
    const markup = renderInsight();

    expect(markup).toContain('role="region"');
    expect(markup.match(/data-home-role-lens=/g)).toHaveLength(4);
    expect(markup.indexOf('data-home-role-lens="open-work"')).toBeLessThan(
      markup.indexOf('data-home-role-lens="focus-time"')
    );
    expect(markup.indexOf('data-home-role-lens="focus-time"')).toBeLessThan(
      markup.indexOf('data-home-role-lens="schedule-load"')
    );
    expect(markup).toContain('href="/work"');
    expect(markup).toContain('href="/activity"');
    expect(markup.match(/aria-label="flow.signals.openSummary/g)).toHaveLength(4);
  });

  it('uses only real schedule series and focus target data for visual encodings', () => {
    const markup = renderInsight();

    expect(markup).toContain('data-home-role-series="true"');
    expect(markup).toContain('<table ');
    expect(markup).toContain('<td>2026-08-24</td>');
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="15"');
    expect(markup.match(/role="progressbar"/g)).toHaveLength(1);
  });

  it('announces schedule load as a percentage and keeps conflicts as supporting context', () => {
    const markup = renderInsight(signals.filter((signal) => signal.key === 'schedule-load'));

    expect(markup).toContain('flow.signals.scheduleLoad');
    expect(markup).toContain('flow.signals.unit.percent');
    expect(markup).toContain('flow.signals.conflictCount');
    expect(markup).toContain('&quot;value&quot;:80');
  });

  it('does not fabricate missing signal values', () => {
    const markup = renderInsight(signals.filter((signal) => signal.key === 'open-work'));

    expect(markup.match(/data-home-role-lens=/g)).toHaveLength(1);
    expect(markup).not.toContain('data-home-role-series');
    expect(markup).not.toContain('role="progressbar"');
  });

  it.each(['short', 'standard', 'tall'] as const)(
    'keeps all four source-backed metrics in the 2 by 2 contract at %s density',
    (density) => {
      const markup = renderInsight(signals, density);

      expect(markup).toContain(`data-home-role-density="${density}"`);
      expect(markup).toContain('data-home-role-layout="2x2"');
      expect(markup.match(/data-home-role-lens=/g)).toHaveLength(4);
    }
  );

  it('bounds the short editing metric plane while preserving four metrics', () => {
    const markup = renderInsight(signals, 'short');
    const policy = rolePulseLayoutPolicy.short;

    expect(policy.editingRowHeight * 2 + policy.gap * 8).toBeLessThanOrEqual(76);
    expect(markup).toContain(`data-home-role-edit-row-height="${policy.editingRowHeight}"`);
    expect(markup).toContain('data-home-role-tall-detail="false"');
    expect(markup).not.toContain('data-home-role-detail');
  });

  it('keeps compact metric labels wrapped instead of reducing them to ellipses', () => {
    const markup = renderInsight(signals, 'short');

    expect(markup.match(/data-home-role-label="true"/g)).toHaveLength(4);
    expect(markup.match(/data-home-role-label-layout="wrapped"/g)).toHaveLength(4);
  });

  it('marks standard metric labels for container-responsive wrapping', () => {
    const markup = renderInsight(signals, 'standard');

    expect(markup.match(/data-home-role-label-layout="responsive"/g)).toHaveLength(4);
  });

  it('adds source and generated-at evidence only at tall density', () => {
    const standardMarkup = renderInsight(signals, 'standard');
    const tallMarkup = renderInsight(signals, 'tall');

    expect(standardMarkup).not.toContain('data-home-role-detail');
    expect(tallMarkup).toContain('data-home-role-tall-detail="true"');
    expect(tallMarkup.match(/data-home-role-detail=/g)).toHaveLength(4);
    expect(tallMarkup.match(/flow.next.sourceUpdated/g)).toHaveLength(4);
  });

  it('keeps a real short-height exception as a compact route and retains overflow access', () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(HomePurposeWidget, {
          sectionKey: 'pulse',
          icon: Activity,
          items: [exception('first', 'First exception'), exception('second', 'Second exception')],
          loading: false,
          state: 'AVAILABLE',
          footprintHeight: 'short',
          roleSignals: signals,
        })
      )
    );

    expect(markup.match(/data-home-role-lens=/g)).toHaveLength(4);
    expect(markup).toContain('data-home-role-compact-exception="true"');
    expect(markup).toContain('data-home-role-exception-summary="true"');
    expect(markup).toContain('href="/activity/first"');
    expect(markup).toContain('data-home-purpose-overflow-trigger="true"');
  });
});
