export type ProductExperienceKey =
  | 'dwaion'
  | 'work'
  | 'activity'
  | 'communications'
  | 'services'
  | 'hcm'
  | 'calendar'
  | 'rooms'
  | 'approvals'
  | 'mail'
  | 'messaging'
  | 'notifications'
  | 'spaces'
  | 'meetings';

export type ProductExperienceProfile = {
  key: ProductExperienceKey;
  concept:
    | 'intelligence-flow'
    | 'execution-flow'
    | 'signal-flow'
    | 'broadcast-flow'
    | 'service-flow'
    | 'people-flow'
    | 'temporal-flow'
    | 'resource-flow'
    | 'decision-flow'
    | 'communication-flow'
    | 'conversation-flow'
    | 'collaboration-flow'
    | 'attention-flow'
    | 'meeting-flow';
  density: 'comfortable' | 'standard';
  accent: string;
  secondary: string;
  softSurface: string;
  canvas: string;
  sidebar: string;
  selection: string;
};

export type ProductExperienceToneContext = {
  mode: 'light' | 'dark';
  highContrast: boolean;
  canvas: string;
  sidebar: string;
};

export type ResolvedProductExperienceTones = {
  accent: string;
  secondary: string;
};

export const PRODUCT_EXPERIENCE_FOREGROUND_CONTRAST = 4.5;
export const PRODUCT_EXPERIENCE_SELECTION_OPACITY = 0.12;
export const PRODUCT_EXPERIENCE_SOFT_OPACITY = 0.18;

// Reserve enough contrast for the accent-tinted selection surface beneath foreground labels.
const PRODUCT_EXPERIENCE_RESOLUTION_CONTRAST = 5.5;

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

function contrastRatio(foreground: Rgb, background: Rgb): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
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

function minimumContrast(color: Rgb, surfaces: readonly Rgb[]): number {
  return Math.min(...surfaces.map((surface) => contrastRatio(color, surface)));
}

/**
 * Keeps the product hue as close as possible to its light-theme identity while making it safe
 * for foreground text, icons, focus indicators, and navigation selection marks on every product
 * shell surface. Standard light mode intentionally preserves the authored brand colors exactly.
 */
function resolveForegroundTone(tone: string, surfaces: readonly string[]): string {
  const parsedTone = parseHexColor(tone);
  const parsedSurfaces = surfaces
    .map((surface) => parseHexColor(surface))
    .filter((surface): surface is Rgb => surface !== undefined);
  if (!parsedTone || parsedSurfaces.length === 0) return tone;

  if (minimumContrast(parsedTone, parsedSurfaces) >= PRODUCT_EXPERIENCE_RESOLUTION_CONTRAST) {
    return serializeHexColor(parsedTone);
  }

  const anchors: readonly Rgb[] = [
    { red: 0, green: 0, blue: 0 },
    { red: 255, green: 255, blue: 255 },
  ];
  const anchor = anchors.reduce((best, candidate) =>
    minimumContrast(candidate, parsedSurfaces) > minimumContrast(best, parsedSurfaces)
      ? candidate
      : best
  );

  for (let step = 1; step <= 512; step += 1) {
    const serializedCandidate = serializeHexColor(mixColor(parsedTone, anchor, step / 512));
    const candidate = parseHexColor(serializedCandidate)!;
    if (minimumContrast(candidate, parsedSurfaces) >= PRODUCT_EXPERIENCE_RESOLUTION_CONTRAST) {
      return serializedCandidate;
    }
  }

  return serializeHexColor(anchor);
}

export function resolveProductExperienceTones(
  profile: ProductExperienceProfile,
  context: ProductExperienceToneContext
): ResolvedProductExperienceTones {
  if (context.mode === 'light' && !context.highContrast) {
    return { accent: profile.accent, secondary: profile.secondary };
  }

  const surfaces = [context.canvas, context.sidebar];
  return {
    accent: resolveForegroundTone(profile.accent, surfaces),
    secondary: resolveForegroundTone(profile.secondary, surfaces),
  };
}

export const productExperienceRegistry = {
  dwaion: {
    key: 'dwaion',
    concept: 'intelligence-flow',
    density: 'comfortable',
    accent: '#1557D5',
    secondary: '#008F7A',
    softSurface: '#EAF1FF',
    canvas: '#F5F7FB',
    sidebar: '#FBFCFF',
    selection: '#E6EEFC',
  },
  work: {
    key: 'work',
    concept: 'execution-flow',
    density: 'standard',
    accent: '#285C9E',
    secondary: '#0C847C',
    softSurface: '#E7F0FA',
    canvas: '#F5F7FA',
    sidebar: '#FBFCFD',
    selection: '#E5EDF7',
  },
  activity: {
    key: 'activity',
    concept: 'signal-flow',
    density: 'standard',
    accent: '#176E78',
    secondary: '#B65449',
    softSurface: '#E4F1F2',
    canvas: '#F5F8F8',
    sidebar: '#FBFCFC',
    selection: '#E2EFF0',
  },
  communications: {
    key: 'communications',
    concept: 'broadcast-flow',
    density: 'comfortable',
    accent: '#A83E57',
    secondary: '#16756E',
    softSurface: '#F7E9ED',
    canvas: '#F8F7F8',
    sidebar: '#FDFBFC',
    selection: '#F4E5EA',
  },
  services: {
    key: 'services',
    concept: 'service-flow',
    density: 'comfortable',
    accent: '#176F66',
    secondary: '#B64D58',
    softSurface: '#E5F2EF',
    canvas: '#F5F8F7',
    sidebar: '#FBFCFC',
    selection: '#E1EFEC',
  },
  hcm: {
    key: 'hcm',
    concept: 'people-flow',
    density: 'comfortable',
    accent: '#11756D',
    secondary: '#C94F68',
    softSurface: '#E7F4F1',
    canvas: '#F5F8F7',
    sidebar: '#FBFCFC',
    selection: '#E3F1EE',
  },
  calendar: {
    key: 'calendar',
    concept: 'temporal-flow',
    density: 'standard',
    accent: '#2764C4',
    secondary: '#008C95',
    softSurface: '#EAF2FF',
    canvas: '#F5F7FB',
    sidebar: '#FAFBFD',
    selection: '#E7EFFC',
  },
  rooms: {
    key: 'rooms',
    concept: 'resource-flow',
    density: 'standard',
    accent: '#176F6A',
    secondary: '#B24F5E',
    softSurface: '#E5F3F0',
    canvas: '#F5F8F8',
    sidebar: '#FBFCFC',
    selection: '#E1F0ED',
  },
  mail: {
    key: 'mail',
    concept: 'communication-flow',
    density: 'standard',
    accent: '#176B63',
    secondary: '#C24E63',
    softSurface: '#E5F3F0',
    canvas: '#F5F8F8',
    sidebar: '#FBFCFC',
    selection: '#E1F0ED',
  },
  messaging: {
    key: 'messaging',
    concept: 'conversation-flow',
    density: 'standard',
    accent: '#2856C7',
    secondary: '#0F8B8D',
    softSurface: '#E8F0FF',
    canvas: '#F6F8FC',
    sidebar: '#FBFCFF',
    selection: '#E8EFFD',
  },
  notifications: {
    key: 'notifications',
    concept: 'attention-flow',
    density: 'standard',
    accent: '#245B78',
    secondary: '#B3533E',
    softSurface: '#E8F1F4',
    canvas: '#F5F8F9',
    sidebar: '#FBFCFC',
    selection: '#E4EEF2',
  },
  approvals: {
    key: 'approvals',
    concept: 'decision-flow',
    density: 'standard',
    accent: '#28517A',
    secondary: '#B66A0A',
    softSurface: '#EAF0F5',
    canvas: '#F7F7F5',
    sidebar: '#FCFCFB',
    selection: '#E7EDF2',
  },
  spaces: {
    key: 'spaces',
    concept: 'collaboration-flow',
    density: 'comfortable',
    accent: '#315B7A',
    secondary: '#C0524F',
    softSurface: '#E8F0F4',
    canvas: '#F5F7F7',
    sidebar: '#FBFCFC',
    selection: '#E5EDF2',
  },
  meetings: {
    key: 'meetings',
    concept: 'meeting-flow',
    density: 'standard',
    accent: '#2A61C9',
    secondary: '#0B6B74',
    softSurface: '#E8F0FC',
    canvas: '#F6F8FC',
    sidebar: '#FBFCFF',
    selection: '#E6EEFB',
  },
} as const satisfies Record<ProductExperienceKey, ProductExperienceProfile>;

export function getProductExperienceProfile(key: ProductExperienceKey): ProductExperienceProfile {
  return productExperienceRegistry[key];
}
