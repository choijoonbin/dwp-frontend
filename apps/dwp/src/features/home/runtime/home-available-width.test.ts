import { describe, expect, test } from 'vitest';

import { isStableHomeAvailableWidth } from './home-available-width';

describe('isStableHomeAvailableWidth', () => {
  test('rejects transient sliver measurements only while a desktop viewport remains allocated', () => {
    expect(isStableHomeAvailableWidth(0, 1440)).toBe(false);
    expect(isStableHomeAvailableWidth(240, 1440)).toBe(false);
    expect(isStableHomeAvailableWidth(1192, 1440)).toBe(true);
    expect(isStableHomeAvailableWidth(320, 320)).toBe(true);
    expect(isStableHomeAvailableWidth(358, 390)).toBe(true);
  });
});
