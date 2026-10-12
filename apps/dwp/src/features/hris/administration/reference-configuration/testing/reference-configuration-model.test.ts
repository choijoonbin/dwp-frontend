import { describe, expect, it } from 'vitest';

import {
  assertReferenceConfigurationReceipt,
  isReferenceConfigurationWorkbench,
  referenceConfigurationActions,
  referenceConfigurationRuntimeState,
  resolveReferenceConfigurationViewState,
} from '../model/reference-configuration-model';

import type { ReferenceConfigurationWorkbench } from '../model/reference-configuration-model';

describe('reference-configuration model', () => {
  it('keeps runtime default-off and exposes only valid lifecycle transitions', () => {
    expect(referenceConfigurationRuntimeState(false)).toBe('OFF');
    expect(referenceConfigurationRuntimeState(true)).toBe('ON');
    expect(referenceConfigurationActions('DRAFT')).toEqual(['VALIDATE']);
    expect(referenceConfigurationActions('APPROVED')).toEqual(['SCHEDULE', 'PUBLISH']);
    expect(referenceConfigurationActions('PUBLISHED')).toEqual(['ROLLBACK', 'RETIRE']);
    expect(referenceConfigurationActions('RETIRED')).toEqual([]);
  });

  it('keeps empty, partial, unavailable, denied, and error states distinct', () => {
    expect(
      resolveReferenceConfigurationViewState({ loading: true, denied: false, failed: false })
    ).toBe('LOADING');
    expect(
      resolveReferenceConfigurationViewState({ loading: false, denied: true, failed: true })
    ).toBe('DENIED');
    expect(
      resolveReferenceConfigurationViewState({ loading: false, denied: false, failed: true })
    ).toBe('ERROR');
    expect(
      resolveReferenceConfigurationViewState({
        loading: false,
        denied: false,
        failed: false,
        workbench: workbench('PARTIAL', [{}]),
      })
    ).toBe('PARTIAL');
    expect(
      resolveReferenceConfigurationViewState({
        loading: false,
        denied: false,
        failed: false,
        workbench: workbench('EMPTY', []),
      })
    ).toBe('EMPTY');
  });

  it('fails closed when IAQ state cardinality or receipt identity is inconsistent', () => {
    expect(isReferenceConfigurationWorkbench(workbench('EMPTY', [{}]))).toBe(false);
    expect(isReferenceConfigurationWorkbench(workbench('PARTIAL', []))).toBe(true);
    expect(() =>
      assertReferenceConfigurationReceipt(
        {
          receiptId: '10000000-0000-4000-8000-000000000001',
          commandType: 'PUBLISH_VERSION',
          resultRef: 'different/1',
          correlationId: '20000000-0000-4000-8000-000000000001',
          requestDigest: 'a'.repeat(64),
          aggregateVersion: 1,
        },
        {
          commandType: 'PUBLISH_VERSION',
          originatingAction: 'configuration.version.publish',
          resultRefPrefix: 'expected/1',
        }
      )
    ).toThrow('identity does not match');
  });

  it('accepts only successful receipts with the exact purpose and originating action', () => {
    const expected = {
      commandType: 'PUBLISH_VERSION',
      originatingAction: 'configuration.version.publish',
      resultRefPrefix: '10000000-0000-4000-8000-000000000001/1',
    };
    expect(assertReferenceConfigurationReceipt(receipt(), expected).status).toBe('SUCCEEDED');
    for (const status of ['FAILED', 'RESULT_UNKNOWN'] as const) {
      expect(() => assertReferenceConfigurationReceipt({ ...receipt(), status }, expected)).toThrow(
        'identity does not match'
      );
    }
    expect(() =>
      assertReferenceConfigurationReceipt({ ...receipt(), purposeCode: 'OTHER' }, expected)
    ).toThrow('identity does not match');
    expect(() =>
      assertReferenceConfigurationReceipt(
        { ...receipt(), originatingAction: 'configuration.version.rollback' },
        expected
      )
    ).toThrow('identity does not match');
  });
});

function receipt() {
  return {
    receiptId: '50000000-0000-4000-8000-000000000001',
    commandType: 'PUBLISH_VERSION',
    originatingAction: 'configuration.version.publish',
    subjectPrincipalPublicId: '60000000-0000-4000-8000-000000000001',
    populationScopeDigest: 'a'.repeat(64),
    fieldPolicyRevision: 7,
    purposeCode: 'HRIS_SYSTEM_ADMIN',
    authorizationRevision: 9,
    status: 'SUCCEEDED',
    correlationId: '30000000-0000-4000-8000-000000000001',
    requestDigest: 'b'.repeat(64),
    createdAt: '2026-10-12T12:00:00Z',
    aggregateVersion: 8,
    resultRef: '10000000-0000-4000-8000-000000000001/1',
  };
}

function workbench(state: 'COMPLETE' | 'EMPTY' | 'PARTIAL' | 'UNAVAILABLE', items: unknown[]) {
  return {
    projectionVersion: '1',
    asOf: '2026-10-12T00:00:00Z',
    variantKey: 'REFERENCE' as const,
    queryState: {
      state,
      scopeDecisionRevision: 'scope-1',
      freshness: state === 'UNAVAILABLE' ? ('UNAVAILABLE' as const) : ('CURRENT' as const),
      nextCursor: null,
      fieldDecisionSummary: { viewCount: 0, maskedCount: 0, omittedCount: 0 },
      partialFailures:
        state === 'PARTIAL'
          ? [
              {
                componentKey: 'reference-configuration',
                errorCode: 'PARTIAL',
                correlationId: '10000000-0000-4000-8000-000000000001',
                retryable: true,
              },
            ]
          : [],
      correlationId: '10000000-0000-4000-8000-000000000001',
      cachePolicy: {
        authorizationDecisionRevision: 'scope-1',
        invalidationEvent: 'dwp.hris.access.assignment.changed.v1' as const,
        maxAgeSeconds: 30,
      },
    },
    items,
  } as unknown as ReferenceConfigurationWorkbench;
}
