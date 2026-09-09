// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { shouldScheduleWorkMobileFocusScroll } from './work-mobile-focus-scroll';

describe('Work mobile focus scroll', () => {
  it('does not move a pointer-focused row before its click completes', () => {
    const main = document.createElement('main');
    const opener = document.createElement('button');
    main.append(opener);

    expect(
      shouldScheduleWorkMobileFocusScroll({
        availableWidth: 320,
        pointerActive: true,
        target: opener,
        container: main,
      })
    ).toBe(false);
  });

  it('still corrects mobile keyboard and programmatic focus after pointer activation ends', () => {
    const main = document.createElement('main');
    const heading = document.createElement('h2');
    main.append(heading);

    expect(
      shouldScheduleWorkMobileFocusScroll({
        availableWidth: 320,
        pointerActive: false,
        target: heading,
        container: main,
      })
    ).toBe(true);
  });

  it('ignores desktop and out-of-layout focus', () => {
    const main = document.createElement('main');
    const child = document.createElement('button');
    const target = document.createElement('button');
    main.append(child);

    expect(
      shouldScheduleWorkMobileFocusScroll({
        availableWidth: 320,
        pointerActive: false,
        target: main,
        container: main,
      })
    ).toBe(false);
    expect(
      shouldScheduleWorkMobileFocusScroll({
        availableWidth: 900,
        pointerActive: false,
        target: child,
        container: main,
      })
    ).toBe(false);
    expect(
      shouldScheduleWorkMobileFocusScroll({
        availableWidth: 320,
        pointerActive: false,
        target,
        container: main,
      })
    ).toBe(false);
  });
});
