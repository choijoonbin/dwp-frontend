import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { NotificationNoiseQualityPanel } from './notification-noise-quality-panel';

import type {
  NotificationNoiseMetrics,
  NotificationNoisyType,
} from './notification-noise-quality-model';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'actions.refresh': 'Refresh',
        'actions.retry': 'Try again',
        'states.loadingAdmin': 'Loading notification operations',
        'states.adminErrorTitle': 'Operations could not be loaded',
        'noiseQuality.datum.withheld': 'Withheld',
        'noiseQuality.datum.noData': 'No data',
        'noiseQuality.metricsMissing':
          'Quality metrics were not provided. No KPI values are displayed.',
        'noiseQuality.privacy.unavailable':
          'Privacy threshold is unavailable. All analytics values remain withheld.',
        'noiseQuality.privacy.guard': 'Privacy guard: minimum cohort 20.',
        'noiseQuality.fourEyes.separationRequired':
          'The drafter and reviewer must be different people.',
        'noiseQuality.fourEyes.separationUnavailable':
          'Reviewer separation requirements are unavailable.',
      })[key] ?? key,
  }),
}));

const metrics: NotificationNoiseMetrics = {
  MUTED_RATE: {
    key: 'MUTED_RATE',
    label: 'Muted rate',
    description: 'Recipient mute decisions',
    unit: 'PERCENT',
    datum: { state: 'AVAILABLE', value: 0.12, cohortSize: 120 },
  },
  DEDUPLICATION_RATE: {
    key: 'DEDUPLICATION_RATE',
    label: 'Deduplication rate',
    description: 'Duplicate collapse decisions',
    unit: 'PERCENT',
    datum: { state: 'AVAILABLE', value: 0.31, cohortSize: 120 },
  },
  ACTION_CONVERSION: {
    key: 'ACTION_CONVERSION',
    label: 'Action conversion',
    description: 'Source-owned actions after exposure',
    unit: 'PERCENT',
    datum: {
      state: 'MISSING',
      value: null,
      cohortSize: 120,
      note: 'Source action signal missing.',
    },
  },
  FATIGUE_COHORT: {
    key: 'FATIGUE_COHORT',
    label: 'Fatigue cohort',
    description: 'Anonymous burst-risk cohort',
    unit: 'COUNT',
    datum: { state: 'AVAILABLE', value: 8, cohortSize: 8 },
  },
};

const noisyType: NotificationNoisyType = {
  typeId: '10000000-0000-0000-0000-000000000001',
  contractId: '10000000-0000-0000-0000-000000000001',
  appKey: 'it-service',
  typeKey: 'DEPLOYMENT.UPDATE',
  appLabel: 'IT Service',
  typeLabel: 'Deployment update',
  sent: { state: 'AVAILABLE', value: 340, cohortSize: 120 },
  mutedRate: { state: 'AVAILABLE', value: 0.28, cohortSize: 120 },
  deduplicationRate: { state: 'AVAILABLE', value: 0.42, cohortSize: 120 },
  actionConversion: { state: 'MISSING', value: null, cohortSize: 120 },
  ownerLabel: 'IT operations',
  finding: {
    findingId: 'finding-1',
    severity: 'WARNING',
    label: 'Burst pattern',
    summary: 'Review the governed notification contract.',
    target: 'CONTRACT',
    targetKey: '10000000-0000-0000-0000-000000000001',
    targetLabel: 'Deployment notification contract',
  },
};

const sharedProps = {
  metrics,
  noisyTypes: [noisyType],
  privacyPolicy: {
    minimumCohortSize: 20,
    explanation: 'Small cohorts are withheld from administrators.',
  },
  fourEyesPolicy: {
    state: 'ENFORCED' as const,
    summary: 'Drafts require an independent review before publication.',
    draftLabel: 'Create a bounded policy draft and preview impact.',
    reviewLabel: 'A different administrator approves or rejects the draft.',
    reviewerSeparationRequired: true,
    canOpenPolicy: true,
  },
};

describe('NotificationNoiseQualityPanel', () => {
  it('shows available analytics while withholding small cohorts and preserving missing data', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationNoiseQualityPanel, {
        ...sharedProps,
        state: { kind: 'READY' },
        generatedAt: '2026-09-16T09:00:00Z',
        onInspectType: vi.fn(),
        onOpenFinding: vi.fn(),
        onOpenPolicy: vi.fn(),
      })
    );
    expect(markup).toContain('data-testid="notification-noise-quality-panel"');
    expect(markup).toContain('data-noise-metric="MUTED_RATE" data-value-visibility="visible"');
    expect(markup).toContain('data-noise-metric="FATIGUE_COHORT" data-value-visibility="privacy"');
    expect(markup).toContain('12%');
    expect(markup).toContain('Withheld');
    expect(markup).toContain('No data');
    expect(markup).toContain('minimum cohort 20');
    expect(markup).toContain('The drafter and reviewer must be different people.');
    expect(markup).toContain('Deployment update');
  });

  it('renders an honest unavailable state without leaking cached KPI values', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationNoiseQualityPanel, {
        ...sharedProps,
        state: { kind: 'ERROR', message: 'Analytics source unavailable.' },
        onRetry: vi.fn(),
      })
    );
    expect(markup).toContain('Operations could not be loaded');
    expect(markup).toContain('Analytics source unavailable.');
    expect(markup).not.toContain('12%');
    expect(markup).not.toContain('Deployment update');
  });

  it('keeps partial-source disclosure alongside the usable subset', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationNoiseQualityPanel, {
        ...sharedProps,
        state: { kind: 'PARTIAL', message: 'Action events are temporarily unavailable.' },
      })
    );
    expect(markup).toContain('Action events are temporarily unavailable.');
    expect(markup).toContain('12%');
    expect(markup).toContain('No data');
  });

  it('renders bounded investigation controls and privacy-eligible trend points', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationNoiseQualityPanel, {
        ...sharedProps,
        state: { kind: 'READY' },
        filters: {
          range: 'LAST_7_DAYS',
          search: 'deployment',
          severity: 'WARNING',
          risk: 'HIGH_MUTE_RATE',
        },
        onFiltersChange: vi.fn(),
        trend: [
          {
            bucketStart: '2026-09-15T00:00:00Z',
            cohortSize: 30,
            volume: 70,
            muteRate: 0.2,
            deduplicationRate: 0.1,
            actionConversionRate: 0.4,
          },
        ],
      })
    );

    expect(markup).toContain('value="deployment"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('admin.overview.trendChartLabel');
    expect(markup).toContain('20%');
    expect(markup).toContain('10%');
    expect(markup).toContain('40%');
  });

  it('fails closed when KPI data and the privacy threshold are not provided', () => {
    const markup = renderToStaticMarkup(
      createElement(NotificationNoiseQualityPanel, {
        ...sharedProps,
        metrics: undefined,
        noisyTypes: [],
        privacyPolicy: null,
        state: { kind: 'READY' },
        fourEyesPolicy: {
          ...sharedProps.fourEyesPolicy,
          state: 'UNAVAILABLE',
          reviewerSeparationRequired: false,
        },
      })
    );
    expect(markup).toContain('Quality metrics were not provided. No KPI values are displayed.');
    expect(markup).toContain('Privacy threshold is unavailable');
    expect(markup).toContain('Reviewer separation requirements are unavailable.');
    expect(markup).not.toContain('12%');
  });
});
