import { describe, expect, it } from 'vitest';

import {
  productivityConsentLabelKey,
  productivityHealthLabelKey,
  productivityLifecycleLabelKey,
  productivityPolicyLabelKey,
  productivityResourceLabelKey,
  productivityRunStateLabelKey,
  productivityScopeLabelKey,
  productivitySyncModeLabelKey,
} from './productivity-connector-presentation';

describe('productivity connector presentation', () => {
  it('maps supported least-privilege scopes', () => {
    expect(productivityScopeLabelKey('Mail.ReadBasic')).toBe(
      'productivity.scopeLabels.MAIL_READ_BASIC'
    );
  });

  it('fails closed for every unknown owner state and scope', () => {
    const keys = [
      productivityHealthLabelKey('FUTURE_HEALTH'),
      productivityLifecycleLabelKey('FUTURE_LIFECYCLE'),
      productivityPolicyLabelKey('FUTURE_POLICY'),
      productivityConsentLabelKey('FUTURE_CONSENT'),
      productivityResourceLabelKey('FUTURE_RESOURCE'),
      productivityRunStateLabelKey('FUTURE_RUN'),
      productivitySyncModeLabelKey('FUTURE_MODE'),
      productivityScopeLabelKey('Sensitive.Scope'),
    ];
    expect(keys.every((value) => value.endsWith('.UNKNOWN'))).toBe(true);
    expect(keys.join(' ')).not.toContain('FUTURE_');
    expect(keys.join(' ')).not.toContain('Sensitive.Scope');
  });
});
