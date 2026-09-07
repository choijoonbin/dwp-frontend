import { alpha, createTheme } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';

import { meetingInsetSurface, meetingSurface } from './meeting-visual-system';

describe('meeting surface hierarchy', () => {
  const light = createTheme({ palette: { mode: 'light' } });
  const dark = createTheme({ palette: { mode: 'dark' } });

  it('keeps a neutral section flat and separates the inset tier', () => {
    const section = meetingSurface(light);
    const inset = meetingInsetSurface(light);

    expect(section.backgroundColor).toBe(light.palette.background.paper);
    expect(section.boxShadow).toBe('none');
    expect(section.borderTopWidth).toBe(1);
    expect(inset.backgroundColor).toBe(alpha(light.palette.text.primary, 0.045));
    expect(inset).not.toHaveProperty('boxShadow');
  });

  it('gives semantic or explicitly elevated surfaces restrained prominence', () => {
    const semantic = meetingSurface(light, { tone: 'primary' });
    const elevated = meetingSurface(light, { elevated: true });

    expect(semantic.backgroundColor).toBe(alpha(light.palette.primary.main, 0.04));
    expect(semantic.boxShadow).toBe(light.shadows[2]);
    expect(semantic.borderTopWidth).toBe(2);
    expect(elevated.backgroundColor).toBe(alpha(light.palette.text.primary, 0.04));
    expect(elevated.boxShadow).toBe(light.shadows[2]);
  });

  it('preserves dark, reduced-motion, and forced-colors behavior', () => {
    const surface = meetingSurface(dark, {
      tone: 'success',
      elevated: true,
      interactive: true,
    });

    expect(surface.backgroundColor).toBe(alpha(dark.palette.success.main, 0.1));
    expect(surface.boxShadow).toBe(dark.shadows[2]);
    expect(surface['@media (prefers-reduced-motion: reduce)']).toEqual({ transition: 'none' });
    expect(surface['@media (forced-colors: active)']).toMatchObject({
      background: 'Canvas',
      boxShadow: 'none',
    });
  });
});
