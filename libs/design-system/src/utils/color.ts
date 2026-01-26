/**
 * Converts hex color to RGB channels string (e.g. "#00B8D9" -> "0 184 217").
 */
export const hexToRgbChannel = (hexColor: string): string => {
  if (!hexColor) throw new Error('Hex color is undefined!');
  if (!/^#[0-9A-F]{6}$/i.test(hexColor)) {
    throw new Error(`Invalid hex color: ${hexColor}`);
  }
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  return `${r} ${g} ${b}`;
};

export type InputPalette = Record<string, string | undefined>;

export type ChannelPalette<T extends InputPalette> = T & {
  [K in keyof T as `${string & K}Channel`]: string;
};

/**
 * Adds *Channel keys to a palette of hex colors (e.g. main -> mainChannel with "r g b").
 */
export const createPaletteChannel = <T extends InputPalette>(
  hexPalette: T
): ChannelPalette<T> => {
  const channelEntries: Record<string, string> = {};
  for (const [key, value] of Object.entries(hexPalette)) {
    if (value) channelEntries[`${key}Channel`] = hexToRgbChannel(value);
  }
  return { ...hexPalette, ...channelEntries } as ChannelPalette<T>;
};

const UNSUPPORTED_ALPHA_FORMAT_MSG = [
  '[Alpha]: Unsupported color format.',
  'Supported: RGB channels "0 184 217" or CSS var with Channel, e.g. var(--palette-common-blackChannel, #000000).',
  'Unsupported: hex, rgb(), rgba().',
].join(' ');

/**
 * Returns rgba() using RGB channels or CSS variable (e.g. "0 184 217" or "var(--xChannel)").
 * Result: "rgba(0 184 217 / 0.8)" or "rgba(var(--xChannel) / 0.8)".
 */
export const varAlpha = (color: string, opacity: number = 1): string => {
  if (!color) throw new Error('[Alpha]: Color is undefined!');
  const isHex = color.startsWith('#');
  const isRgb = color.startsWith('rgb');
  const looksLikeChannel =
    !color.includes('var') && color.includes('Channel');
  if (isHex || isRgb || looksLikeChannel) {
    throw new Error(UNSUPPORTED_ALPHA_FORMAT_MSG);
  }
  return `rgba(${color} / ${opacity})`;
};
