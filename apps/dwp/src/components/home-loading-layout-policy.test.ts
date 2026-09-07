import { describe, expect, it, vi } from 'vitest';

import {
  HOME_LAUNCHPAD_HINT_STORAGE_KEY,
  HOME_PRESENTATION_HINT_STORAGE_KEY,
  normalizeHomePresentationHint,
  readHomeLaunchpadGroupItemCounts,
  readOptionalHomePresentationHint,
  readHomePresentationHint,
  resolveHomeLoadingLayout,
  writeHomeLaunchpadGroupItemCounts,
  writeHomePresentationHint,
} from './home-loading-layout-policy';

describe('Home loading layout policy', () => {
  it.each([
    ['focused', 1280],
    ['balanced', 1680],
    ['expressive', 2560],
  ] as const)(
    'preserves the distinct %s width limit at every viewport',
    (presentation, maxWidth) => {
      for (const viewportWidth of [320, 1280, 1440, 1920, 2560, 3440]) {
        expect(
          resolveHomeLoadingLayout({ presentation, viewportWidth, rootFontSize: 16 }).maxWidth
        ).toBe(maxWidth);
      }
    }
  );

  it('fails closed to balanced when the session hint is absent or invalid', () => {
    expect(readHomePresentationHint(undefined)).toBe('balanced');
    expect(
      readHomePresentationHint({
        getItem: () => 'unknown',
        setItem: vi.fn(),
      })
    ).toBe('balanced');
    expect(normalizeHomePresentationHint(null)).toBe('balanced');
  });

  it('keeps an absent or invalid hint unresolved for the presentation-neutral first paint', () => {
    expect(readOptionalHomePresentationHint(undefined)).toBeNull();
    expect(
      readOptionalHomePresentationHint({
        getItem: () => 'unknown',
        setItem: vi.fn(),
      })
    ).toBeNull();
    expect(
      readOptionalHomePresentationHint({
        getItem: () => 'expressive',
        setItem: vi.fn(),
      })
    ).toBe('expressive');
  });

  it('stores only the approved presentation value', () => {
    const setItem = vi.fn();
    const storage = { getItem: vi.fn(() => null), setItem };

    writeHomePresentationHint(storage, 'expressive');

    expect(setItem).toHaveBeenCalledWith(HOME_PRESENTATION_HINT_STORAGE_KEY, 'expressive');
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('restores the governed group count and caps each loading group at two rows', () => {
    const setItem = vi.fn();
    const storage = {
      getItem: vi.fn((key: string) =>
        key === HOME_LAUNCHPAD_HINT_STORAGE_KEY ? '[5,12,2,4,1]' : null
      ),
      setItem,
    };

    expect(readHomeLaunchpadGroupItemCounts(storage)).toEqual([5, 10, 2, 4, 1]);
    writeHomeLaunchpadGroupItemCounts(storage, [5, 7, 2, 4]);
    expect(setItem).toHaveBeenCalledWith(HOME_LAUNCHPAD_HINT_STORAGE_KEY, '[5,7,2,4]');
  });

  it('rejects malformed or out-of-policy launchpad loading hints', () => {
    expect(
      readHomeLaunchpadGroupItemCounts({ getItem: () => '[5,"7"]', setItem: vi.fn() })
    ).toBeNull();
    expect(
      readHomeLaunchpadGroupItemCounts({
        getItem: () => JSON.stringify(Array(9).fill(1)),
        setItem: vi.fn(),
      })
    ).toBeNull();
  });

  it('tolerates storage that is blocked by the browser', () => {
    const storage = {
      getItem: () => {
        throw new DOMException('blocked');
      },
      setItem: () => {
        throw new DOMException('blocked');
      },
    };

    expect(readHomePresentationHint(storage)).toBe('balanced');
    expect(readOptionalHomePresentationHint(storage)).toBeNull();
    expect(readHomeLaunchpadGroupItemCounts(storage)).toBeNull();
    expect(() => writeHomePresentationHint(storage, 'focused')).not.toThrow();
    expect(() => writeHomeLaunchpadGroupItemCounts(storage, [5, 7, 2, 4])).not.toThrow();
  });

  it('keeps the balanced 1440 skeleton on the reference 8+4 contract', () => {
    expect(
      resolveHomeLoadingLayout({
        presentation: 'balanced',
        viewportWidth: 1440,
        rootFontSize: 16,
      })
    ).toMatchObject({ template: 'adaptive-wide', dockItemCount: 8, dockStacked: true });
  });

  it('restores the expressive 1920 skeleton on the reference 8+4 contract', () => {
    expect(
      resolveHomeLoadingLayout({
        presentation: 'expressive',
        viewportWidth: 1920,
        rootFontSize: 16,
      })
    ).toMatchObject({
      template: 'adaptive-wide',
      dockItemCount: 12,
      dockStacked: true,
    });
  });

  it.each([
    { viewportWidth: 720, rootFontSize: 16 },
    { viewportWidth: 1280, rootFontSize: 32 },
  ])('uses a single column for narrow or 200% large-text loading: %o', (environment) => {
    expect(resolveHomeLoadingLayout({ presentation: 'expressive', ...environment }).template).toBe(
      'single-column'
    );
  });
});
