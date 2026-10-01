import { describe, expect, it } from 'vitest';

import {
  abbreviatedSsoReceiptHash,
  ssoTestLoginBoundaryLabelKey,
  ssoTestLoginReasonLabelKey,
  ssoTestLoginStateLabelKey,
  ssoTestLoginStateTone,
} from './tenant-sso-test-login-model';

describe('tenant SSO test-login presentation', () => {
  it('maps only closed server states and evidence codes', () => {
    expect(ssoTestLoginStateLabelKey('READY_FOR_EXTERNAL_PROBE')).toContain(
      'READY_FOR_EXTERNAL_PROBE'
    );
    expect(ssoTestLoginStateLabelKey('OWNER_INTERNAL_DEBUG')).toContain('UNKNOWN');
    expect(ssoTestLoginReasonLabelKey('EXTERNAL_IDP_LOGIN_EXECUTOR_NOT_CONNECTED')).toContain(
      'EXTERNAL_IDP_LOGIN_EXECUTOR_NOT_CONNECTED'
    );
    [
      'IDENTITY_PROVIDER_CONFIGURATION_INCOMPLETE',
      'OIDC_CLIENT_SECRET_UNAVAILABLE',
      'OIDC_ENDPOINT_POLICY_INVALID',
      'OIDC_CALLBACK_POLICY_INVALID',
    ].forEach((reason) => expect(ssoTestLoginReasonLabelKey(reason)).toContain(reason));
    expect(ssoTestLoginReasonLabelKey('SECRET_REASON')).toContain('UNKNOWN');
    expect(ssoTestLoginBoundaryLabelKey('UNCONNECTED_EXTERNAL_IDP_EXECUTOR')).toContain(
      'UNCONNECTED_EXTERNAL_IDP_EXECUTOR'
    );
    expect(ssoTestLoginBoundaryLabelKey('RAW_BOUNDARY')).toContain('UNKNOWN');
  });

  it('uses non-success tones and redacts receipt hashes', () => {
    expect(ssoTestLoginStateTone('BLOCKED')).toBe('error');
    expect(ssoTestLoginStateTone('UNAVAILABLE')).toBe('warning');
    expect(ssoTestLoginStateTone('READY_FOR_EXTERNAL_PROBE')).toBe('info');
    expect(abbreviatedSsoReceiptHash('a'.repeat(64))).toBe('aaaaaaaaaaaa…');
    expect(abbreviatedSsoReceiptHash('not-a-hash')).toBeNull();
  });
});
