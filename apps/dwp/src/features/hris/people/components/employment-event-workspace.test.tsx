import { describe, expect, it } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';

import {
  employmentEventActionLabel,
  retainEmploymentEventCommandForExactRetry,
} from './employment-event-workspace';
import { employmentEventFailure } from '../../employment/assignment-proposal-model';

describe('employment event workspace lifecycle', () => {
  it('waits for approval and requires an injected publisher before offering publish', () => {
    expect(employmentEventActionLabel(null, false)).toBe('Create event');
    expect(employmentEventActionLabel('DRAFT', false)).toBe('Validate impact');
    expect(employmentEventActionLabel('VALIDATED', false)).toBe('Submit for approval');
    expect(employmentEventActionLabel('PENDING_APPROVAL', false)).toBe('Refresh status');
    expect(employmentEventActionLabel('APPROVED', false)).toBe('Refresh status');
    expect(employmentEventActionLabel('APPROVED', true)).toBe('Publish');
  });

  it('retains the identical command only for an ambiguous owner result', () => {
    const command = Object.freeze({
      kind: 'SUBMIT',
      eventPublicId: '10000000-0000-4000-8000-000000000001',
      idempotencyKey: '10000000-0000-4000-8000-000000000002',
      correlationId: '10000000-0000-4000-8000-000000000003',
    });
    const transportFailure = employmentEventFailure(new HttpTransportError('NETWORK'), true);
    const serverFailure = employmentEventFailure(new HttpError('Unavailable', 503), true);
    const malformedResponse = employmentEventFailure(new Error('Malformed receipt'), true);

    expect(transportFailure).toMatchObject({ kind: 'RESULT_UNKNOWN', retryable: true });
    expect(serverFailure).toMatchObject({ kind: 'RESULT_UNKNOWN', retryable: true });
    expect(malformedResponse).toMatchObject({ kind: 'RESULT_UNKNOWN', retryable: true });
    expect(retainEmploymentEventCommandForExactRetry(command, transportFailure)).toBe(command);
    expect(
      retainEmploymentEventCommandForExactRetry(
        command,
        employmentEventFailure(new HttpError('Denied', 403), false)
      )
    ).toBeNull();
    expect(employmentEventFailure(new Error('Rejected before dispatch'), false).kind).toBe(
      'UNAVAILABLE'
    );
  });

  it('reuses every immutable publish field after an ambiguous high-risk result', () => {
    const command = Object.freeze({
      eventPublicId: '10000000-0000-4000-8000-000000000011',
      expectedVersion: 3 as const,
      idempotencyKey: '10000000-0000-4000-8000-000000000012',
      correlationId: '10000000-0000-4000-8000-000000000013',
    });
    const firstAttempt = Object.freeze({ kind: 'PUBLISH' as const, command });
    const ambiguous = employmentEventFailure(new HttpTransportError('NETWORK'), true);
    const retry = retainEmploymentEventCommandForExactRetry(firstAttempt, ambiguous);
    const closeAfterDispatch = retainEmploymentEventCommandForExactRetry(
      firstAttempt,
      employmentEventFailure(new HttpTransportError('ABORT'), true)
    );

    expect(retry).toBe(firstAttempt);
    expect(closeAfterDispatch).toBe(firstAttempt);
    expect(retry?.command).toBe(command);
    expect(retry?.command).toEqual({
      eventPublicId: command.eventPublicId,
      expectedVersion: 3,
      idempotencyKey: command.idempotencyKey,
      correlationId: command.correlationId,
    });
  });
});
