// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';

import { commitRouteAccessibility, routeDocumentTitle } from './app';

afterEach(() => {
  document.body.replaceChildren();
});

describe('route document metadata', () => {
  it('keeps the current page and product surface in the document title', () => {
    expect(routeDocumentTitle('  결재 운영 개요  ', ' 결재 관리 ')).toBe(
      '결재 운영 개요 · 결재 관리 · DWP'
    );
    expect(routeDocumentTitle('결재함')).toBe('결재함 · DWP');
  });
});

describe('route focus target', () => {
  it('focuses the page heading when the route provides one', () => {
    document.body.innerHTML = '<main id="dwp-main-content"><h1>Account profile</h1></main>';

    const target = commitRouteAccessibility(true);

    expect(target?.tagName).toBe('H1');
    expect(document.activeElement).toBe(target);
    expect(document.title).toBe('Account profile · DWP');
  });

  it('falls back to the main landmark when the route has no h1', () => {
    document.body.innerHTML = '<main id="dwp-main-content"><p>Route content</p></main>';

    const target = commitRouteAccessibility(true);

    expect(target).toBe(document.getElementById('dwp-main-content'));
    expect(document.activeElement).toBe(target);
    expect(target?.getAttribute('tabindex')).toBe('-1');
  });
});
