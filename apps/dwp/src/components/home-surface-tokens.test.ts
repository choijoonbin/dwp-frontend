import { describe, expect, it } from 'vitest';

import {
  HOME_FORCED_COLOR_TOKENS,
  HOME_LIGHT_CANVAS,
  HOME_LIGHT_SURFACE,
  HOME_LIGHT_SURFACE_SUBTLE,
  HOME_STATUS_TOKENS,
  HOME_SURFACE_TOKENS,
  HOME_WORKSCAPE_TOKENS,
  homeColorContrastRatio,
  resolveHomePriorityTone,
  resolveTenantAccentForeground,
} from './home-surface-tokens';

describe('Home semantic color contracts', () => {
  it('keeps the light and dark surface hierarchy stable', () => {
    expect(HOME_SURFACE_TOKENS.light).toMatchObject({
      canvas: '#F3F5F7',
      section: '#FFFFFF',
      inset: '#FAFBFC',
      borderDecorative: '#CBD2D9',
      borderInteractive: '#6B7785',
    });
    expect(HOME_SURFACE_TOKENS.dark).toMatchObject({
      canvas: '#0F151D',
      section: '#1D2530',
      inset: '#0F151D',
      borderDecorative: '#4B5663',
      borderInteractive: '#6B7785',
    });
    expect(HOME_LIGHT_CANVAS).toBe(HOME_SURFACE_TOKENS.light.canvas);
    expect(HOME_LIGHT_SURFACE).toBe(HOME_SURFACE_TOKENS.light.section);
    expect(HOME_LIGHT_SURFACE_SUBTLE).toBe(HOME_SURFACE_TOKENS.light.inset);
    expect(
      homeColorContrastRatio(
        HOME_SURFACE_TOKENS.light.borderInteractive,
        HOME_SURFACE_TOKENS.light.section
      )
    ).toBeGreaterThanOrEqual(3);
    expect(
      homeColorContrastRatio(
        HOME_SURFACE_TOKENS.dark.borderInteractive,
        HOME_SURFACE_TOKENS.dark.section
      )
    ).toBeGreaterThanOrEqual(3);
  });

  it('publishes readable operational status colors in both modes', () => {
    for (const tone of ['info', 'success', 'warning', 'error'] as const) {
      expect(
        homeColorContrastRatio(HOME_STATUS_TOKENS.light[tone], HOME_SURFACE_TOKENS.light.section)
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        homeColorContrastRatio(HOME_STATUS_TOKENS.dark[tone], HOME_SURFACE_TOKENS.dark.section)
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('separates priority from failure semantics', () => {
    expect(resolveHomePriorityTone('low')).toBe('neutral');
    expect(resolveHomePriorityTone('medium')).toBe('neutral');
    expect(resolveHomePriorityTone('high')).toBe('warning');
    expect(resolveHomePriorityTone('attention')).toBe('warning');
    expect(resolveHomePriorityTone('overdue')).toBe('error');
    expect(resolveHomePriorityTone('blocked')).toBe('error');
    expect(resolveHomePriorityTone('critical')).toBe('error');
    expect(resolveHomePriorityTone('risk')).toBe('error');
  });

  it('defines a complete forced-colors fallback without imagery or transparency', () => {
    expect(HOME_FORCED_COLOR_TOKENS).toEqual({
      canvas: 'Canvas',
      section: 'Canvas',
      text: 'CanvasText',
      border: 'CanvasText',
      focus: 'Highlight',
      image: 'none',
      shadow: 'none',
      backdropFilter: 'none',
    });
  });

  it('keeps Workscape copy and scrim safety floors explicit', () => {
    expect(HOME_WORKSCAPE_TOKENS.light.on).toBe('#F8FAFC');
    expect(HOME_WORKSCAPE_TOKENS.dark.on).toBe('#F8FAFC');
    expect(HOME_WORKSCAPE_TOKENS.scrim).toMatchObject({
      safe: 0.74,
      middle: 0.46,
      far: 0.1,
      mobile: 0.58,
    });
  });
});

describe('tenant accent foreground derivation', () => {
  it('preserves an accent that already meets text contrast', () => {
    expect(resolveTenantAccentForeground('#2457D6', '#FFFFFF')).toBe('#2457D6');
  });

  it('darkens a bright tenant accent for a light surface', () => {
    const foreground = resolveTenantAccentForeground('#F4D35E', '#FFFFFF');
    expect(foreground).not.toBe('#F4D35E');
    expect(homeColorContrastRatio(foreground, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('lightens a dark tenant accent for a dark surface', () => {
    const foreground = resolveTenantAccentForeground('#001122', '#1D2530');
    expect(foreground).not.toBe('#001122');
    expect(homeColorContrastRatio(foreground, '#1D2530')).toBeGreaterThanOrEqual(4.5);
  });

  it('falls back safely for invalid input and supports enhanced contrast', () => {
    const fallback = resolveTenantAccentForeground('not-a-color', '#FFFFFF');
    const enhanced = resolveTenantAccentForeground('#58B5E8', '#FFFFFF', 7);
    expect(fallback).toBe('#2457D6');
    expect(homeColorContrastRatio(enhanced, '#FFFFFF')).toBeGreaterThanOrEqual(7);
    expect(homeColorContrastRatio('#invalid', '#FFFFFF')).toBe(0);
  });
});
