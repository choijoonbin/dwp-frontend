import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type * as DesignSystem from '@dwp-frontend/design-system';
import type { WorkspaceActivityExecutionSummary } from '@dwp-frontend/shared-utils';
import { FlowActivityDistribution, FlowActivitySignalPanel } from './flow-activity-signal-panel';
import {
  flowActivityAttentionRoute,
  flowActivityHistoryRoute,
  validFlowActivitySummary,
} from './flow-activity-signal-model';
import { RolePulseInsight } from './home-purpose-role-pulse-insight';
import type { FlowSignal } from './flow-home-model';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      `${key}${values ? `:${JSON.stringify(values)}` : ''}`,
  }),
}));
vi.mock('@dwp-frontend/design-system', async (importOriginal) => ({
  ...(await importOriginal<typeof DesignSystem>()),
  ContentDialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? createElement('section', null, children) : null,
}));

const summary: WorkspaceActivityExecutionSummary = {
  total: 12,
  running: 1,
  needsInput: 2,
  policyBlocked: 1,
  completed: 8,
  failed: 0,
  cancelled: 0,
  unknown: 0,
  generatedAt: '2026-09-07T01:00:00Z',
  coverage: { supportedObjectTypes: ['WORK_ITEM'] },
  attentionItems: [
    {
      id: '21000000-0000-4000-8000-000000000002',
      occurredAt: '2026-09-07T00:58:00Z',
      actor: 'person',
      actorName: 'Member',
      state: 'needs-input',
      title: 'Proposal confirmation required',
      objectType: 'WORK_ITEM',
      objectLabel: 'Customer proposal',
      source: 'DWP_WORKSPACE',
      eventKind: 'EXECUTION',
      sourceAccess: 'AVAILABLE',
      auditId: null,
    },
  ],
};
const signal: FlowSignal = {
  key: 'activity-attention',
  label: 'activityAttention',
  value: 3,
  unit: 'items',
  tone: 'warning',
  comparison: { kind: 'none' },
  source: 'DWP_ACTIVITY',
  generatedAt: summary.generatedAt,
  route: '/activity/timeline',
  activityBreakdown: { needsInput: 2, policyBlocked: 1 },
  activityExecutionSummary: summary,
};

function panel(override?: FlowSignal) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(FlowActivitySignalPanel, {
        open: true,
        signal: override ?? signal,
        onClose: vi.fn(),
        onRefresh: vi.fn(),
      })
    )
  );
}

describe('Flow execution signal ledger', () => {
  it('uses a complete, consistent source summary for its distribution', () => {
    expect(validFlowActivitySummary(summary)).toBe(true);
    expect(validFlowActivitySummary({ ...summary, total: 11 })).toBe(false);
    expect(validFlowActivitySummary({ ...summary, unknown: -1 })).toBe(false);
    expect(validFlowActivitySummary({ ...summary, running: NaN })).toBe(false);
    expect(validFlowActivitySummary({ ...summary, generatedAt: 'invalid' })).toBe(false);
  });

  it('provides exact state counts and accessible text without a fabricated progress percentage', () => {
    const markup = panel();
    expect(markup).toContain('data-testid="flow-activity-signal-panel"');
    expect(markup).toContain('data-activity-state="needs-input" data-activity-count="2"');
    expect(markup).toContain('data-activity-state="policy-blocked" data-activity-count="1"');
    expect(markup).toContain('data-activity-state="completed" data-activity-count="8"');
    expect(markup).toContain('role="img" aria-label="flow.signals.execution.states.running 1');
    expect(markup).toContain('flow.signals.execution.distribution');
    expect(markup).not.toContain('role="progressbar"');
    expect(markup).not.toContain('88%');
  });

  it('opens a signal inspector from the existing Flow lens without changing its grid contract', () => {
    const markup = renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(RolePulseInsight, { signals: [signal] }))
    );
    expect(markup).toContain('data-home-role-layout="2x2"');
    expect(markup).toContain('<button');
    expect(markup).toContain('data-testid="flow-activity-signal-trigger"');
    expect(markup).toContain('aria-haspopup="dialog"');
    expect(markup).toContain('data-testid="flow-activity-mini-distribution"');
    expect(markup).toContain('flow.signals.activityBreakdown');
  });

  it('distinguishes historical state filters from current execution totals', () => {
    const markup = panel();
    expect(markup).toContain('href="/activity/timeline?state=needs-input"');
    expect(markup).toContain('href="/activity/timeline?state=policy-blocked"');
    expect(markup).toContain('flow.signals.execution.historyNotice');
    expect(flowActivityHistoryRoute()).toBe('/activity/timeline');
    expect(flowActivityHistoryRoute('unknown')).toBe('/activity/timeline?state=unknown');
  });

  it('opens an exact current attention record before handing off to its owning app', () => {
    const item = summary.attentionItems![0]!;
    const markup = panel();
    expect(markup).toContain('Proposal confirmation required');
    expect(markup).toContain(
      'href="/activity/timeline?event=21000000-0000-4000-8000-000000000002&amp;state=needs-input"'
    );
    expect(flowActivityAttentionRoute(item)).toBe(
      '/activity/timeline?event=21000000-0000-4000-8000-000000000002&state=needs-input'
    );
  });

  it('keeps a valid current item actionable during a brief count-to-item observation race', () => {
    const racing = { ...summary, needsInput: 0, completed: 10 };
    expect(validFlowActivitySummary(racing)).toBe(true);
    const markup = panel({ ...signal, activityExecutionSummary: racing });
    expect(markup).toContain('Proposal confirmation required');
    expect(markup).not.toContain('flow.signals.execution.clearTitle');
  });

  it('does not display an invalid distribution or infer missing values as a healthy zero', () => {
    const invalid = { ...summary, total: 1 };
    const markup = panel({ ...signal, activityExecutionSummary: invalid });
    expect(markup).toContain('flow.signals.loadError');
    expect(markup).not.toContain('data-testid="flow-activity-signal-panel"');
    expect(
      renderToStaticMarkup(createElement(FlowActivityDistribution, { summary: invalid }))
    ).toBe('');
  });

  it('hides a cached successful snapshot when the source refresh fails', () => {
    const markup = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(FlowActivitySignalPanel, {
          open: true,
          signal,
          failed: true,
          onClose: vi.fn(),
          onRefresh: vi.fn(),
        })
      )
    );
    expect(markup).toContain('flow.signals.loadError');
    expect(markup).not.toContain('data-testid="flow-activity-signal-panel"');
    expect(markup).not.toContain('flow.signals.execution.freshness.current');
  });
});
