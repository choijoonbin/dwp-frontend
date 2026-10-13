import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError, HttpTransportError } from '@dwp-frontend/shared-utils';
import { resetCsrfToken } from '@dwp-frontend/shared-utils/axios-instance';

import {
  assignmentProposalCanSubmit,
  assignmentProposalCanCancel,
  assignmentProposalActionAvailable,
  assignmentProposalAllowedChangeTypes,
  assignmentProposalCreateReference,
  assignmentProposalDateBoundary,
  assignmentProposalDraftIsComplete,
  assignmentProposalFailureKind,
  assignmentProposalHasCompletedValidation,
  buildConcurrentEmploymentEventCommand,
  buildCreateAssignmentProposalRequest,
  buildHireEmploymentEventCommand,
  createEmploymentEvent,
  employmentEventCreateReference,
  employmentEventFailure,
  employmentEventReceiptDisposition,
  getEmploymentEvent,
  getEmploymentEventCommandReceipt,
  parseEmploymentEventCommandReceipt,
  publishEmploymentEvent,
  resolveAssignmentProposalSelection,
  submitEmploymentEvent,
  validateEmploymentEvent,
} from './assignment-proposal-model';

import type {
  AssignmentDetail,
  AssignmentProposal,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type {
  EmploymentAssignmentDraft,
  EmploymentEventCommandReceipt,
  EmploymentOwnerRef,
} from './assignment-proposal-model';

const assignment = {
  assignmentId: '90e4cd45-6f91-4ac7-974e-6bc49f1b910b',
  assignmentVersion: 7,
  effectiveStartDate: '2026-01-01',
  effectiveEndDate: null,
} satisfies Pick<
  AssignmentDetail,
  'assignmentId' | 'assignmentVersion' | 'effectiveStartDate' | 'effectiveEndDate'
>;

const proposal = {
  lifecycleState: 'VALIDATED',
  validationFindings: [],
} satisfies Pick<AssignmentProposal, 'lifecycleState' | 'validationFindings'>;

const EVENT_ID = '10000000-0000-4000-8000-000000000020';
const RECEIPT_ID = '10000000-0000-4000-8000-000000000021';
const CORRELATION_ID = '10000000-0000-4000-8000-000000000022';
const PRINCIPAL_ID = '10000000-0000-4000-8000-000000000023';

function ownerRef(
  schemaId: string,
  publicId: string,
  revision: number,
  hashCharacter: string
): EmploymentOwnerRef {
  return {
    owner: 'HRM',
    schemaId,
    publicId,
    revision,
    contentHash: hashCharacter.repeat(64),
  };
}

const legalEmployerRef = ownerRef(
  'HRM.LegalEmployer.v1',
  '10000000-0000-4000-8000-000000000002',
  7,
  'a'
);
const assignmentDraft = {
  organizationRef: ownerRef('HRM.Organization.v1', '10000000-0000-4000-8000-000000000003', 4, 'b'),
  positionRef: ownerRef('HRM.Position.v1', '10000000-0000-4000-8000-000000000004', 2, 'c'),
  jobRef: ownerRef('HRM.Job.v1', '10000000-0000-4000-8000-000000000005', 3, 'd'),
  workLocationRef: ownerRef('HRM.WorkLocation.v1', '10000000-0000-4000-8000-000000000006', 5, 'e'),
  validFrom: '2026-10-01',
  validToExclusive: null,
  primary: true,
  fte: '1.0',
} satisfies EmploymentAssignmentDraft;

function receipt(
  overrides: Partial<EmploymentEventCommandReceipt> = {}
): EmploymentEventCommandReceipt {
  return {
    receiptId: RECEIPT_ID,
    commandType: 'EMPLOYMENT_EVENT_CREATE',
    originatingAction: 'CREATE_ASSIGNMENT_EVENT',
    subjectPrincipalPublicId: PRINCIPAL_ID,
    populationScopeDigest: 'a'.repeat(64),
    fieldPolicyRevision: 7,
    purposeCode: 'HR_LIFECYCLE',
    authorizationRevision: 9,
    status: 'SUCCEEDED',
    correlationId: CORRELATION_ID,
    requestDigest: 'b'.repeat(64),
    createdAt: '2026-10-01T00:00:00Z',
    ...overrides,
  };
}

function jsonResponse(
  data: unknown,
  headers: Record<string, string> = {},
  status = 200,
  envelope = false
): Response {
  return new Response(JSON.stringify(envelope ? { data } : data), { status, headers });
}

type SecureAuthority = Extract<ProductSurfaceGovernedMutationAuthority, { mode: 'SECURE' }>;

function authority(idempotencyKey: string): SecureAuthority {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: 'decision-hrm-008',
    contextKey: 'hcm.operations',
    contextScopeKey: 'scope:tenant/hrm',
    idempotencyKey,
  };
}

function publishAuthority(idempotencyKey: string): SecureAuthority {
  return {
    ...authority(idempotencyKey),
    objectVersion: 3,
    stepUp: {
      challenge: 'signed-hrm-publish',
      challengeId: 'hrm-publish-challenge',
      decisionRevision: 'decision-hrm-008',
      expiresAt: '2099-01-01T00:00:00Z',
    },
  };
}

afterEach(() => {
  resetCsrfToken();
  vi.unstubAllGlobals();
});

describe('assignment proposal workflow model', () => {
  it('builds the happy-path transfer command from the canonical assignment version', () => {
    expect(
      buildCreateAssignmentProposalRequest(
        assignment,
        {
          changeType: 'TRANSFER',
          effectiveDate: '2026-11-01',
          reasonCode: 'ORG_REALIGNMENT',
          changeValue: 'f825a6b0-2d9e-490f-8dcb-8a450fc82437',
        },
        '12ea3741-9cbc-44b5-90bc-9a19021ca131',
        '2026-10-06'
      )
    ).toEqual({
      commandId: '12ea3741-9cbc-44b5-90bc-9a19021ca131',
      targetAssignmentId: assignment.assignmentId,
      changeType: 'TRANSFER',
      effectiveDate: '2026-11-01',
      reasonCode: 'ORG_REALIGNMENT',
      proposedChanges: { organizationId: 'f825a6b0-2d9e-490f-8dcb-8a450fc82437' },
      expectedAssignmentVersion: 7,
    });
    expect(assignmentProposalCanSubmit(proposal)).toBe(true);
    expect(
      assignmentProposalHasCompletedValidation({
        lifecycleState: 'SUBMITTED',
        validationFindings: [],
      })
    ).toBe(true);
  });

  it('fails closed for denied proposal reads or commands', () => {
    expect(assignmentProposalFailureKind(new HttpError('Forbidden', 403))).toBe('DENIED');
    expect(
      assignmentProposalActionAvailable({
        accessMode: 'PROVIDER_SUPPORT',
        governed: false,
        capabilityGranted: true,
        roles: ['HR_ADMIN'],
      })
    ).toBe(false);
  });

  it('separates optimistic conflicts from validation failures', () => {
    expect(
      assignmentProposalFailureKind(
        new HttpError('Changed', 409, { errorCode: 'OBJECT_VERSION_CONFLICT' })
      )
    ).toBe('CONFLICT');
    expect(assignmentProposalFailureKind(new HttpError('Invalid', 400))).toBe('INVALID');
  });

  it('preserves proposal and create-workspace deep links during partial recovery', () => {
    const createRef = assignmentProposalCreateReference(assignment.assignmentId);
    expect(resolveAssignmentProposalSelection(createRef)).toEqual({
      kind: 'create',
      assignmentId: assignment.assignmentId,
    });
    expect(resolveAssignmentProposalSelection('proposal-42')).toEqual({
      kind: 'proposal',
      proposalId: 'proposal-42',
    });
    expect(assignmentProposalFailureKind(new Error('timeline unavailable'))).toBe('UNAVAILABLE');
  });

  it('uses canonical workforce keys and permits cancellation after submission', () => {
    const promotion = {
      changeType: 'PROMOTION',
      effectiveDate: '2026-11-01',
      reasonCode: 'PROMOTION',
      changeValue: 'JOB.PROFILE-9',
    } as const;
    expect(assignmentProposalDraftIsComplete(promotion)).toBe(true);
    expect(
      buildCreateAssignmentProposalRequest(assignment, promotion, 'command-promotion', '2026-10-06')
        .proposedChanges
    ).toEqual({ jobProfileKey: 'JOB.PROFILE-9' });
    expect(
      buildCreateAssignmentProposalRequest(
        assignment,
        { ...promotion, changeType: 'CHANGE_LOCATION', changeValue: 'SEOUL_HQ' },
        'command-location',
        '2026-10-06'
      ).proposedChanges
    ).toEqual({ locationKey: 'SEOUL_HQ' });
    expect(assignmentProposalCanCancel({ ...proposal, lifecycleState: 'SUBMITTED' })).toBe(true);
  });

  it('allows corrections only inside the target assignment slice through today', () => {
    expect(
      assignmentProposalDateBoundary(
        'CORRECTION',
        { effectiveStartDate: '2025-01-01', effectiveEndDate: null },
        '2026-10-06'
      )
    ).toEqual({ minDate: '2025-01-01', maxDate: '2026-10-06' });
    expect(
      assignmentProposalDateBoundary(
        'CORRECTION',
        { effectiveStartDate: '2025-01-01', effectiveEndDate: '2026-06-30' },
        '2026-10-06'
      )
    ).toEqual({ minDate: '2025-01-01', maxDate: '2026-06-30' });
    expect(
      assignmentProposalDateBoundary(
        'TRANSFER',
        { effectiveStartDate: '2025-01-01', effectiveEndDate: null },
        '2026-10-06'
      )
    ).toEqual({ minDate: '2026-10-06', maxDate: null });
  });

  it('allows prospective changes only when the target slice includes today', () => {
    expect(assignmentProposalAllowedChangeTypes(assignment, '2026-10-06')).toEqual([
      'TRANSFER',
      'PROMOTION',
      'DEMOTION',
      'CHANGE_MANAGER',
      'CHANGE_LOCATION',
      'CORRECTION',
    ]);

    const historicalAssignment = {
      ...assignment,
      effectiveEndDate: '2026-06-30',
    };
    expect(assignmentProposalAllowedChangeTypes(historicalAssignment, '2026-10-06')).toEqual([
      'CORRECTION',
    ]);
    expect(
      assignmentProposalAllowedChangeTypes(
        { ...assignment, effectiveStartDate: '2026-11-01' },
        '2026-10-06'
      )
    ).toEqual(['CORRECTION']);
    expect(() =>
      buildCreateAssignmentProposalRequest(
        historicalAssignment,
        {
          changeType: 'TRANSFER',
          effectiveDate: '2026-10-06',
          reasonCode: 'ORG_REALIGNMENT',
          changeValue: 'f825a6b0-2d9e-490f-8dcb-8a450fc82437',
        },
        'command-historical-transfer',
        '2026-10-06'
      )
    ).toThrow('Prospective changes require an assignment slice that includes today.');
  });
});

describe('effective-dated employment event model', () => {
  it('builds the exact HRM-P-HIRE command without a tenant or generic patch', () => {
    const command = buildHireEmploymentEventCommand({
      idempotencyKey: 'hire-tenant-100-0001',
      effectiveAt: '2026-10-01T00:00:00Z',
      personPublicId: '10000000-0000-4000-8000-000000000001',
      legalEmployerRef,
      employmentType: 'EMPLOYEE',
      relationshipStart: '2026-10-01',
      assignment: assignmentDraft,
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
        personPublicId: '10000000-0000-4000-8000-000000000001',
        legalEmployerRef,
        employmentType: 'EMPLOYEE',
        relationshipStart: '2026-10-01',
        workerCreation: 'CREATE_NEW',
        assignment: assignmentDraft,
      },
    });
    expect(command).not.toHaveProperty('tenantId');
    expect(command).not.toHaveProperty('patch');
  });

  it('builds HRM-P-CONCURRENT against the exact worker version and half-open period', () => {
    const concurrentAssignment = {
      ...assignmentDraft,
      organizationRef: ownerRef(
        'HRM.Organization.v1',
        '10000000-0000-4000-8000-000000000013',
        1,
        'b'
      ),
      positionRef: ownerRef('HRM.Position.v1', '10000000-0000-4000-8000-000000000014', 1, 'c'),
      jobRef: ownerRef('HRM.Job.v1', '10000000-0000-4000-8000-000000000015', 1, 'd'),
      workLocationRef: ownerRef(
        'HRM.WorkLocation.v1',
        '10000000-0000-4000-8000-000000000016',
        1,
        'e'
      ),
      validFrom: '2026-11-01',
      validToExclusive: '2027-05-01',
      primary: false,
      fte: '0.4',
    } satisfies EmploymentAssignmentDraft;
    const command = buildConcurrentEmploymentEventCommand({
      idempotencyKey: 'concurrent-tenant-100-01',
      effectiveAt: '2026-11-01T00:00:00Z',
      workerPublicId: '10000000-0000-4000-8000-000000000011',
      expectedWorkerVersion: 8,
      legalEmployerRef: ownerRef(
        'HRM.LegalEmployer.v1',
        '10000000-0000-4000-8000-000000000012',
        2,
        'a'
      ),
      relationshipStart: '2026-11-01',
      assignment: concurrentAssignment,
    });

    expect(command.context.expectedVersion).toBe(8);
    expect(command.payload.expectedWorkerVersion).toBe(8);
    expect(command.payload.assignment).toEqual(concurrentAssignment);
    expect(() =>
      buildConcurrentEmploymentEventCommand({
        ...command.payload,
        idempotencyKey: command.context.idempotencyKey,
        effectiveAt: command.context.effectiveAt,
        expectedWorkerVersion: -1,
      })
    ).toThrow('Employment event command context is invalid.');
    expect(() =>
      buildConcurrentEmploymentEventCommand({
        ...command.payload,
        idempotencyKey: command.context.idempotencyKey,
        effectiveAt: command.context.effectiveAt,
        assignment: { ...concurrentAssignment, fte: '1.1' },
      })
    ).toThrow('Assignment effective period or FTE is invalid.');
  });

  it('keeps canonical event deep links distinct from legacy proposal references', () => {
    const reference = employmentEventCreateReference(
      'CONCURRENT_EMPLOYMENT',
      '10000000-0000-4000-8000-000000000011',
      8
    );
    expect(resolveAssignmentProposalSelection(reference)).toEqual({
      kind: 'employment-create',
      eventType: 'CONCURRENT_EMPLOYMENT',
      subjectPublicId: '10000000-0000-4000-8000-000000000011',
      expectedVersion: 8,
    });
    expect(
      resolveAssignmentProposalSelection(
        employmentEventCreateReference('HIRE', '10000000-0000-4000-8000-000000000001', 1)
      )
    ).toBeNull();
  });

  it('maps overlap, stale owner, denial and result-unknown problems to safe UI states', () => {
    expect(
      employmentEventFailure(new HttpError('Overlap', 409, { code: 'PRIMARY_ASSIGNMENT_OVERLAP' }))
        .kind
    ).toBe('PRIMARY_OVERLAP');
    expect(
      employmentEventFailure(
        new HttpError('Stale', 409, { code: 'STALE_OWNER_VERSION', currentVersion: 9 })
      )
    ).toMatchObject({ kind: 'STALE_VERSION', currentVersion: 9 });
    expect(employmentEventFailure(new HttpError('Hidden', 404)).kind).toBe('DENIED');
    expect(
      employmentEventFailure(
        new HttpError('Unknown', 500, {
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
    expect(
      employmentEventFailure(new HttpError('Reused', 409, { code: 'IDEMPOTENCY_KEY_REUSED' })).kind
    ).toBe('IDEMPOTENCY_CONFLICT');
    expect(employmentEventFailure(new HttpTransportError('NETWORK'), false).kind).toBe(
      'UNAVAILABLE'
    );
    expect(employmentEventFailure(new HttpTransportError('NETWORK'), true).kind).toBe(
      'RESULT_UNKNOWN'
    );
    expect(employmentEventFailure(new HttpError('Unavailable', 503), false).kind).toBe(
      'UNAVAILABLE'
    );
    expect(employmentEventFailure(new HttpError('Unavailable', 503), true).kind).toBe(
      'RESULT_UNKNOWN'
    );
  });

  it('parses durable receipts and never treats pending or unknown outcomes as success', () => {
    expect(parseEmploymentEventCommandReceipt(receipt())).toEqual(receipt());
    expect(employmentEventReceiptDisposition(receipt({ status: 'ACCEPTED' }))).toBe('PENDING');
    expect(employmentEventReceiptDisposition(receipt({ status: 'SUCCEEDED' }))).toBe('SUCCEEDED');
    expect(employmentEventReceiptDisposition(receipt({ status: 'RESULT_UNKNOWN' }))).toBe(
      'RESULT_UNKNOWN'
    );
    expect(employmentEventReceiptDisposition(receipt({ status: 'FAILED' }))).toBe('REJECTED');
    expect(() =>
      parseEmploymentEventCommandReceipt({ ...receipt(), populationScopeDigest: 'not-a-digest' })
    ).toThrow('Employment event command receipt is invalid.');
  });

  it('binds create, lifecycle and recovery calls to exact headers and canonical paths', async () => {
    const hire = buildHireEmploymentEventCommand({
      idempotencyKey: 'hire-tenant-100-0001',
      effectiveAt: '2026-10-01T00:00:00Z',
      personPublicId: '10000000-0000-4000-8000-000000000001',
      legalEmployerRef,
      employmentType: 'EMPLOYEE',
      relationshipStart: '2026-10-01',
      assignment: assignmentDraft,
    });
    const validateKey = 'validate-tenant-100-01';
    const submitKey = 'submit-tenant-100-001';
    const publishKey = 'publish-tenant-100-01';
    let published = false;
    const fetchMock = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/csrf')) {
        return jsonResponse({ token: 'csrf-token', headerName: 'X-XSRF-TOKEN' }, {}, 200, true);
      }
      const responseHeaders = (version: number, location = true) => ({
        ...(location ? { Location: `/api/people/v1/hris/assignment-events/${EVENT_ID}` } : {}),
        ETag: `"v:${version}"`,
      });
      if (url.includes('/command-receipts/')) {
        return jsonResponse(
          receipt({
            commandType: 'HRM_ASSIGNMENT_EVENT_PUBLISH',
            originatingAction: 'PUBLISH_ASSIGNMENT_EVENT',
          }),
          responseHeaders(0, false)
        );
      }
      if (url.endsWith(`/${EVENT_ID}/validate?contextScopeKey=scope%3Atenant%2Fhrm`)) {
        return jsonResponse(
          {
            eventPublicId: EVENT_ID,
            effectiveDate: '2026-10-01',
            blockingIssues: [],
            warnings: [],
            impactDigest: 'c'.repeat(64),
          },
          responseHeaders(1, false)
        );
      }
      if (url.endsWith(`/${EVENT_ID}/submit?contextScopeKey=scope%3Atenant%2Fhrm`)) {
        return jsonResponse(
          receipt({ commandType: 'EMPLOYMENT_EVENT_SUBMIT' }),
          responseHeaders(2, false),
          202
        );
      }
      if (url.endsWith(`/${EVENT_ID}/publish?contextScopeKey=scope%3Atenant%2Fhrm`)) {
        published = true;
        return jsonResponse(
          receipt({
            commandType: 'HRM_ASSIGNMENT_EVENT_PUBLISH',
            originatingAction: 'PUBLISH_ASSIGNMENT_EVENT',
          }),
          responseHeaders(4, false),
          202
        );
      }
      if (url.endsWith(`/${EVENT_ID}?contextScopeKey=scope%3Atenant%2Fhrm`)) {
        const version = published ? 4 : 3;
        return jsonResponse(
          {
            eventPublicId: EVENT_ID,
            lifecycleState: published ? 'PUBLISHED' : 'APPROVED',
            version,
          },
          responseHeaders(version, false)
        );
      }
      return jsonResponse(receipt(), responseHeaders(0), 202);
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createEmploymentEvent(hire, CORRELATION_ID, authority(hire.context.idempotencyKey))
    ).resolves.toMatchObject({
      eventPublicId: EVENT_ID,
      lifecycleState: 'DRAFT',
      version: 0,
    });
    await expect(
      validateEmploymentEvent(
        {
          eventPublicId: EVENT_ID,
          expectedVersion: 0,
          idempotencyKey: validateKey,
          correlationId: CORRELATION_ID,
        },
        authority(validateKey)
      )
    ).resolves.toMatchObject({
      eventPublicId: EVENT_ID,
      lifecycleState: 'VALIDATED',
      version: 1,
    });
    await expect(
      submitEmploymentEvent(
        {
          eventPublicId: EVENT_ID,
          expectedVersion: 1,
          idempotencyKey: submitKey,
          correlationId: CORRELATION_ID,
        },
        authority(submitKey)
      )
    ).resolves.toMatchObject({
      eventPublicId: EVENT_ID,
      lifecycleState: 'PENDING_APPROVAL',
      version: 2,
    });
    expect(() =>
      publishEmploymentEvent(
        {
          eventPublicId: EVENT_ID,
          expectedVersion: 2,
          idempotencyKey: publishKey,
          correlationId: CORRELATION_ID,
        },
        publishAuthority(publishKey)
      )
    ).toThrow('Only an approved employment event at version 3 can be published.');
    await expect(getEmploymentEvent(EVENT_ID, 'scope:tenant/hrm')).resolves.toMatchObject({
      lifecycleState: 'APPROVED',
      version: 3,
    });
    await expect(
      publishEmploymentEvent(
        {
          eventPublicId: EVENT_ID,
          expectedVersion: 3,
          idempotencyKey: publishKey,
          correlationId: CORRELATION_ID,
        },
        publishAuthority(publishKey)
      )
    ).resolves.toMatchObject({
      eventPublicId: EVENT_ID,
      lifecycleState: 'PUBLISHED',
      version: 4,
    });
    await expect(
      getEmploymentEventCommandReceipt(RECEIPT_ID, 'scope:tenant/hrm')
    ).resolves.toMatchObject({
      receiptId: RECEIPT_ID,
      status: 'SUCCEEDED',
    });

    const commands = fetchMock.mock.calls.filter(
      ([url, init]) =>
        !String(url).includes('/api/auth/csrf') &&
        (init as RequestInit | undefined)?.method === 'POST'
    );
    expect(commands.map(([url]) => String(url).split('?')[0])).toEqual([
      '/api/people/v1/hris/assignment-events',
      `/api/people/v1/hris/assignment-events/${EVENT_ID}/validate`,
      `/api/people/v1/hris/assignment-events/${EVENT_ID}/submit`,
      `/api/people/v1/hris/assignment-events/${EVENT_ID}/publish`,
    ]);
    const expectedVersions = [0, 0, 1, 3];
    commands.forEach(([, init], index) => {
      const headers = new Headers((init as RequestInit).headers);
      expect(headers.get('If-Match')).toBe(`"v:${expectedVersions[index]}"`);
      expect(headers.get('X-Correlation-ID')).toBe(CORRELATION_ID);
      expect(headers.has('X-Purpose-Code')).toBe(false);
      expect(headers.get('Idempotency-Key')).toBeTruthy();
    });
    const publishHeaders = new Headers((commands.at(-1)![1] as RequestInit).headers);
    expect(publishHeaders.get('X-DWP-Step-Up-Challenge')).toBe('signed-hrm-publish');
    expect(publishHeaders.get('X-DWP-Expected-Object-Version')).toBe('3');
  });
});
