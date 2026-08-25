import { describe, expect, it } from 'vitest';

import { routeDocumentTitle } from './app';

describe('route document metadata', () => {
  it('keeps the current page and product surface in the document title', () => {
    expect(routeDocumentTitle('  결재 운영 개요  ', ' 결재 관리 ')).toBe(
      '결재 운영 개요 · 결재 관리 · DWP'
    );
    expect(routeDocumentTitle('결재함')).toBe('결재함 · DWP');
  });
});
