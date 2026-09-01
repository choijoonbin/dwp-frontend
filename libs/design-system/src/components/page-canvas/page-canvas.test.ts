import { describe, expect, it } from 'vitest';

import { foundationTokens } from '../../foundation';
import { PAGE_CANVAS_GUTTERS, PAGE_CANVAS_LAYOUT } from './page-canvas';

describe('PageCanvas layout policy', () => {
  it('keeps operational workspace pages fluid inside one shared responsive gutter', () => {
    expect(PAGE_CANVAS_LAYOUT.workspace).toEqual({
      maxWidth: 'none',
      marginInline: 0,
    });
    expect(PAGE_CANVAS_GUTTERS).toEqual({ xs: 2, md: 3, xl: 4 });
  });

  it('bounds only focused reading and form pages', () => {
    expect(PAGE_CANVAS_LAYOUT.focus).toEqual({
      maxWidth: foundationTokens.layout.focusCanvasMaxWidth,
      marginInline: 'auto',
    });
  });
});
