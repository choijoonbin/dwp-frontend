import { describe, expect, it } from 'vitest';

import {
  hasReferenceLocale,
  isReferenceItemAvailable,
  preferredReferenceLabel,
  referenceDataErrorMessage,
  referenceValidityState,
} from './reference-data-manager-model';

import type { ReferenceItem } from '@dwp-frontend/shared-utils';

function item(overrides: Partial<ReferenceItem> = {}): ReferenceItem {
  return {
    code: 'STATUS_READY',
    lifecycleState: 'ACTIVE',
    sortOrder: 0,
    labels: [
      { locale: 'ko', label: '준비' },
      { locale: 'en-US', label: 'Ready' },
    ],
    version: 1,
    ...overrides,
  };
}

describe('reference data manager model', () => {
  it('resolves exact, base-locale, English, and code label fallbacks in order', () => {
    const value = item();
    expect(preferredReferenceLabel(value, 'en-US')).toBe('Ready');
    expect(preferredReferenceLabel(value, 'en-GB')).toBe('Ready');
    expect(preferredReferenceLabel(value, 'fr')).toBe('Ready');
    expect(preferredReferenceLabel(item({ labels: [] }), 'fr')).toBe('STATUS_READY');
  });

  it('checks required locales by base locale', () => {
    const value = item();
    expect(hasReferenceLocale(value, 'ko')).toBe(true);
    expect(hasReferenceLocale(value, 'en')).toBe(true);
    expect(hasReferenceLocale(value, 'ja')).toBe(false);
  });

  it('requires active lifecycle and an inclusive-start, exclusive-end validity window', () => {
    const now = Date.parse('2026-08-31T09:00:00.000Z');
    const bounded = item({
      validFrom: '2026-08-31T09:00:00.000Z',
      validTo: '2026-08-31T10:00:00.000Z',
    });

    expect(isReferenceItemAvailable(bounded, now)).toBe(true);
    expect(isReferenceItemAvailable(bounded, Date.parse('2026-08-31T10:00:00.000Z'))).toBe(false);
    expect(isReferenceItemAvailable(item({ lifecycleState: 'DRAFT' }), now)).toBe(false);
  });

  it('classifies future, expired, bounded, and unbounded validity', () => {
    const now = Date.parse('2026-08-31T09:00:00.000Z');
    expect(referenceValidityState(item({ validFrom: '2026-08-31T10:00:00.000Z' }), now)).toBe(
      'scheduled'
    );
    expect(referenceValidityState(item({ validTo: '2026-08-31T09:00:00.000Z' }), now)).toBe(
      'expired'
    );
    expect(referenceValidityState(item({ validTo: '2026-08-31T10:00:00.000Z' }), now)).toBe(
      'bounded'
    );
    expect(referenceValidityState(item(), now)).toBe('always');
  });

  it('uses Error messages while preserving a safe fallback for unknown failures', () => {
    expect(referenceDataErrorMessage(new Error('network unavailable'), 'fallback')).toBe(
      'network unavailable'
    );
    expect(referenceDataErrorMessage({ reason: 'unknown' }, 'fallback')).toBe('fallback');
  });
});
