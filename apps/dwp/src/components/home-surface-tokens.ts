import { foundationTokens } from '@dwp-frontend/design-system/foundation';

const neutral = foundationTokens.color.neutral;

export const HOME_SURFACE_TOKENS = {
  light: {
    canvas: neutral[50],
    section: neutral[0],
    inset: neutral[25],
    floating: 'rgba(255, 255, 255, 0.94)',
    text: neutral[900],
    textMuted: neutral[500],
    borderDecorative: neutral[200],
    borderInteractive: neutral[400],
  },
  dark: {
    canvas: neutral[900],
    section: neutral[800],
    inset: neutral[900],
    floating: 'rgba(17, 26, 38, 0.94)',
    text: neutral[25],
    textMuted: neutral[200],
    borderDecorative: neutral[500],
    borderInteractive: neutral[400],
  },
} as const;

export const HOME_STATUS_TOKENS = {
  light: {
    neutral: neutral[500],
    info: foundationTokens.color.status.info,
    success: foundationTokens.color.status.success,
    warning: foundationTokens.color.status.warning,
    error: foundationTokens.color.status.error,
  },
  dark: {
    neutral: neutral[200],
    info: '#58B5E8',
    success: '#4CC38A',
    warning: '#E4A84B',
    error: '#F0786A',
  },
} as const;

export const HOME_WORKSCAPE_TOKENS = {
  light: {
    base: '#0B1D3A',
    on: '#F8FAFC',
    onMuted: 'rgba(248, 250, 252, 0.82)',
    border: 'rgba(23, 48, 86, 0.18)',
    shadow: '0 16px 40px rgba(15, 34, 64, 0.12)',
  },
  dark: {
    base: '#07111F',
    on: '#F8FAFC',
    onMuted: 'rgba(248, 250, 252, 0.82)',
    border: 'rgba(255, 255, 255, 0.18)',
    shadow: '0 16px 40px rgba(0, 0, 0, 0.28)',
  },
  scrim: {
    rgb: '3, 11, 27',
    safe: 0.74,
    middle: 0.46,
    far: 0.1,
    mobile: 0.58,
  },
} as const;

export const HOME_FORCED_COLOR_TOKENS = {
  canvas: 'Canvas',
  section: 'Canvas',
  text: 'CanvasText',
  border: 'CanvasText',
  focus: 'Highlight',
  image: 'none',
  shadow: 'none',
  backdropFilter: 'none',
} as const;

/** Motion is feedback for an action, never ambient decoration. */
export const HOME_MOTION_TOKENS = {
  quick: '140ms',
  standard: '200ms',
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  lift: 'translateY(-2px)',
} as const;

// Stable aliases for existing Home shell consumers.
export const HOME_LIGHT_CANVAS = HOME_SURFACE_TOKENS.light.canvas;
export const HOME_LIGHT_SURFACE = HOME_SURFACE_TOKENS.light.section;
export const HOME_LIGHT_SURFACE_SUBTLE = HOME_SURFACE_TOKENS.light.inset;

export type HomeStatusTone = keyof (typeof HOME_STATUS_TOKENS)['light'];
export type HomePrioritySignal =
  'low' | 'medium' | 'high' | 'attention' | 'overdue' | 'blocked' | 'critical' | 'risk';

/** Priority is not failure: only overdue, blocked, critical, or risk states use error. */
export function resolveHomePriorityTone(signal: HomePrioritySignal): HomeStatusTone {
  if (signal === 'high' || signal === 'attention') return 'warning';
  if (signal === 'overdue' || signal === 'blocked' || signal === 'critical' || signal === 'risk') {
    return 'error';
  }
  return 'neutral';
}

const HEX_COLOR = /^#[\da-f]{6}$/iu;

type Rgb = Readonly<{ red: number; green: number; blue: number }>;

function parseHexColor(value: string): Rgb | undefined {
  if (!HEX_COLOR.test(value)) return undefined;
  return {
    red: Number.parseInt(value.slice(1, 3), 16),
    green: Number.parseInt(value.slice(3, 5), 16),
    blue: Number.parseInt(value.slice(5, 7), 16),
  };
}

function serializeHexColor({ red, green, blue }: Rgb): string {
  const channel = (value: number) => Math.round(value).toString(16).padStart(2, '0');
  return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase();
}

function relativeLuminance(color: Rgb): number {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return channel(color.red) * 0.2126 + channel(color.green) * 0.7152 + channel(color.blue) * 0.0722;
}

export function homeColorContrastRatio(foreground: string, background: string): number {
  const foregroundRgb = parseHexColor(foreground);
  const backgroundRgb = parseHexColor(background);
  if (!foregroundRgb || !backgroundRgb) return 0;
  const foregroundLuminance = relativeLuminance(foregroundRgb);
  const backgroundLuminance = relativeLuminance(backgroundRgb);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

function mixColor(from: Rgb, to: Rgb, amount: number): Rgb {
  return {
    red: from.red + (to.red - from.red) * amount,
    green: from.green + (to.green - from.green) * amount,
    blue: from.blue + (to.blue - from.blue) * amount,
  };
}

/**
 * Returns the least-adjusted tenant accent that is safe as foreground text or an icon.
 * Brand fills keep their original accent; semantic status colors never use this result.
 */
export function resolveTenantAccentForeground(
  accentColor: string,
  surfaceColor: string,
  minimumContrast = 4.5
): string {
  const fallbackAccent = foundationTokens.color.product.primary;
  const accent = parseHexColor(accentColor) ?? parseHexColor(fallbackAccent)!;
  const surface = parseHexColor(surfaceColor) ?? parseHexColor(HOME_LIGHT_SURFACE)!;
  const normalizedAccent = serializeHexColor(accent);
  const normalizedSurface = serializeHexColor(surface);
  const targetContrast = Math.min(21, Math.max(1, minimumContrast));
  if (homeColorContrastRatio(normalizedAccent, normalizedSurface) >= targetContrast) {
    return normalizedAccent;
  }

  const black: Rgb = { red: 0, green: 0, blue: 0 };
  const white: Rgb = { red: 255, green: 255, blue: 255 };
  const anchor =
    homeColorContrastRatio('#000000', normalizedSurface) >=
    homeColorContrastRatio('#FFFFFF', normalizedSurface)
      ? black
      : white;

  for (let step = 1; step <= 512; step += 1) {
    const candidate = serializeHexColor(mixColor(accent, anchor, step / 512));
    if (homeColorContrastRatio(candidate, normalizedSurface) >= targetContrast) return candidate;
  }
  return serializeHexColor(anchor);
}
