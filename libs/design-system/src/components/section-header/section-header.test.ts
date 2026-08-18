import { describe, expect, it } from 'vitest';

import { SECTION_HEADER_META_METRICS, SECTION_HEADER_METRICS } from './section-header';

describe('SectionHeader policy', () => {
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
