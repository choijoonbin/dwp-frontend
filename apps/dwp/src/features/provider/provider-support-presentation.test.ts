import { describe, expect, it } from 'vitest';

import {
  hasUnknownProviderSupportScope,
  providerSupportAnomalyLabel,
  providerSupportDecisionLabel,
  providerSupportModeLabel,
  providerSupportScopeLabel,
} from './provider-support-presentation';

const translate = (key: string) => `translated:${key}`;

describe('provider support presentation', () => {
  it('maps governed support scopes to user-facing translation keys', () => {
    expect(providerSupportScopeLabel(translate, 'TENANT_EXPERIENCE_PREVIEW')).toBe(
      'translated:support.scopes.TENANT_EXPERIENCE_PREVIEW'
    );
    expect(hasUnknownProviderSupportScope(['TENANT_EXPERIENCE_PREVIEW'])).toBe(false);
    expect(providerSupportModeLabel(translate, 'BREAK_GLASS')).toBe(
      'translated:support.modes.BREAK_GLASS'
    );
    expect(providerSupportAnomalyLabel(translate, 'DENIED_ATTEMPTS')).toBe(
      'translated:support.postReviewEvidence.anomaly.DENIED_ATTEMPTS'
    );
    expect(providerSupportDecisionLabel(translate, 'ALLOW')).toBe(
      'translated:support.postReviewEvidence.decision.ALLOW'
    );
  });

  it('fails closed for an unknown historical support scope', () => {
    expect(providerSupportScopeLabel(translate, 'INTERNAL_SCOPE_V2')).toBe(
      'translated:support.scopes.unknown'
    );
    expect(hasUnknownProviderSupportScope(['TENANT_EXPERIENCE_PREVIEW', 'INTERNAL_SCOPE_V2'])).toBe(
      true
    );
    expect(providerSupportModeLabel(translate, 'INTERNAL_MODE')).toBe(
      'translated:support.modes.unknown'
    );
    expect(providerSupportAnomalyLabel(translate, 'INTERNAL_ANOMALY')).toBe(
      'translated:support.postReviewEvidence.anomaly.UNKNOWN'
    );
    expect(providerSupportDecisionLabel(translate, 'INTERNAL_DECISION')).toBe(
      'translated:support.postReviewEvidence.decision.UNKNOWN'
    );
  });
});
