import { describe, expect, it } from 'vitest';

import { HttpError } from '../http-error';
import { toDwaionOperationalGateProblem } from './agent-admin-api';

describe('DWAI-ON operational gate API boundary', () => {
  it('maps RFC 9457 problem details to a stable product error code', () => {
    const error = new HttpError('Request failed.', 409, {
      type: 'urn:dwp:problem:operational-gates:gate_required_evidence_missing',
      title: 'Required evidence is incomplete',
      status: 409,
      detail: 'Required evidence is missing: SECURITY_REVIEW',
      code: 'GATE_REQUIRED_EVIDENCE_MISSING',
      correlationId: 'corr-42',
      context: { missingEvidenceTypes: ['SECURITY_REVIEW'] },
    });

    expect(toDwaionOperationalGateProblem(error)).toEqual({
      code: 'GATE_REQUIRED_EVIDENCE_MISSING',
      status: 409,
      detail: 'Required evidence is missing: SECURITY_REVIEW',
      correlationId: 'corr-42',
      context: { missingEvidenceTypes: ['SECURITY_REVIEW'] },
    });
  });

  it('does not expose an unknown server envelope as a trusted product error', () => {
    const error = new HttpError('Gateway failure.', 502, { unexpected: true });

    expect(toDwaionOperationalGateProblem(error)).toEqual({
      code: 'GATE_UNKNOWN',
      status: 502,
      detail: 'Gateway failure.',
      context: {},
    });
  });
});
