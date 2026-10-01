import { describe, expect, it } from 'vitest';

import {
  savedViewDispositionLabel,
  savedViewLifecycleActionLabel,
  savedViewReasonLabel,
  savedViewScopeLabel,
  savedViewStatusLabel,
} from './saved-view-custody-presentation';

const t = ((key: string) => `translated:${key}`) as never;

describe('saved view custody presentation', () => {
  it('maps the documented wire values', () => {
    expect(savedViewScopeLabel('TEAM', t)).toBe('translated:savedViewCustody.scopes.TEAM');
    expect(savedViewReasonLabel('OFFBOARDING', t)).toBe(
      'translated:savedViewCustody.reasons.OFFBOARDING'
    );
    expect(savedViewStatusLabel('ACTIVE', t)).toBe('translated:savedViewCustody.statuses.ACTIVE');
    expect(savedViewDispositionLabel('TRANSFER', t)).toBe(
      'translated:savedViewCustody.dispositions.TRANSFER'
    );
    expect(savedViewLifecycleActionLabel('REASSIGN', t)).toBe(
      'translated:savedViewCustody.actionHistory.actions.REASSIGN'
    );
  });

  it('fails closed without exposing unknown server enum values', () => {
    expect(savedViewScopeLabel('INTERNAL_SCOPE', t)).toBe(
      'translated:savedViewCustody.scopes.UNKNOWN'
    );
    expect(savedViewReasonLabel('INTERNAL_REASON', t)).toBe(
      'translated:savedViewCustody.reasons.UNKNOWN'
    );
    expect(savedViewStatusLabel('INTERNAL_STATUS', t)).toBe(
      'translated:savedViewCustody.statuses.UNKNOWN'
    );
    expect(savedViewDispositionLabel('INTERNAL_DISPOSITION', t)).toBe(
      'translated:savedViewCustody.dispositions.UNKNOWN'
    );
    expect(savedViewLifecycleActionLabel('INTERNAL_ACTION', t)).toBe(
      'translated:savedViewCustody.actionHistory.actions.UNKNOWN'
    );
  });
});
