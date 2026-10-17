import { beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));

vi.mock('@dwp-frontend/shared-utils', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  axiosInstance: { get: runtime.get, post: runtime.post },
}));

import { queryHrm009Entry, requestCertificate } from '../certificate-api';
import { createHrm009QueryRequest } from '../certificate-contract';
import {
  HRM009_TEST_AS_OF,
  HRM009_TEST_CORRELATION_ID,
  HRM009_TEST_PERSON_ID,
  HRM009_TEST_SCOPE,
  hrm009ProjectionWire,
  hrm009Receipt,
} from './certificate-fixtures.test-support';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type { Hrm009RequestCertificateCommand } from '../certificate-api';

const IDEMPOTENCY_KEY = 'certificate-command-key-0001';

const command: Hrm009RequestCertificateCommand = Object.freeze({
  expectedObjectVersion: 3,
  idempotencyKey: IDEMPOTENCY_KEY,
  correlationId: HRM009_TEST_CORRELATION_ID,
  request: Object.freeze({
    personPublicId: HRM009_TEST_PERSON_ID,
    certificateType: 'EMPLOYMENT_CERTIFICATE',
    purposeCode: 'EMPLOYEE_SELF_SERVICE',
    locale: 'en-US',
    asOf: HRM009_TEST_AS_OF,
  }),
});

function authority(): ProductSurfaceGovernedMutationAuthority {
  return {
    mode: 'SECURE',
    rolloutState: '111',
    expectedDecisionRevision: 'decision:hrm-009:52',
    contextKey: 'context:hrm-009:52',
    contextScopeKey: HRM009_TEST_SCOPE.contextScopeKey,
    idempotencyKey: IDEMPOTENCY_KEY,
    objectVersion: 3,
    stepUp: {
      challenge: 'signed-certificate-step-up-proof',
      challengeId: 'challenge:hrm-009:52',
      decisionRevision: 'decision:hrm-009:52',
      expiresAt: '2099-10-18T00:00:00Z',
    },
  };
}

describe('HRM-009 owner API', () => {
  beforeEach(() => {
    runtime.get.mockReset();
    runtime.post.mockReset();
  });

  it('serializes the accepted typed query range without trusted tenant fields', async () => {
    runtime.get.mockResolvedValue({ data: hrm009ProjectionWire('IAQ-010') });
    const signal = new AbortController().signal;
    const request = createHrm009QueryRequest('IAQ-010', HRM009_TEST_SCOPE, {
      limit: 25,
      filter: {
        certificateMetadata: { keys: ['certificate:employment'], versions: ['v1'] },
        documentMetadata: { keys: ['document:employment'] },
        effectiveOn: '2026-10-18',
      },
      sort: ['certificateMetadata:ASC', 'documentMetadata:DESC', 'itemPublicId:ASC'],
      asOf: HRM009_TEST_AS_OF,
      cursor: 'abcdefghijklmnop',
    });

    await queryHrm009Entry('IAQ-010', request, HRM009_TEST_SCOPE.contextScopeKey, signal);

    const [url, config] = runtime.get.mock.calls[0]!;
    const requestUrl = new URL(url, 'https://dwp.invalid');
    expect(requestUrl.pathname).toBe(
      '/api/people/v1/hris/workbench/operations/certificates/documents'
    );
    expect(requestUrl.searchParams.get('limit')).toBe('25');
    expect(requestUrl.searchParams.getAll('sort')).toEqual([
      'certificateMetadata:ASC',
      'documentMetadata:DESC',
      'itemPublicId:ASC',
    ]);
    expect(requestUrl.searchParams.getAll('filter[certificateMetadata][keys]')).toEqual([
      'certificate:employment',
    ]);
    expect(requestUrl.searchParams.get('filter[documentMetadata][keys]')).toBe(
      'document:employment'
    );
    expect(requestUrl.searchParams.get('filter[effectiveOn]')).toBe('2026-10-18');
    expect(requestUrl.searchParams.get('tenantId')).toBeNull();
    expect(config).toEqual({ contextScopeKey: HRM009_TEST_SCOPE.contextScopeKey, signal });
  });

  it('posts one exact HIGH-risk certificate command and returns its bound receipt', async () => {
    const receipt = {
      ...hrm009Receipt(),
      correlationId: command.correlationId,
      purposeCode: command.request.purposeCode,
    };
    runtime.post.mockResolvedValue({ data: receipt });

    await expect(requestCertificate(command, authority())).resolves.toEqual(receipt);

    expect(runtime.post).toHaveBeenCalledOnce();
    const [url, body, config] = runtime.post.mock.calls[0]!;
    expect(url).toBe('/api/people/v1/hris/certificates');
    expect(body).toEqual(command.request);
    expect(config).toMatchObject({
      contextScopeKey: HRM009_TEST_SCOPE.contextScopeKey,
      csrfReplay: 'NEVER',
      headers: {
        'Idempotency-Key': IDEMPOTENCY_KEY,
        'If-Match': '"v:3"',
        'X-Correlation-ID': HRM009_TEST_CORRELATION_ID,
        'X-Purpose-Code': 'EMPLOYEE_SELF_SERVICE',
        'X-DWP-Expected-Decision-Revision': 'decision:hrm-009:52',
        'X-DWP-Step-Up-Challenge': 'signed-certificate-step-up-proof',
        'X-DWP-Expected-Object-Version': '3',
      },
    });
  });

  it('rejects legacy, incomplete, replay-mismatched, or version-mismatched authority preflight', async () => {
    const secure = authority();
    const invalidAuthorities: ProductSurfaceGovernedMutationAuthority[] = [
      { mode: 'LEGACY_COMPATIBILITY', rolloutState: '100' },
      { ...secure, stepUp: undefined },
      { ...secure, idempotencyKey: 'different-command-key-0002' },
      { ...secure, objectVersion: 4 },
    ];

    for (const candidate of invalidAuthorities) {
      await expect(requestCertificate(command, candidate)).rejects.toThrow(
        'Certificate HIGH-risk authority does not match the command.'
      );
    }
    expect(runtime.post).not.toHaveBeenCalled();
  });

  it('rejects a valid receipt shape bound to another command, action, subject, or request', async () => {
    const receipt = {
      ...hrm009Receipt(),
      correlationId: command.correlationId,
      purposeCode: command.request.purposeCode,
    };
    const mismatchedReceipts = [
      { ...receipt, commandType: 'OTHER_CERTIFICATE_COMMAND' },
      { ...receipt, originatingAction: 'OTHER_CERTIFICATE_ACTION' },
      { ...receipt, subjectPrincipalPublicId: '99999999-9999-4999-8999-999999999999' },
      { ...receipt, correlationId: '88888888-8888-4888-8888-888888888888' },
      { ...receipt, purposeCode: 'HR_OPERATIONS' },
    ];

    for (const candidate of mismatchedReceipts) {
      runtime.post.mockResolvedValueOnce({ data: candidate });
      await expect(requestCertificate(command, authority())).rejects.toThrow(
        'Certificate receipt does not match the submitted command.'
      );
    }

    runtime.post.mockResolvedValueOnce({ data: receipt });
    await expect(requestCertificate(command, authority())).resolves.toEqual(receipt);
  });

  it('accepts exact 16 and 128 character replay keys without a character allowlist and rejects 15 or 129', async () => {
    const receipt = {
      ...hrm009Receipt(),
      correlationId: command.correlationId,
      purposeCode: command.request.purposeCode,
    };
    runtime.post.mockResolvedValue({ data: receipt });
    const acceptedKeys = ['key with/slash#!', `${'x'.repeat(127)}#`];

    for (const idempotencyKey of acceptedKeys) {
      await expect(
        requestCertificate({ ...command, idempotencyKey }, { ...authority(), idempotencyKey })
      ).resolves.toEqual(receipt);
    }
    expect(runtime.post.mock.calls.map((call) => call[2].headers['Idempotency-Key'])).toEqual(
      acceptedKeys
    );

    for (const idempotencyKey of ['x'.repeat(15), 'x'.repeat(129)]) {
      await expect(
        requestCertificate({ ...command, idempotencyKey }, { ...authority(), idempotencyKey })
      ).rejects.toThrow('Certificate idempotency key is invalid.');
    }
    expect(runtime.post).toHaveBeenCalledTimes(2);
  });

  it('rejects UUID versions outside the accepted v1-v5 transport boundary before I/O', async () => {
    const versionSix = '22222222-2222-6222-8222-222222222222';

    await expect(
      requestCertificate({ ...command, correlationId: versionSix }, authority())
    ).rejects.toThrow('Certificate correlation identifier is invalid.');
    await expect(
      requestCertificate(
        { ...command, request: { ...command.request, personPublicId: versionSix } },
        authority()
      )
    ).rejects.toThrow('certificateRequest.personPublicId');

    expect(runtime.post).not.toHaveBeenCalled();
  });
});
