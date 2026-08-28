import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { NormalizedHomeContribution } from '../contributions';
import { HomePurposeContextualVisual } from './home-purpose-contextual-visual';

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
  it('uses the full available track and announces an explicit total denominator', () => {
    const markup = renderToStaticMarkup(
      createElement(HomePurposeContextualVisual, {
        sectionKey: 'response',
        items: [response('urgent', 'CRITICAL', 5), response('actionable', 'MEDIUM', 2)],
      })
    );

    expect(markup).toContain('data-home-response-distribution="true"');
    expect(markup).toContain('data-home-response-total="7"');
    expect(markup).toContain('data-home-response-total-label="true"');
    expect(markup).toContain('flow.purpose.response.distributionLabel');
    expect(markup).toContain('flow.purpose.response.distributionTotal');
    expect(markup).toContain('&quot;count&quot;:7');
    expect(markup).toContain('width:100%');
    expect(markup).not.toContain('320px');
  });
});
