// @vitest-environment jsdom
import { getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAdminV2TestHarness } from './admin-v2-test-harness';
import { stateCopy } from './admin-v2-test-fixtures';
import { AnalyticsInsightsWorkspace } from './analytics-insights-workspace';

import type { AdminV2TestHarness } from './admin-v2-test-harness';
import type { AnalyticsInsightsCopy } from './analytics-insights-workspace';

const copy: AnalyticsInsightsCopy = {
  header: {
    eyebrow: 'Approval administration',
    title: 'Process intelligence',
    description: 'Explainable aggregate metrics.',
    evidenceLabel: 'Coverage disclosed',
  },
  state: stateCopy,
  coverageTitle: 'Coverage',
  coverageDescription: 'Included and excluded populations.',
  cohortTitle: 'Cohorts',
  cohortDescription: 'Privacy-preserving aggregate dimensions.',
  cohortDetailTitle: 'Cohort detail',
  cohortDetailDescription: 'Select a cohort.',
  bottleneckTitle: 'Stage waits',
  bottleneckDescription: 'Completed stage timings only.',
  recommendationsTitle: 'Evidence-backed observations',
  recommendationsDescription: 'Reviewable insights, not automatic decisions.',
  noSelectionLabel: 'Select a cohort.',
  refreshLabel: 'Refresh',
  rangeLabel: 'Date range',
  filterLabel: 'Filters',
  suppressedTitle: 'Small cohort suppressed',
  suppressedDescription: 'Values remain hidden below the configured privacy threshold.',
  readOnlyTitle: 'Read-only intelligence',
  readOnlyDescription: 'Insights do not mutate workflow or policy configuration.',
  stageLabel: 'Stage',
  p50Label: 'p50',
  p90Label: 'p90',
  sampleLabel: 'Sample',
};

describe('AnalyticsInsightsWorkspace', () => {
  let harness: AdminV2TestHarness;
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    harness = createAdminV2TestHarness();
  });
  afterEach(async () => {
    await harness.destroy();
    vi.unstubAllGlobals();
  });

  it('does not render suppressed cohort values', async () => {
    await harness.render(
      <AnalyticsInsightsWorkspace
        state="ready"
        copy={copy}
        metrics={[]}
        coverageFacts={[]}
        cohorts={[
          {
            id: 'cohort-1',
            label: 'Restricted cohort',
            sampleLabel: '<5',
            cycleTimeLabel: 'Suppressed',
            slaLabel: 'Suppressed',
            conformanceLabel: 'Suppressed',
            suppressed: true,
            status: { label: 'SUPPRESSED', tone: 'warning' },
            facts: [{ id: 'secret', label: 'Cycle time', value: '42 minutes' }],
          },
        ]}
        selectedCohortId="cohort-1"
        stages={[]}
        recommendations={[]}
        onSelectCohort={vi.fn()}
        onRefresh={vi.fn()}
        onChangeRange={vi.fn()}
        onChangeFilter={vi.fn()}
      />
    );

    expect(harness.node.textContent).toContain(copy.suppressedTitle);
    expect(harness.node.textContent).not.toContain('42 minutes');
  });

  it('exposes the horizontally scrollable bottleneck table to keyboard users', async () => {
    await harness.render(
      <AnalyticsInsightsWorkspace
        state="ready"
        copy={copy}
        metrics={[]}
        coverageFacts={[]}
        cohorts={[]}
        selectedCohortId={null}
        stages={[]}
        recommendations={[]}
        onSelectCohort={vi.fn()}
        onRefresh={vi.fn()}
        onChangeRange={vi.fn()}
        onChangeFilter={vi.fn()}
      />
    );

    const region = getByRole(harness.node, 'region', {
      name: `${copy.bottleneckTitle}: ${copy.stageLabel}`,
    });
    expect(region.getAttribute('tabindex')).toBe('0');
  });
});
