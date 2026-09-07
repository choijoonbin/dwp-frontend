import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { HomeFooter } from './home-footer';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      `${key}${values ? `:${JSON.stringify(values)}` : ''}`,
  }),
}));

function renderFooter(freshnessInHeader?: boolean) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(HomeFooter, { updatedAt: '09:59', freshnessInHeader })
    )
  );
}

describe('HomeFooter freshness ownership', () => {
  it('keeps only scope and utility links when the visible header owns freshness', () => {
    const markup = renderFooter(true);
    expect(markup).toContain('footer.dataScope');
    expect(markup).not.toContain('page.lastRefreshed');
    expect(markup).not.toContain('09:59');
    expect(markup).not.toContain('<svg');
    for (const label of ['privacy', 'terms', 'help', 'status']) {
      expect(markup).toContain(`footer.${label}`);
    }
    expect(markup).toContain('href="/account/settings?view=privacy"');
    expect(markup).toContain('href="/services"');
  });

  it.each([undefined, false])(
    'preserves the timestamp for classic and gated Home without a freshness header (%s)',
    (freshnessInHeader) => {
      const markup = renderFooter(freshnessInHeader);
      expect(markup).toContain('page.lastRefreshed:{&quot;time&quot;:&quot;09:59&quot;}');
      expect(markup).not.toContain('footer.dataScope');
      expect(markup).toContain('<svg');
    }
  );
});
