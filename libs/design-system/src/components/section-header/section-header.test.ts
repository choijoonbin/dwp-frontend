import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Mic } from 'lucide-react';

import {
  SECTION_HEADER_COMPACT_METRICS,
  SECTION_HEADER_META_METRICS,
  SECTION_HEADER_METRICS,
  SectionHeader,
} from './section-header';

describe('SectionHeader policy', () => {
  it('preserves identical default rendering when standard options are explicit', () => {
    const props = { icon: Mic, title: 'Audio' };
    expect(renderToStaticMarkup(createElement(SectionHeader, props))).toBe(
      renderToStaticMarkup(
        createElement(SectionHeader, { ...props, density: 'standard', glyph: 'surface' })
      )
    );
    expect(renderToStaticMarkup(createElement(SectionHeader, props))).not.toContain('data-density');
  });
  it('renders opt-in compact semantic headings and a decorative plain glyph', () => {
    const markup = renderToStaticMarkup(
      createElement(SectionHeader, {
        icon: Mic,
        title: 'Audio',
        density: 'compact',
        glyph: 'plain',
        id: 'audio-heading',
        headingComponent: 'h3',
      })
    );
    expect(markup).toContain('data-density="compact"');
    expect(markup).toMatch(/<h3[^>]*id="audio-heading"/u);
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('width="18" height="18"');
  });
  it('provides an opt-in compact scale without changing the default metrics', () => {
    expect(SECTION_HEADER_COMPACT_METRICS).toEqual({
      icon: 18,
      title: 16,
      lineHeight: 24,
      minHeight: 24,
    });
    expect(SECTION_HEADER_METRICS.title).toBe(18);
    expect(SECTION_HEADER_METRICS.iconPlate).toBe(30);
  });
  it('keeps one stable heading and icon scale across workspace sections', () => {
    expect(SECTION_HEADER_METRICS).toEqual({
      iconPlate: 30,
      icon: 17,
      iconStroke: 1.8,
      title: 18,
      titleLineHeight: 24,
    });
  });

  it('keeps one stable metadata hierarchy across workspace sections', () => {
    expect(SECTION_HEADER_META_METRICS).toEqual({
      fontSize: 12,
      lineHeight: 18,
      fontWeight: 500,
    });
  });
});
