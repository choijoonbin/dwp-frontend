import { describe, expect, it } from 'vitest';

import {
  effectiveWorkforcePolicyState,
  filterWorkforceAccessPolicies,
  summarizeWorkforceAccess,
} from './workforce-access-model';

import type { WorkforceAccessPolicy } from '@dwp-frontend/shared-utils';

function policy(overrides: Partial<WorkforceAccessPolicy> = {}): WorkforceAccessPolicy {
  return {
    policyId: 'policy-1',
    subjectType: 'ROLE',
    subjectRef: 'HR_ADMIN',
    populationType: 'ORG_TREE',
    organizationId: 'org-1',
    organizationName: 'People operations',
    fieldGroups: ['DIRECTORY'],
    actionCodes: ['READ'],
    lifecycleState: 'ACTIVE',
    justification: 'Required for workforce administration',
    version: 1,
    ...overrides,
  };
}

describe('workforce access presentation model', () => {
  it('derives scheduled and expired validity states while preserving terminal states', () => {
    const now = Date.parse('2026-08-26T00:00:00Z');

    expect(effectiveWorkforcePolicyState(policy({ validTo: '2026-08-25T23:59:59Z' }), now)).toBe(
      'EXPIRED'
    );
    expect(effectiveWorkforcePolicyState(policy({ validTo: '2026-08-27T00:00:00Z' }), now)).toBe(
      'ACTIVE'
    );
    expect(effectiveWorkforcePolicyState(policy({ validFrom: '2026-08-27T00:00:00Z' }), now)).toBe(
      'SCHEDULED'
    );
    expect(
      effectiveWorkforcePolicyState(
        policy({ lifecycleState: 'REVOKED', validTo: '2026-08-25T00:00:00Z' }),
        now
      )
    ).toBe('REVOKED');
  });

  it('counts only effective access and includes the exact 30-day expiry boundary', () => {
    const now = Date.parse('2026-08-26T00:00:00Z');
    const summary = summarizeWorkforceAccess(
      [
        policy({ policyId: 'active' }),
        policy({
          policyId: 'boundary',
          subjectType: 'USER',
          actionCodes: ['READ', 'EXPORT'],
          validTo: '2026-09-25T00:00:00Z',
        }),
        policy({
          policyId: 'later',
          actionCodes: ['EXPORT'],
          validTo: '2026-09-26T00:00:00Z',
        }),
        policy({
          policyId: 'past',
          subjectType: 'USER',
          actionCodes: ['EXPORT'],
          validTo: '2026-08-25T23:59:59Z',
        }),
        policy({ policyId: 'revoked', lifecycleState: 'REVOKED', actionCodes: ['EXPORT'] }),
        policy({
          policyId: 'scheduled',
          validFrom: '2026-08-27T00:00:00Z',
          actionCodes: ['EXPORT'],
        }),
      ],
      now
    );

    expect(summary).toEqual({ active: 3, userOverrides: 1, exportEnabled: 2, expiringSoon: 1 });
  });

  it('searches raw and supplied display terms case-insensitively', () => {
    const policies = [
      policy({ policyId: 'finance', subjectRef: 'FINANCE_VIEWER' }),
      policy({ policyId: 'people', subjectRef: 'PEOPLE_ADMIN' }),
    ];

    expect(
      filterWorkforceAccessPolicies(
        policies,
        { search: 'finance viewer', state: 'ALL', operation: 'ALL' },
        { finance: ['재무 조회자', 'Seoul office'] }
      ).map(({ policyId }) => policyId)
    ).toEqual(['finance']);
    expect(
      filterWorkforceAccessPolicies(
        policies,
        { search: 'SEOUL OFFICE', state: 'ALL', operation: 'ALL' },
        { finance: ['재무 조회자', 'Seoul office'] }
      ).map(({ policyId }) => policyId)
    ).toEqual(['finance']);
  });

  it('combines effective state and action filters while ALL leaves each dimension open', () => {
    const policies = [
      policy({ policyId: 'read-active' }),
      policy({ policyId: 'export-active', actionCodes: ['READ', 'EXPORT'] }),
      policy({
        policyId: 'export-expired',
        actionCodes: ['EXPORT'],
        validTo: '2020-01-01T00:00:00Z',
      }),
    ];

    expect(
      filterWorkforceAccessPolicies(policies, {
        search: '',
        state: 'ACTIVE',
        operation: 'EXPORT',
      }).map(({ policyId }) => policyId)
    ).toEqual(['export-active']);
    expect(
      filterWorkforceAccessPolicies(policies, {
        search: '',
        state: 'EXPIRED',
        operation: 'ALL',
      }).map(({ policyId }) => policyId)
    ).toEqual(['export-expired']);
    expect(
      filterWorkforceAccessPolicies(policies, { search: '', state: 'ALL', operation: 'ALL' })
    ).toHaveLength(3);
  });
});
