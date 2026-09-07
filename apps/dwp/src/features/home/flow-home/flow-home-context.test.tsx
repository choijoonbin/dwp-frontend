import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { HomeContentAlignment } from '@dwp-frontend/shared-utils';
import { FlowHomeContext } from './flow-home-context';
import { FlowHomeStatusChip } from './flow-home-status-chip';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      `${key}${values ? `:${JSON.stringify(values)}` : ''}`,
  }),
}));

const defaults = {
  audience: 'MEMBER' as const,
  currentDate: 'Friday, September 4',
  headline: 'Welcome back, Mina',
  subheadline: 'See the work that needs your attention today.',
  updatedAt: '09:30',
  contentAlignment: 'LEFT' as const,
  health: { state: 'HEALTHY' as const, issues: [], refreshing: false },
  metrics: { action: 5, timeline: 2, response: 2 },
  editing: false,
  customizationEnabled: true,
  customizationBusy: false,
  onEdit: vi.fn(),
  onRetry: vi.fn(),
};

describe('FlowHomeStatusChip', () => {
  it('keeps all three real counts and navigation anchors in a compact semantic list', () => {
    const markup = renderToStaticMarkup(
      createElement(FlowHomeStatusChip, { metrics: defaults.metrics })
    );
    expect(markup).toContain('data-flow-context-metrics-appearance="compact-chip"');
    for (const key of ['action', 'timeline', 'response']) {
      expect(markup).toContain(`href="#flow-purpose-${key}"`);
      expect(markup).toContain(`data-flow-context-metric-count="${key}"`);
      expect(markup).toContain(`flow.context.metrics.${key}`);
    }
    expect(markup).toContain('flow.purpose.count:{&quot;count&quot;:5}');
    expect(markup).toContain('flow.purpose.count:{&quot;count&quot;:2}');
    expect(markup.match(/data-flow-context-count-treatment="action-badge"/gu)).toHaveLength(1);
    expect(markup.match(/data-flow-context-count-treatment="inline"/gu)).toHaveLength(2);
    expect(markup).toContain('data-flow-context-action-dot="true"');
    expect(markup.match(/data-flow-context-metric-icon="true"/gu)).toHaveLength(2);
  });

  it('keeps a zero action count neutral and large source values unmodified', () => {
    const markup = renderToStaticMarkup(
      createElement(FlowHomeStatusChip, { metrics: { action: 0, timeline: 1234, response: 0 } })
    );
    expect(markup).not.toContain('data-flow-context-metric-emphasis="true"');
    expect(markup).not.toContain('data-flow-context-count-treatment="action-badge"');
    expect(markup.match(/data-flow-context-count-treatment="inline"/gu)).toHaveLength(3);
    expect(markup).toContain('flow.purpose.count:{&quot;count&quot;:1234}');
  });

  it('uses plain inline glyphs and counts while retaining 44px targets, wrapping, and forced colors', () => {
    const markup = renderToStaticMarkup(
      createElement(FlowHomeStatusChip, { metrics: defaults.metrics })
    );
    expect(markup).toContain('min-height:44px');
    expect(markup).toContain('min-width:44px');
    expect(markup).toContain('overflow-wrap:anywhere');
    expect(markup).toContain('(forced-colors: active)');
    expect(markup).toContain('(prefers-reduced-transparency: reduce)');
    expect(markup).not.toContain('border-inline-end');
    expect(markup).not.toContain('border-inline-start');
    expect(markup).not.toContain('min-height:1.5rem');
    expect(markup).not.toContain('width:28px');
    expect(markup).toContain('width="13"');
  });
});

describe('FlowHomeContext', () => {
  it.each<HomeContentAlignment>(['LEFT', 'CENTER', 'RIGHT'])(
    'preserves %s tenant composition with a greeting-adjacent status slot',
    (contentAlignment) => {
      const markup = renderToStaticMarkup(
        createElement(FlowHomeContext, { ...defaults, contentAlignment })
      );
      expect(markup).toContain(`data-flow-context-alignment="${contentAlignment.toLowerCase()}"`);
      expect(markup).toContain('data-flow-context-composition="inline-greeting"');
      expect(markup).toContain('data-flow-context-status-slot="true"');
      expect(markup).toContain(
        `data-flow-context-side="${contentAlignment === 'RIGHT' ? 'right' : 'left'}"`
      );
      expect(markup).toContain('Welcome back, Mina');
      expect(markup).toContain('[data-flow-large-text="true"]');
      expect(markup).not.toContain('repeat(12, minmax(0, 1fr))');
    }
  );

  it('preserves update freshness and disables customization while busy', () => {
    const markup = renderToStaticMarkup(
      createElement(FlowHomeContext, { ...defaults, customizationBusy: true })
    );
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('flow.context.updated:{&quot;time&quot;:&quot;09:30&quot;}');
    expect(markup).toContain('data-home-edit-trigger="true"');
    expect(markup).toContain('aria-label="flow.context.editHub"');
    expect(markup).toContain('disabled=""');
  });

  it('retains partial-source explanation and retry when compact or editing', () => {
    const markup = renderToStaticMarkup(
      createElement(FlowHomeContext, {
        ...defaults,
        compact: true,
        priorityCompact: true,
        editing: true,
        health: {
          state: 'PARTIAL',
          refreshing: true,
          issues: [{ domain: 'calendar', state: 'UNAVAILABLE' }],
        },
      })
    );
    expect(markup).toContain('data-flow-health-state="partial"');
    expect(markup).toContain('data-flow-health-domains="calendar"');
    expect(markup).toContain('aria-label="flow.context.health.openDetails"');
    expect(markup).toContain('aria-label="flow.context.health.retry"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).not.toContain('data-home-edit-trigger');
    expect(markup).toMatch(/grid-column:1\s*\/\s*-1/u);
  });
});
