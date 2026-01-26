const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';

/**
 * Returns font-family string: optional font name + system fallback.
 */
export const setFont = (fontName?: string): string =>
  fontName ? `"${fontName}", ${SYSTEM_FONT_STACK}` : SYSTEM_FONT_STACK;

/**
 * Converts rem string to px (e.g. "1.5rem" -> 24).
 */
export const remToPx = (value: string): number => {
  const num = parseFloat(value);
  return Math.round(num * 16);
};

/**
 * Converts px to rem string (e.g. 24 -> "1.5rem").
 */
export const pxToRem = (value: number): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`Invalid pixel value: ${value}`);
  }
  return `${value / 16}rem`;
};
