import { describe, expect, it } from 'vitest';

import { notificationAdminFocus } from './notification-admin-focus';

describe('notificationAdminFocus', () => {
  it('accepts the exact opaque identifiers used by governance workspaces', () => {
    const params = new URLSearchParams({
      policyId: 'policy-approvals-current',
      revisionId: '30000000-0000-0000-0000-000000000001',
      controlId: 'control:suppression.42',
    });

    expect(notificationAdminFocus(params, 'policyId')).toBe('policy-approvals-current');
    expect(notificationAdminFocus(params, 'revisionId')).toBe(
      '30000000-0000-0000-0000-000000000001'
    );
    expect(notificationAdminFocus(params, 'controlId')).toBe('control:suppression.42');
  });

  it('rejects whitespace, unsafe characters, and oversized values', () => {
    expect(notificationAdminFocus(new URLSearchParams({ policyId: ' policy-1' }), 'policyId')).toBe(
      null
    );
    expect(
      notificationAdminFocus(new URLSearchParams({ revisionId: '../draft' }), 'revisionId')
    ).toBe(null);
    expect(
      notificationAdminFocus(new URLSearchParams({ controlId: `c${'x'.repeat(160)}` }), 'controlId')
    ).toBe(null);
  });
});
