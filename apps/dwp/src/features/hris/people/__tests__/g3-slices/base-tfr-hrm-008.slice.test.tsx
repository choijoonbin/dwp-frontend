import { describe, expect, it } from 'vitest';
import { HttpError } from '@dwp-frontend/shared-utils';

import {
  EMPLOYMENT_EVENT_API_CONTRACTS,
  EMPLOYMENT_EVENT_PURPOSE,
  assertEmploymentEventCommand,
  buildConcurrentEmploymentEventCommand,
  buildHireEmploymentEventCommand,
  employmentEventFailure,
  employmentEventReceiptDisposition,
  parseEmploymentEventCommandReceipt,
  publishEmploymentEvent,
} from '../../../employment/assignment-proposal-model';

import type {
  EmploymentAssignmentDraft,
  EmploymentEventCommandReceipt,
  EmploymentOwnerRef,
} from '../../../employment/assignment-proposal-model';
import {
  EMPLOYMENT_ASSIGNMENTS_PATH,
  EMPLOYMENT_DOCUMENTS_PATH,
} from '../../api/employment-workbench-api';
import { employmentEventActionLabel } from '../../components/employment-event-workspace';

const SUBJECT_ID = '10000000-0000-4000-8000-000000000001';
const WORKER_ID = '10000000-0000-4000-8000-000000000011';
const EVENT_ID = '10000000-0000-4000-8000-000000000099';
const RECEIPT_ID = '10000000-0000-4000-8000-000000000098';
const CORRELATION_ID = '10000000-0000-4000-8000-000000000097';
const DIGEST = 'a'.repeat(64);

function ownerRef(
  schemaId: string,
  publicId: string,
  revision: number,
  hashCharacter = 'a'
): EmploymentOwnerRef {
  return { owner: 'HRM', schemaId, publicId, revision, contentHash: hashCharacter.repeat(64) };
}

function assignment(
  validFrom: string,
  validToExclusive: string | null,
  primary: boolean,
  fte: string,
  idOffset = 2
): EmploymentAssignmentDraft {
  const id = (offset: number) =>
    `10000000-0000-4000-8000-${String(idOffset + offset).padStart(12, '0')}`;
  return {
    organizationRef: ownerRef('HRM.Organization.v1', id(1), 4, 'b'),
    positionRef: ownerRef('HRM.Position.v1', id(2), 2, 'c'),
    jobRef: ownerRef('HRM.Job.v1', id(3), 3, 'd'),
    workLocationRef: ownerRef('HRM.WorkLocation.v1', id(4), 5, 'e'),
    validFrom,
    validToExclusive,
    primary,
    fte,
  };
}

function receipt(status: EmploymentEventCommandReceipt['status']): EmploymentEventCommandReceipt {
  return {
    receiptId: RECEIPT_ID,
    commandType: 'EmploymentEventCommand',
    originatingAction: 'CREATE',
    subjectPrincipalPublicId: SUBJECT_ID,
    populationScopeDigest: DIGEST,
    fieldPolicyRevision: 37,
    purposeCode: EMPLOYMENT_EVENT_PURPOSE,
    authorizationRevision: 37,
    status,
    correlationId: CORRELATION_ID,
    requestDigest: DIGEST,
    createdAt: '2026-10-01T00:00:01Z',
  };
}

describe('[SLICE:BASE-TFR-HRM-008] effective-dated employment and assignment lifecycle', () => {
  it('keeps HRM-P-HIRE as the closed EmploymentEventCommand fixture shape', () => {
    const command = buildHireEmploymentEventCommand({
      idempotencyKey: 'hire-tenant-100-0001',
      effectiveAt: '2026-10-01T00:00:00Z',
      personPublicId: SUBJECT_ID,
      legalEmployerRef: ownerRef(
        'HRM.LegalEmployer.v1',
        '10000000-0000-4000-8000-000000000002',
        7
      ),
      employmentType: 'EMPLOYEE',
      relationshipStart: '2026-10-01',
      assignment: assignment('2026-10-01', null, true, '1.0'),
    });

    expect(command).toEqual({
      context: {
        expectedVersion: 0,
        idempotencyKey: 'hire-tenant-100-0001',
        purpose: 'HR_LIFECYCLE',
        effectiveAt: '2026-10-01T00:00:00Z',
      },
      eventType: 'HIRE',
      payload: {
        personPublicId: SUBJECT_ID,
        legalEmployerRef: ownerRef(
          'HRM.LegalEmployer.v1',
          '10000000-0000-4000-8000-000000000002',
          7
        ),
        employmentType: 'EMPLOYEE',
        relationshipStart: '2026-10-01',
        workerCreation: 'CREATE_NEW',
        assignment: assignment('2026-10-01', null, true, '1.0'),
      },
    });
  });

  it('keeps HRM-P-CONCURRENT explicit, versioned, effective-dated and non-primary', () => {
    const command = buildConcurrentEmploymentEventCommand({
      idempotencyKey: 'concurrent-tenant-100-01',
      effectiveAt: '2026-11-01T00:00:00Z',
      workerPublicId: WORKER_ID,
      expectedWorkerVersion: 8,
      legalEmployerRef: ownerRef(
        'HRM.LegalEmployer.v1',
        '10000000-0000-4000-8000-000000000012',
        2
      ),
      relationshipStart: '2026-11-01',
      assignment: assignment('2026-11-01', '2027-05-01', false, '0.4', 12),
    });

    expect(command.context).toMatchObject({
      expectedVersion: 8,
      idempotencyKey: 'concurrent-tenant-100-01',
      purpose: 'HR_LIFECYCLE',
    });
    expect(command.payload).toMatchObject({
      workerPublicId: WORKER_ID,
      expectedWorkerVersion: 8,
      relationshipStart: '2026-11-01',
      assignment: { validToExclusive: '2027-05-01', primary: false, fte: '0.4' },
    });
    expect(() =>
      assertEmploymentEventCommand({
        ...command,
        payload: { ...command.payload, expectedWorkerVersion: 9 },
      })
    ).toThrow('Concurrent-employment owner version is invalid.');
  });

  it('binds create, validate, submit and publish only to canonical PEP HRM routes', () => {
    expect(EMPLOYMENT_DOCUMENTS_PATH).toBe(
      '/api/people/v1/hris/workbench/self-service/employment-documents'
    );
    expect(EMPLOYMENT_ASSIGNMENTS_PATH).toBe(
      '/api/people/v1/hris/workbench/operations/employment/assignments'
    );
    expect(EMPLOYMENT_EVENT_API_CONTRACTS).toEqual([
      expect.objectContaining({
        bindingId: 'PEP-HRM-006',
        method: 'POST',
        path: '/api/people/v1/hris/assignment-events',
      }),
      expect.objectContaining({
        bindingId: 'PEP-HRM-007',
        method: 'POST',
        path: '/api/people/v1/hris/assignment-events/{eventPublicId}/validate',
      }),
      expect.objectContaining({
        bindingId: 'PEP-HRM-008',
        method: 'POST',
        path: '/api/people/v1/hris/assignment-events/{eventPublicId}/submit',
      }),
      expect.objectContaining({
        bindingId: 'PEP-HRM-009',
        method: 'POST',
        path: '/api/people/v1/hris/assignment-events/{eventPublicId}/publish',
      }),
    ]);

    expect(() =>
      publishEmploymentEvent(
        {
          eventPublicId: EVENT_ID,
          expectedVersion: 2,
          idempotencyKey: 'publish-tenant-100-0001',
          correlationId: CORRELATION_ID,
        },
        { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' }
      )
    ).toThrow('Only an approved employment event at version 3 can be published.');
  });

  it('keeps approval asynchronous and exposes publish only with injected step-up authority', () => {
    expect(employmentEventActionLabel(null, false)).toBe('Create event');
    expect(employmentEventActionLabel('DRAFT', false)).toBe('Validate impact');
    expect(employmentEventActionLabel('VALIDATED', false)).toBe('Submit for approval');
    expect(employmentEventActionLabel('PENDING_APPROVAL', false)).toBe('Refresh status');
    expect(employmentEventActionLabel('APPROVED', false)).toBe('Refresh status');
    expect(employmentEventActionLabel('APPROVED', true)).toBe('Publish');
  });

  it('fails closed for overlap, stale owner, tenant/permission denial and key mismatch', () => {
    expect(
      employmentEventFailure(
        new HttpError('Overlap', 409, { code: 'PRIMARY_ASSIGNMENT_OVERLAP' })
      ).kind
    ).toBe('PRIMARY_OVERLAP');
    expect(
      employmentEventFailure(
        new HttpError('Stale', 409, { code: 'STALE_OWNER_VERSION', currentVersion: 9 })
      )
    ).toMatchObject({ kind: 'STALE_VERSION', currentVersion: 9 });
    for (const status of [401, 403, 404]) {
      expect(employmentEventFailure(new HttpError('Not disclosed', status)).kind).toBe('DENIED');
    }
    expect(
      employmentEventFailure(
        new HttpError('Mismatch', 409, { code: 'IDEMPOTENCY_KEY_REUSED' })
      ).kind
    ).toBe('IDEMPOTENCY_CONFLICT');
  });

  it('uses the shared receipt wire and recovers uncertain commands by receipt identity', () => {
    expect(parseEmploymentEventCommandReceipt(receipt('SUCCEEDED'))).toEqual(
      receipt('SUCCEEDED')
    );
    expect(employmentEventReceiptDisposition(receipt('ACCEPTED'))).toBe('PENDING');
    expect(employmentEventReceiptDisposition(receipt('RUNNING'))).toBe('PENDING');
    expect(employmentEventReceiptDisposition(receipt('SUCCEEDED'))).toBe('SUCCEEDED');
    expect(employmentEventReceiptDisposition(receipt('FAILED'))).toBe('REJECTED');
    expect(employmentEventReceiptDisposition(receipt('RESULT_UNKNOWN'))).toBe('RESULT_UNKNOWN');
    expect(
      employmentEventFailure(
        new HttpError('Recover the receipt', 500, {
          code: 'RESULT_UNKNOWN_USE_RECEIPT',
          receiptId: RECEIPT_ID,
          correlationId: CORRELATION_ID,
          retryable: true,
        })
      )
    ).toMatchObject({
      kind: 'RESULT_UNKNOWN',
      receiptId: RECEIPT_ID,
      correlationId: CORRELATION_ID,
      retryable: true,
    });
  });
});
