import { describe, expect, it } from 'vitest';
import { parseApprovalSignatureReadProjection } from './approval-signature-read-projection';

const oversight = () => ({
  providerId: '03446339-cb7f-08e9-f975-66aad46e7fb2',
  providerKey: 'DOCUSIGN',
  displayName: 'DocuSign',
  providerType: 'REMOTE',
  lifecycleState: 'ACTIVE',
  credentialConfigured: true,
  lastHealthCheckedAt: '2026-10-27T09:00:00Z',
  version: 2,
});

const full = () => ({
  ...oversight(),
  capabilities: {
    internalAttestation: false,
    auditEvidence: true,
    verifiedIdentity: true,
    remoteSigningSupported: true,
    readiness: 'EXTERNAL_VERIFICATION_REQUIRED',
  },
});

describe('approval signature read projection', () => {
  it('accepts the backend oversight projection without inventing full authority', () => {
    const projection = parseApprovalSignatureReadProjection([oversight()]);

    expect(projection).toEqual({ mode: 'OVERSIGHT', providers: [oversight()] });
    expect('capabilities' in projection.providers[0]!).toBe(false);
  });

  it('accepts a homogeneous full-management projection with the closed capability contract', () => {
    const projection = parseApprovalSignatureReadProjection([full()]);

    expect(projection).toEqual({ mode: 'FULL_MANAGEMENT', providers: [full()] });
  });

  it('treats an empty oneOf list as oversight because it cannot prove management authority', () => {
    expect(parseApprovalSignatureReadProjection([])).toEqual({
      mode: 'OVERSIGHT',
      providers: [],
    });
  });

  it('rejects ambiguous or contract-external data instead of promoting it', () => {
    const invalidProjections: unknown[] = [
      [{ ...oversight(), leakedField: 'must-not-render' }],
      [oversight(), full()],
      [{ ...full(), capabilities: { ...full().capabilities, readiness: 'READYISH' } }],
      [{ ...full(), capabilities: { ...full().capabilities, clientSecret: 'secret' } }],
      [{ ...full(), capabilities: undefined }],
    ];

    for (const value of invalidProjections) {
      expect(() => parseApprovalSignatureReadProjection(value)).toThrow(
        'Invalid approval signature read projection'
      );
    }
  });
});
