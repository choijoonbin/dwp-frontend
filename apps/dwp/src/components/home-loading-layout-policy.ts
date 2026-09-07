import type { HomePresentation } from '@dwp-frontend/shared-utils';

export type HomePresentationHint = HomePresentation;

export type HomeLoadingReadTemplate = 'single-column' | 'standard' | 'adaptive-wide';

export type HomePresentationHintStorage = Readonly<{
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}>;

export type HomeLoadingLayout = Readonly<{
  presentation: HomePresentationHint;
  maxWidth: number;
  template: HomeLoadingReadTemplate;
  dockItemCount: number;
  dockStacked: boolean;
}>;

export const HOME_PRESENTATION_HINT_STORAGE_KEY = 'dwp.home.presentation-hint.v1';
export const HOME_LAUNCHPAD_HINT_STORAGE_KEY = 'dwp.home.launchpad-hint.v1';
export const HOME_LOADING_LARGE_TEXT_ROOT_PX = 24;

// One width contract for saved presentation, editor preview, and loading geometry.
export const HOME_PRESENTATION_MAX_WIDTH = {
  focused: 1280,
  balanced: 1680,
  expressive: 2560,
} as const satisfies Record<HomePresentation, number>;

export const HOME_REFERENCE_GRID_PLACEMENTS = {
  'action-queue': { gridColumn: '1 / span 40', row: 1 },
  'role-pulse': { gridColumn: '41 / span 20', row: 1 },
  today: { gridColumn: '1 / span 20', row: 2 },
  'response-hub': { gridColumn: '21 / span 20', row: 2 },
  'focus-balance': { gridColumn: '41 / span 20', row: 2 },
  'request-tracker': { gridColumn: '1 / span 40', row: 3 },
  'meeting-load': { gridColumn: '41 / span 20', row: 3 },
} as const;

const DEFAULT_PRESENTATION: HomePresentationHint = 'balanced';
const DEFAULT_VIEWPORT_WIDTH = 1440;
const DEFAULT_ROOT_FONT_SIZE = 16;

export function normalizeHomePresentationHint(value: unknown): HomePresentationHint {
  return value === 'focused' || value === 'expressive' || value === 'balanced'
    ? value
    : DEFAULT_PRESENTATION;
}

export function readHomePresentationHint(
  storage: HomePresentationHintStorage | null | undefined
): HomePresentationHint {
  return readOptionalHomePresentationHint(storage) ?? DEFAULT_PRESENTATION;
}

export function readOptionalHomePresentationHint(
  storage: HomePresentationHintStorage | null | undefined
): HomePresentationHint | null {
  if (!storage) return null;
  try {
    const value = storage.getItem(HOME_PRESENTATION_HINT_STORAGE_KEY);
    return value === 'focused' || value === 'expressive' || value === 'balanced' ? value : null;
  } catch {
    return null;
  }
}

export function writeHomePresentationHint(
  storage: HomePresentationHintStorage | null | undefined,
  presentation: HomePresentationHint
): void {
  if (!storage) return;
  try {
    storage.setItem(
      HOME_PRESENTATION_HINT_STORAGE_KEY,
      normalizeHomePresentationHint(presentation)
    );
  } catch {
    // Storage can be unavailable in hardened or private browser contexts.
  }
}

export function readHomeLaunchpadGroupItemCounts(
  storage: HomePresentationHintStorage | null | undefined
): readonly number[] | null {
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(HOME_LAUNCHPAD_HINT_STORAGE_KEY) ?? 'null');
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 8) return null;
    const counts = parsed.map((value) =>
      typeof value === 'number' && Number.isFinite(value)
        ? Math.min(10, Math.max(0, Math.floor(value)))
        : Number.NaN
    );
    return counts.every(Number.isFinite) ? counts : null;
  } catch {
    return null;
  }
}

export function writeHomeLaunchpadGroupItemCounts(
  storage: HomePresentationHintStorage | null | undefined,
  counts: readonly number[]
): void {
  if (!storage || counts.length < 1 || counts.length > 8) return;
  try {
    storage.setItem(
      HOME_LAUNCHPAD_HINT_STORAGE_KEY,
      JSON.stringify(counts.map((count) => Math.min(10, Math.max(0, Math.floor(count)))))
    );
  } catch {
    // Storage can be unavailable in hardened or private browser contexts.
  }
}

export function resolveHomeLoadingLayout({
  presentation,
  viewportWidth,
  rootFontSize,
}: Readonly<{
  presentation: HomePresentationHint;
  viewportWidth: number;
  rootFontSize: number;
}>): HomeLoadingLayout {
  const safePresentation = normalizeHomePresentationHint(presentation);
  const safeViewportWidth = Number.isFinite(viewportWidth)
    ? Math.max(0, viewportWidth)
    : DEFAULT_VIEWPORT_WIDTH;
  const safeRootFontSize = Number.isFinite(rootFontSize)
    ? Math.max(0, rootFontSize)
    : DEFAULT_ROOT_FONT_SIZE;
  const largeText = safeRootFontSize >= HOME_LOADING_LARGE_TEXT_ROOT_PX;
  const template: HomeLoadingReadTemplate =
    largeText || safeViewportWidth < 900
      ? 'single-column'
      : safeViewportWidth >= 1200
        ? 'adaptive-wide'
        : 'standard';
  const dockItemCount =
    safeViewportWidth < 600
      ? 4
      : safeViewportWidth >= 900 && safeViewportWidth < 1200
        ? 6
        : safePresentation === 'expressive' && safeViewportWidth >= 1600
          ? 12
          : safePresentation === 'expressive' && safeViewportWidth >= 1200
            ? 10
            : 8;
  const dockStacked = safeViewportWidth >= 600;

  return {
    presentation: safePresentation,
    maxWidth: HOME_PRESENTATION_MAX_WIDTH[safePresentation],
    template,
    dockItemCount,
    dockStacked,
  };
}
