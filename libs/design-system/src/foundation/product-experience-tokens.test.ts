import { getContrastRatio } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';

import {
  PRODUCT_EXPERIENCE_FOREGROUND_CONTRAST,
  PRODUCT_EXPERIENCE_SELECTION_OPACITY,
  PRODUCT_EXPERIENCE_SOFT_OPACITY,
  productExperienceRegistry,
  resolveProductExperienceTones,
} from './product-experience-tokens';

function compositeHex(foreground: string, background: string, opacity: number): string {
  const channels = (color: string) =>
    [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
  const foregroundChannels = channels(foreground);
  const backgroundChannels = channels(background);
  return `#${foregroundChannels
    .map((channel, index) =>
      Math.round(channel * opacity + backgroundChannels[index]! * (1 - opacity))
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`;
}

describe('product experience visual tokens', () => {
  it('keeps every primary product accent readable on its light canvas', () => {
    for (const profile of Object.values(productExperienceRegistry)) {
      expect(
        getContrastRatio(profile.accent, profile.canvas),
        `${profile.key} accent must satisfy WCAG AA on its canvas`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps secondary product signals distinguishable from their canvas', () => {
    for (const profile of Object.values(productExperienceRegistry)) {
      expect(
        getContrastRatio(profile.secondary, profile.canvas),
        `${profile.key} secondary signal must retain non-text contrast`
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('preserves the authored product identity in standard light mode', () => {
    for (const profile of Object.values(productExperienceRegistry)) {
      expect(
        resolveProductExperienceTones(profile, {
          mode: 'light',
          highContrast: false,
          canvas: profile.canvas,
          sidebar: profile.sidebar,
        })
      ).toEqual({ accent: profile.accent, secondary: profile.secondary });
    }
  });

  it.each([
    {
      label: 'dark',
      mode: 'dark' as const,
      highContrast: false,
      canvas: '#0F151D',
      sidebar: '#1D2530',
    },
    {
      label: 'dark high contrast',
      mode: 'dark' as const,
      highContrast: true,
      canvas: '#000000',
      sidebar: '#000000',
    },
    {
      label: 'light high contrast',
      mode: 'light' as const,
      highContrast: true,
      canvas: '#FFFFFF',
      sidebar: '#FFFFFF',
    },
  ])('resolves every foreground tone to WCAG AA on $label surfaces', (context) => {
    for (const profile of Object.values(productExperienceRegistry)) {
      const tones = resolveProductExperienceTones(profile, context);
      for (const [name, tone] of Object.entries(tones)) {
        expect(
          getContrastRatio(tone, context.canvas),
          `${profile.key} ${name} must satisfy WCAG AA on the ${context.label} canvas`
        ).toBeGreaterThanOrEqual(PRODUCT_EXPERIENCE_FOREGROUND_CONTRAST);
        expect(
          getContrastRatio(tone, context.sidebar),
          `${profile.key} ${name} must satisfy WCAG AA on the ${context.label} sidebar`
        ).toBeGreaterThanOrEqual(PRODUCT_EXPERIENCE_FOREGROUND_CONTRAST);
      }
    }
  });

  it('keeps selected navigation labels readable and soft glyphs distinguishable in dark modes', () => {
    for (const context of [
      {
        mode: 'dark' as const,
        highContrast: false,
        canvas: '#0F151D',
        sidebar: '#1D2530',
      },
      {
        mode: 'dark' as const,
        highContrast: true,
        canvas: '#000000',
        sidebar: '#000000',
      },
    ]) {
      for (const profile of Object.values(productExperienceRegistry)) {
        const { accent } = resolveProductExperienceTones(profile, context);
        const selection = compositeHex(
          accent,
          context.sidebar,
          PRODUCT_EXPERIENCE_SELECTION_OPACITY
        );
        const softSurface = compositeHex(accent, context.canvas, PRODUCT_EXPERIENCE_SOFT_OPACITY);

        expect(
          getContrastRatio(accent, selection),
          `${profile.key} selected label must satisfy WCAG AA`
        ).toBeGreaterThanOrEqual(PRODUCT_EXPERIENCE_FOREGROUND_CONTRAST);
        expect(
          getContrastRatio(accent, softSurface),
          `${profile.key} soft glyph must satisfy non-text contrast`
        ).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
