import { describe, expect, it } from 'vitest';

import { getContrastRatio } from '@mui/material/styles';

import { messagingVisualTone } from './messaging-visual-model';

describe('messaging identity colors', () => {
  it('keeps a stable identity color across renders', () => {
    expect(messagingVisualTone('person-42')).toEqual(messagingVisualTone('person-42'));
    expect(messagingVisualTone(42)).toEqual(messagingVisualTone('42'));
  });

  it('preserves readable initials across every categorical color', () => {
    const tones = Array.from({ length: 100 }, (_, index) => messagingVisualTone(index));
    expect(new Set(tones.map((tone) => tone.foreground)).size).toBe(6);
    for (const tone of tones) {
      expect(getContrastRatio(tone.foreground, tone.surface)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
