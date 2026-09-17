import { describe, expect, it } from 'vitest';

import {
  buildPersonalPreferenceUndoPatch,
  findPersonalPreferenceConflicts,
  resolvePersonalPreferenceConflictPatch,
} from './personal-preference-conflict';

import type { PersonalPreferenceValues } from '@dwp-frontend/shared-utils';

const base: PersonalPreferenceValues = {
  appearance: { mode: 'system', density: 'standard' },
  accessibility: {
    highContrast: false,
    reduceMotion: false,
    underlineLinks: false,
    reduceTransparency: false,
  },
  regional: {
    timeZone: 'system',
    dateFormat: 'locale',
    timeFormat: 'locale',
    firstDayOfWeek: 'locale',
    numberFormat: 'locale',
  },
};

describe('personal preference conflict model', () => {
  it('requires a decision only when local and remote changed the same field differently', () => {
    const remote: PersonalPreferenceValues = {
      ...base,
      appearance: { mode: 'dark', density: 'compact' },
    };

    expect(
      findPersonalPreferenceConflicts(base, remote, {
        appearance: { mode: 'light' },
        accessibility: { highContrast: true },
      })
    ).toEqual([
      {
        path: 'appearance.mode',
        baseValue: 'system',
        localValue: 'light',
        remoteValue: 'dark',
      },
    ]);
  });

  it('does not block when both writers reached the same value', () => {
    const remote: PersonalPreferenceValues = {
      ...base,
      accessibility: { ...base.accessibility, reduceMotion: true },
    };

    expect(
      findPersonalPreferenceConflicts(base, remote, {
        accessibility: { reduceMotion: true },
      })
    ).toEqual([]);
  });

  it('keeps non-conflicting edits and applies the user choice per conflicting field', () => {
    const patch = {
      appearance: { mode: 'light' as const, density: 'compact' as const },
      accessibility: { highContrast: true },
    };

    expect(
      resolvePersonalPreferenceConflictPatch(patch, {
        'appearance.mode': 'remote',
        'appearance.density': 'local',
      })
    ).toEqual({
      appearance: { density: 'compact' },
      accessibility: { highContrast: true },
    });
  });

  it('builds an undo patch from the last confirmed values for only the saved fields', () => {
    expect(
      buildPersonalPreferenceUndoPatch(base, {
        appearance: { mode: 'dark' },
        regional: { timeZone: 'Asia/Seoul' },
      })
    ).toEqual({
      appearance: { mode: 'system' },
      regional: { timeZone: 'system' },
    });
  });
});
