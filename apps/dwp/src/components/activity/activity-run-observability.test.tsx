import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ActivityRunObservability } from './activity-run-observability';

import type { DwaionUserRun } from '@dwp-frontend/shared-utils';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      `${key}${values ? `:${JSON.stringify(values)}` : ''}`,
  }),
}));

const observedRun: DwaionUserRun = {
  runId: 'aaaaaaaa-0000-4000-8000-000000000101',
  agentKey: 'DWP_ASSISTANT',
  agentRevision: 2,
  runState: 'RUNNING',
  answerState: null,
  riskTier: 'L1',
  policyOutcome: 'ALLOW',
  statusCode: null,
  sourceCount: 1,
  latencyMs: 55,
  conversationId: null,
  createdAt: '2026-09-07T09:00:00Z',
  completedAt: null,
  dataProvenance: 'SAMPLE',
  activityTitle: 'Privacy-minimized test run',
  attempt: 2,
  lease: { status: 'ACTIVE', expiresAt: '2026-09-07T09:02:00Z' },
  currentStage: 'RETRIEVING',
  progressPercent: 40,
  measurementStatus: 'PARTIAL',
  stages: [
    {
      key: 'AUTHORIZING',
      state: 'COMPLETED',
      sequence: 10,
      startedAt: '2026-09-07T09:00:00Z',
      completedAt: '2026-09-07T09:00:00.020Z',
      durationMs: 20,
    },
    {
      key: 'RETRIEVING',
      state: 'ACTIVE',
      sequence: 20,
      startedAt: '2026-09-07T09:00:00.020Z',
      completedAt: null,
      durationMs: 35,
    },
  ],
  sourceHealth: [
    {
      sourceType: 'WORK_ITEM',
      status: 'SUCCESS',
      latencyMs: 35,
      lastAttemptAt: '2026-09-07T09:00:00.020Z',
      lastSuccessAt: '2026-09-07T09:00:00.020Z',
    },
  ],
  auditEvidence: {
    auditId: 'aaaaaaaa-0000-4000-8000-000000000201',
    auditRecordId: 'aaaaaaaa-0000-5000-8000-000000000202',
    status: 'LINKED',
  },
};

describe('Activity run observability', () => {
  it('renders only server-reported progress, measured stage latency and source status', () => {
    const markup = renderToStaticMarkup(
      createElement(ActivityRunObservability, { run: observedRun, locale: 'ko' })
    );

    expect(markup).toContain('data-run-provenance="SAMPLE"');
    expect(markup).toContain('dwaionActivity.observability.sample.title');
    expect(markup).toContain('aria-valuenow="40"');
    expect(markup).toContain('data-stage-key="AUTHORIZING" data-stage-duration-ms="20"');
    expect(markup).toContain('data-stage-key="RETRIEVING" data-stage-duration-ms="35"');
    expect(markup).toContain('WORK_ITEM');
    expect(markup).toContain('aaaaaaaa-0000-5000-8000-000000000202');
    expect(markup).not.toContain('88%');
    expect(markup).not.toContain('SHA-256 Verified');
  });

  it('does not derive a progress percentage or healthy source state from missing values', () => {
    const markup = renderToStaticMarkup(
      createElement(ActivityRunObservability, {
        run: {
          ...observedRun,
          dataProvenance: 'LIVE',
          progressPercent: null,
          measurementStatus: 'NOT_AVAILABLE',
          stages: [],
          sourceHealth: [],
          auditEvidence: { auditId: null, auditRecordId: null, status: 'NOT_AVAILABLE' },
        },
        locale: 'en',
      })
    );

    expect(markup).not.toContain('role="progressbar"');
    expect(markup).toContain('dwaionActivity.observability.stages.unavailableTitle');
    expect(markup).toContain('dwaionActivity.observability.sources.empty');
    expect(markup).toContain('dwaionActivity.observability.audit.states.NOT_AVAILABLE.title');
    expect(markup).not.toContain('dwaionActivity.observability.sourceStates.SUCCESS');
  });
});
