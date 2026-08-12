import { beforeEach, describe, expect, it } from 'vitest';

import {
  defaultRegionalPreference,
  normalizeRegionalPreference,
  readRegionalPreference,
  writeRegionalPreference,
} from './regional-preference';

describe('regional preference contract', () => {
  beforeEach(() => window.localStorage.clear());

  it('normalizes unsupported values without dropping supported fields', () => {
    expect(
      normalizeRegionalPreference({
        timeZone: 'Asia/Seoul',
        dateFormat: 'unsupported',
        timeFormat: '24_hour',
      })
    ).toEqual({
      ...defaultRegionalPreference,
      timeZone: 'Asia/Seoul',
      timeFormat: '24_hour',
    });
  });

  it('persists the complete versioned regional document', () => {
    const preference = {
      ...defaultRegionalPreference,
      timeZone: 'UTC' as const,
      numberFormat: 'dot_decimal' as const,
    };

    writeRegionalPreference(preference);

    expect(readRegionalPreference()).toEqual(preference);
  });
});
