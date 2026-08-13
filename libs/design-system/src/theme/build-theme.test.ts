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

  it('keeps contained primary actions on the accessible tenant accent in every interaction state', () => {
    const theme = buildDwpTheme(baseInput);
    const buttonRoot = theme.components?.MuiButton?.styleOverrides?.root as {
      '&.MuiButton-containedPrimary'?: {
        color?: string;
        backgroundColor?: string;
        '&:hover'?: { backgroundColor?: string };
      };
    };
    const containedPrimary = buttonRoot['&.MuiButton-containedPrimary'];

    expect(containedPrimary?.color).toBe('#FFFFFF');
    expect(containedPrimary?.backgroundColor).toBe(foundationTokens.color.product.primary);
    expect(containedPrimary?.['&:hover']?.backgroundColor).toBe(
      foundationTokens.color.product.primary
    );
  });

  it('uses dark action text when a tenant chooses a light accent', () => {
    const theme = buildDwpTheme({ ...baseInput, accentColor: '#F4D35E' });
    const buttonRoot = theme.components?.MuiButton?.styleOverrides?.root as {
      '&.MuiButton-containedPrimary'?: { color?: string; backgroundColor?: string };
    };

    expect(buttonRoot['&.MuiButton-containedPrimary']).toMatchObject({
      color: '#0F151D',
      backgroundColor: '#F4D35E',
    });
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

  it('neutralizes browser autofill colors without hiding the entered value', () => {
    const theme = buildDwpTheme(baseInput);
    const input = theme.components?.MuiInputBase?.styleOverrides?.input as {
      '&:-webkit-autofill'?: {
        WebkitBoxShadow?: string;
        WebkitTextFillColor?: string;
      };
    };

    expect(input['&:-webkit-autofill']?.WebkitBoxShadow).toContain(
      foundationTokens.color.neutral[0]
    );
    expect(input['&:-webkit-autofill']?.WebkitTextFillColor).toBe(
      foundationTokens.color.neutral[900]
    );
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
