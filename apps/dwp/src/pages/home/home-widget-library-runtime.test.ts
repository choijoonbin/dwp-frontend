import { describe, expect, it } from 'vitest';

import { homeWidgetLibraryQueryEnabled } from './home-widget-library-runtime';

describe('Home widget library runtime boundary', () => {
  it.each([
    [false, false, false],
    [false, true, false],
    [true, false, false],
    [true, true, true],
  ] as const)(
    'queries code sets only when legacy Home=%s and widget library=%s',
    (legacyHomeEnabled, widgetLibraryEnabled, expected) => {
      expect(homeWidgetLibraryQueryEnabled(legacyHomeEnabled, widgetLibraryEnabled)).toBe(expected);
    }
  );
});
