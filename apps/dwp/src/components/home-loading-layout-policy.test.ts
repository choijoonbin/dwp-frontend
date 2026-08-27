import { describe, expect, it, vi } from 'vitest';

import {
  HOME_PRESENTATION_HINT_STORAGE_KEY,
  normalizeHomePresentationHint,
  readHomePresentationHint,
  resolveHomeLoadingLayout,
  writeHomePresentationHint,
} from './home-loading-layout-policy';

describe('Home loading layout policy', () => {
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

  it('stores only the approved presentation value', () => {
    const setItem = vi.fn();
    const storage = { getItem: vi.fn(() => null), setItem };

    writeHomePresentationHint(storage, 'expressive');

    expect(setItem).toHaveBeenCalledWith(HOME_PRESENTATION_HINT_STORAGE_KEY, 'expressive');
    expect(setItem).toHaveBeenCalledTimes(1);
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
    expect(() => writeHomePresentationHint(storage, 'focused')).not.toThrow();
  });

  it('keeps the balanced 1440 skeleton on the 8+4 standard contract', () => {
    expect(
      resolveHomeLoadingLayout({
        presentation: 'balanced',
        viewportWidth: 1440,
        rootFontSize: 16,
      })
    ).toMatchObject({ template: 'standard', dockItemCount: 8, dockPreferredWidth: 864 });
  });

  it('restores the expressive 1920 skeleton on the 7+5 adaptive-wide contract', () => {
    expect(
      resolveHomeLoadingLayout({
        presentation: 'expressive',
        viewportWidth: 1920,
        rootFontSize: 16,
      })
    ).toMatchObject({
      template: 'adaptive-wide',
      dockItemCount: 12,
      dockPreferredWidth: 1120,
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
