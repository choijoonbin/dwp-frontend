// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { HrisProductMap } from '../index';
import { CatalogGroup } from '../components/hris-product-map-group';
import { HRIS_DWP_CONTROL_CATALOG } from '../model/catalog/dwp-control';

const HCM_AUDIT_OVERVIEW_HREF = '/admin/governance/audit-overview?product=HCM&tab=overview';

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

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

async function renderDwpControl(
  canOpenPath: (path: string) => boolean,
  onOpen: (href: string) => void
) {
  await act(async () => {
    root.render(
      createElement(CatalogGroup, {
        group: 'DWP_CONTROL',
        items: HRIS_DWP_CONTROL_CATALOG,
        locale: 'en',
        canOpenPath,
        onOpen,
      })
    );
  });
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

  it('renders governed operations pilots as actions and keeps roadmap rows inert', () => {
    const html = renderMap('OPERATIONS');
    expect(html.match(/data-lifecycle="PILOT"/gu) ?? []).toHaveLength(6);
    expect(html.match(/data-open-state="allowed"/gu) ?? []).toHaveLength(6);
    expect(html.match(/productMap\.open/gu) ?? []).toHaveLength(12);
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
    expect(html.match(/data-lifecycle="PILOT"/gu) ?? []).toHaveLength(6);
    expect(html.match(/data-open-state="denied"/gu) ?? []).toHaveLength(6);
    expect(html).toContain('productMap.authorizationRequired');
    expect(html).not.toContain('productMap.open');
  });

  it('opens only the exact governed HCM audit handoff and preserves its href', async () => {
    const canOpenPath = vi.fn((path: string) => path === HCM_AUDIT_OVERVIEW_HREF);
    const onOpen = vi.fn();

    await renderDwpControl(canOpenPath, onOpen);

    const governance = container.querySelector('[data-catalog-id="dwp-governance"]');
    const otherExternal = [...container.querySelectorAll('[data-lifecycle="EXTERNAL"]')].filter(
      (item) => item.getAttribute('data-catalog-id') !== 'dwp-governance'
    );
    const open = governance?.querySelector('button');

    expect(container.querySelectorAll('[data-lifecycle="EXTERNAL"]')).toHaveLength(6);
    expect(canOpenPath).toHaveBeenCalledOnce();
    expect(canOpenPath).toHaveBeenCalledWith(HCM_AUDIT_OVERVIEW_HREF);
    expect(governance?.getAttribute('data-open-state')).toBe('allowed');
    expect(open?.textContent).toContain('productMap.open');
    expect(otherExternal).toHaveLength(5);
    expect(
      otherExternal.every(
        (item) =>
          item.getAttribute('data-open-state') === 'inert' && item.querySelector('button') === null
      )
    ).toBe(true);

    await act(async () => open?.click());
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledWith(HCM_AUDIT_OVERVIEW_HREF);
  });

  it('keeps the governed HCM audit handoff visible, locked, and inert when denied', async () => {
    const canOpenPath = vi.fn(() => false);
    const onOpen = vi.fn();

    await renderDwpControl(canOpenPath, onOpen);

    const governance = container.querySelector('[data-catalog-id="dwp-governance"]');
    expect(canOpenPath).toHaveBeenCalledOnce();
    expect(canOpenPath).toHaveBeenCalledWith(HCM_AUDIT_OVERVIEW_HREF);
    expect(governance).not.toBeNull();
    expect(governance?.getAttribute('data-open-state')).toBe('denied');
    expect(governance?.textContent).toContain('productMap.authorizationRequired');
    expect(governance?.querySelector('button')).toBeNull();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
