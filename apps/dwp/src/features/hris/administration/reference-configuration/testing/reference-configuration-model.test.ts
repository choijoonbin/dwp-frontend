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
        { commandType: 'PUBLISH_VERSION', resultRefPrefix: 'expected/1' }
      )
    ).toThrow('identity does not match');
  });
});

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
