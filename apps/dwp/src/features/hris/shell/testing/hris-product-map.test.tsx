import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { HrisProductMap } from '../index';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      `${key}${values?.count === undefined ? '' : `:${values.count}`}`,
    i18n: { language: 'ko', resolvedLanguage: 'ko' },
  }),
}));

function renderMap(initialSurface: 'HOME' | 'OPERATIONS' | 'SETTINGS' = 'HOME') {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(HrisProductMap, { initialSurface, canOpenPath: () => true })
    )
  );
}

describe('HRIS product map runtime contract', () => {
  it('uses labelled navigation, filters, live results, and semantic heading/list structure', () => {
    const html = renderMap('OPERATIONS');
    expect(html).toContain('data-testid="hris-product-map"');
    expect(html).toContain('aria-labelledby="hris-product-map-title"');
    expect(html).toContain('aria-label="productMap.surfaceLabel"');
    expect(html).toContain('aria-label="productMap.moduleLabel"');
    expect(html).toContain('aria-label="productMap.personaLabel"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('data-testid="hris-product-map-results" aria-live="polite"');
    expect(html).toContain('<h2');
    expect(html).toContain('<h3');
    expect(html).toContain('<h4');
    expect(html).toContain('<ul');
    expect(html).toContain('<li');
  });

  it('renders only the real operations pilot as an action and keeps roadmap rows inert', () => {
    const html = renderMap('OPERATIONS');
    expect(html.match(/data-lifecycle="PILOT"/gu) ?? []).toHaveLength(1);
    expect(html.match(/productMap\.open/gu) ?? []).toHaveLength(2);
    expect(html).toContain('data-lifecycle="BLOCKED_EVIDENCE"');
    expect(html).not.toContain('href="/hr/');
    expect(html).toContain('productMap.availability.LEGACY_PARTIAL');
  });

  it('keeps a pilot visible but removes its action when route authority is absent', () => {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(HrisProductMap, {
          initialSurface: 'OPERATIONS',
          canOpenPath: () => false,
        })
      )
    );
    expect(html.match(/data-lifecycle="PILOT"/gu) ?? []).toHaveLength(1);
    expect(html).toContain('data-open-state="denied"');
    expect(html).toContain('productMap.authorizationRequired');
    expect(html).not.toContain('productMap.open');
  });

  it('labels DWP control-plane items as external without offering fake destinations', () => {
    const html = renderMap('SETTINGS');
    expect(html.match(/data-lifecycle="EXTERNAL"/gu) ?? []).toHaveLength(6);
    expect(html).toContain('productMap.lifecycle.EXTERNAL');
    expect(html).not.toContain('productMap.open');
  });
});
