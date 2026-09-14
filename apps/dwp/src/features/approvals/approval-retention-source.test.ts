import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';
import { approvalRetentionPolicyAbsent } from './approval-retention-source';

const absent = () => ({
  status: 'error',
  fetchStatus: 'idle',
  data: undefined,
  error: new HttpError('Not configured', 409, { errorCode: 'RETENTION_POLICY_NOT_CONFIGURED' }),
});

describe('retention policy initialization source', () => {
  it('requires the distinct native absence result with an idle empty cache', () => {
    expect(approvalRetentionPolicyAbsent(absent())).toBe(true);
  });
  it.each([401, 403, 404, 500, 503])('does not interpret HTTP %s as policy absence', (status) => {
    expect(
      approvalRetentionPolicyAbsent({
        ...absent(),
        error: new HttpError('Unavailable', status, {
          errorCode: 'RETENTION_POLICY_NOT_CONFIGURED',
        }),
      })
    ).toBe(false);
  });
  it.each(['AUTHORITY_RESOLUTION_UNAVAILABLE', 'RESOURCE_CONFLICT', 'SCOPE_CONTEXT_EXPIRED'])(
    'does not interpret %s as policy absence',
    (errorCode) => {
      expect(
        approvalRetentionPolicyAbsent({
          ...absent(),
          error: new HttpError('Unknown', 409, { errorCode }),
        })
      ).toBe(false);
    }
  );
  it.each(['fetching', 'paused'])('blocks initialization while %s', (fetchStatus) => {
    expect(approvalRetentionPolicyAbsent({ ...absent(), fetchStatus })).toBe(false);
  });
  it.each(['pending', 'success'])('does not treat a %s source as confirmed absence', (status) => {
    expect(approvalRetentionPolicyAbsent({ ...absent(), status })).toBe(false);
  });
  it('blocks retained data, unknown errors, and missing query state', () => {
    expect(approvalRetentionPolicyAbsent({ ...absent(), data: { policyId: 'known' } })).toBe(false);
    expect(approvalRetentionPolicyAbsent({ ...absent(), error: new Error('Unknown') })).toBe(false);
    expect(approvalRetentionPolicyAbsent(undefined)).toBe(false);
  });
});
