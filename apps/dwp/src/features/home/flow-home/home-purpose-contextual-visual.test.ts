import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { NormalizedHomeContribution } from '../contributions';
import {
  HomePurposeContextualVisual,
  summarizeResponsePriorities,
} from './home-purpose-contextual-visual';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string | number>) =>
      `${key}${values ? `:${JSON.stringify(values)}` : ''}`,
  }),
}));

function response(
  id: string,
  priority: NormalizedHomeContribution['priority'],
  count: number
): NormalizedHomeContribution {
  return {
    id,
    providerKey: 'notifications',
    owner: { source: 'DWP_NOTIFICATIONS', appKey: 'NOTIFICATIONS', appLabel: 'Notifications' },
    kind: 'RESPONSE',
    scope: 'ME',
    priority,
    status: 'NEEDS_RESPONSE',
    title: id,
    description: null,
    count,
    dueAt: null,
    route: `/notifications/${id}`,
    deepLink: `/notifications/${id}`,
    dedupeKey: `notifications:${id}`,
    sourceReference: id,
    sourceReferences: [id],
    generatedAt: '2026-08-28T00:00:00Z',
    freshness: { state: 'FRESH', expiresAt: null },
    privacy: { classification: 'INTERNAL', sensitive: false, redaction: 'NONE' },
    redacted: false,
    duplicateCount: 0,
  };
}

describe('HomePurposeContextualVisual', () => {
  it('keeps critical, high, and standard response priorities mutually distinct', () => {
    expect(
      summarizeResponsePriorities([
        response('critical', 'CRITICAL', 1),
        response('high', 'HIGH', 2),
        response('medium', 'MEDIUM', 3),
        response('low', 'LOW', 1),
      ])
    ).toEqual({
      total: 7,
      counts: { critical: 1, high: 2, standard: 4 },
    });
  });

  it('replaces an ambiguous full-width line with an explicit single-priority summary', () => {
    const markup = renderToStaticMarkup(
      createElement(HomePurposeContextualVisual, {
        sectionKey: 'response',
        items: [response('high', 'HIGH', 3)],
        state: 'AVAILABLE',
      })
    );

    expect(markup).toContain('data-home-response-priority-summary="true"');
    expect(markup).toContain('data-home-response-priority="high"');
    expect(markup).toContain('data-home-response-total="3"');
    expect(markup).toContain('flow.purpose.response.priorityLabel');
    expect(markup).toContain('flow.purpose.response.priority.high');
    expect(markup).toContain('flow.purpose.response.priorityCount');
    expect(markup).toContain('flow.purpose.response.waitingTotal');
    expect(markup).not.toContain('data-home-response-priority-track');
  });

  it('uses a segmented supporting track only for mixed priorities and avoids a false full total', () => {
    const markup = renderToStaticMarkup(
      createElement(HomePurposeContextualVisual, {
        sectionKey: 'response',
        items: [response('urgent', 'CRITICAL', 5), response('actionable', 'MEDIUM', 2)],
        state: 'PARTIAL',
      })
    );

    expect(markup).toContain('data-home-response-distribution="true"');
    expect(markup).toContain('data-home-response-priority-track="true"');
    expect(markup).toContain('data-home-response-total="7"');
    expect(markup).toContain('data-home-response-total-label="true"');
    expect(markup).toContain('flow.purpose.response.prioritySummary');
    expect(markup).toContain('flow.purpose.response.availableTotal');
    expect(markup).toContain('flow.purpose.response.priority.critical');
    expect(markup).toContain('flow.purpose.response.priority.standard');
    expect(markup).toContain('width:100%');
    expect(markup).not.toContain('320px');
  });
});
