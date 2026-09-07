import { describe, expect, it } from 'vitest';

import { verifiedPercentage, verifiedPercentageLabel } from './dwaion-admin-metrics';

describe('DWAI·ON verified admin metrics', () => {
  it('returns a percentage only when the aggregate is complete and internally consistent', () => {
    expect(verifiedPercentage(8, 10)).toBe(80);
    expect(verifiedPercentageLabel(1, 3)).toBe('33%');
  });

  it('does not turn an unavailable or empty aggregate into a zero-percent claim', () => {
    expect(verifiedPercentageLabel()).toBe('—');
    expect(verifiedPercentageLabel(0, 0)).toBe('—');
    expect(verifiedPercentageLabel(2, 1)).toBe('—');
    expect(verifiedPercentageLabel(-1, 3)).toBe('—');
  });

  it('keeps a verified zero result distinct from unavailable data', () => {
    expect(verifiedPercentage(0, 5)).toBe(0);
    expect(verifiedPercentageLabel(0, 5)).toBe('0%');
  });
});
