import { describe, expect, it } from 'vitest';

import {
  localizationChangeTypeLabelKey,
  localizationDecisionLabelKey,
  localizationRevisionStateColor,
  localizationRevisionStateLabelKey,
} from './localization-studio-presentation';

describe('localization studio presentation', () => {
  it('maps supported values to localized labels', () => {
    expect(localizationRevisionStateLabelKey('PUBLISHED')).toBe('localization.states.PUBLISHED');
    expect(localizationChangeTypeLabelKey('UPDATED')).toBe('localization.diff.states.UPDATED');
    expect(localizationDecisionLabelKey('APPROVED')).toBe('localization.decisions.APPROVED');
  });

  it('fails closed for unknown server values', () => {
    expect(localizationRevisionStateLabelKey('FUTURE')).toBe('localization.states.UNKNOWN');
    expect(localizationRevisionStateColor('FUTURE')).toBe('default');
    expect(localizationChangeTypeLabelKey('FUTURE')).toBe('localization.diff.states.UNKNOWN');
    expect(localizationDecisionLabelKey('FUTURE')).toBe('localization.decisions.UNKNOWN');
  });
});
