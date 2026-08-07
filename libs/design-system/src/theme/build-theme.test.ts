import { describe, expect, it } from 'vitest';

import { foundationTokens } from '../foundation';
import { buildDwpTheme } from './build-theme';

const baseInput = {
  mode: 'light' as const,
  density: 'standard' as const,
  highContrast: false,
  reduceMotion: false,
  accentColor: foundationTokens.color.product.primary,
  fontFamily: foundationTokens.font.ui,
};

describe('buildDwpTheme', () => {
  it('uses the DWP namespace and the approved product accent', () => {
    const theme = buildDwpTheme(baseInput);

    expect((theme as unknown as { cssVarPrefix?: string }).cssVarPrefix).toBe('dwp');
    expect(theme.palette.primary.main).toBe(foundationTokens.color.product.primary);
    expect(theme.typography.fontFamily).toBe(foundationTokens.font.ui);
  });

  it('falls back to the product accent for an invalid tenant color', () => {
    const theme = buildDwpTheme({ ...baseInput, accentColor: 'not-a-color' });

    expect(theme.palette.primary.main).toBe(foundationTokens.color.product.primary);
  });

  it('resolves density metrics from the DTCG token adapter', () => {
    const theme = buildDwpTheme({ ...baseInput, density: 'compact' });
    const buttonRoot = theme.components?.MuiButton?.styleOverrides?.root as {
      minHeight?: number;
    };
    const menuItemRoot = theme.components?.MuiMenuItem?.styleOverrides?.root as {
      minHeight?: number;
    };

    expect(buttonRoot.minHeight).toBe(foundationTokens.density.compact.controlHeight);
    expect(menuItemRoot.minHeight).toBe(foundationTokens.density.compact.itemHeight);
  });

  it('provides explicit high-contrast colors and removes motion durations', () => {
    const theme = buildDwpTheme({
      ...baseInput,
      mode: 'dark',
      highContrast: true,
      reduceMotion: true,
    });

    expect(theme.palette.background.default).toBe('#000000');
    expect(theme.palette.text.primary).toBe('#FFFFFF');
    expect(theme.transitions.duration.standard).toBe(0);

    const toggleRoot = theme.components?.MuiToggleButton?.styleOverrides?.root as {
      '&.Mui-selected'?: { backgroundColor?: string };
    };
    expect(toggleRoot['&.Mui-selected']?.backgroundColor).toBe('#B7CBFF');
  });
});
