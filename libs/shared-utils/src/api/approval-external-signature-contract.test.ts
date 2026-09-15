import { describe, expect, it } from 'vitest';
import { diagnosticOverview } from './approval-signature-diagnostics.test-support';
import {
  readApprovalExternalSignatureArtifact,
  readApprovalExternalSignatureAudit,
  readApprovalExternalSignatureContext,
  readApprovalExternalSignatureReceipt,
  snapshotApprovalExternalSignatureCommandInput,
  snapshotApprovalExternalSignatureCreateInput,
} from './approval-external-signature-contract';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const requestId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const policyId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const sha = 'a'.repeat(64);
const scope = diagnosticOverview().scope;
const provider = {
  providerId: id,
  expectedProviderVersion: 3,
  expectedProviderSha256: sha,
  expectedConfiguration: { sourceId: id, version: 3, sha256: sha },
};
const source = {
  requestId,
  requestVersion: 4,
  resourceSetKey: 'RS_APPROVALS',
  dataClassification: 'CONFIDENTIAL',
  workflowVersionId: id,
  formVersionId: policyId,
  payloadRevision: 2,
  payloadSha256: sha,
  sourceSha256: sha,
};
const request = {
  scope,
  signatureRequestId: id,
  source,
  provider,
  policyId,
  policyVersionId: requestId,
  policySha256: sha,
  state: 'PREPARED',
  version: 0,
  remoteReferenceSha256: null,
  reasonCodes: [],
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z',
};

describe('native external signature contract', () => {
  it('accepts only the exact context/request/receipt projection', () => {
    const overview = diagnosticOverview();
    expect(
      readApprovalExternalSignatureContext({
        scope,
        source,
        policy: {
          sourceState: 'AVAILABLE',
          pin: { sourceId: policyId, version: 1, sha256: sha },
          requiredProviderKinds: ['DOCUSIGN'],
          maxProbeAgeSeconds: 3600,
          probeIntervalSeconds: 300,
          retentionFloorSeconds: 31_536_000,
        },
        providers: overview.providers,
        gateState: 'ELIGIBLE',
        reasonCodes: [],
        evaluatedAt: '2026-09-15T00:00:00Z',
      }).source.requestVersion
    ).toBe(4);
    expect(
      readApprovalExternalSignatureReceipt({
        receiptId: policyId,
        outcome: 'COMMITTED',
        committedAt: '2026-09-15T00:00:01Z',
        signatureRequest: request,
      }).signatureRequest
    ).toMatchObject({ signatureRequestId: id, state: 'PREPARED', version: 0 });
  });

  it('rejects extra fields, fabricated eligibility and unbound verified completion', () => {
    const overview = diagnosticOverview();
    expect(() =>
      readApprovalExternalSignatureContext({
        scope,
        source,
        policy: overview.policy,
        providers: overview.providers,
        gateState: 'ELIGIBLE',
        reasonCodes: [],
        evaluatedAt: '2026-09-15T00:00:00Z',
        credentialSecret: 'forbidden',
      })
    ).toThrow();
    expect(() =>
      readApprovalExternalSignatureContext({
        scope,
        source,
        policy: {
          ...overview.policy,
          sourceState: 'UNRECORDED',
          pin: null,
          requiredProviderKinds: null,
          maxProbeAgeSeconds: null,
          probeIntervalSeconds: null,
          retentionFloorSeconds: null,
        },
        providers: [],
        gateState: 'ELIGIBLE',
        reasonCodes: [],
        evaluatedAt: '2026-09-15T00:00:00Z',
      })
    ).toThrow();
    expect(() =>
      readApprovalExternalSignatureReceipt({
        receiptId: policyId,
        outcome: 'COMMITTED',
        committedAt: '2026-09-15T00:00:01Z',
        signatureRequest: { ...request, state: 'COMPLETED_VERIFIED' },
      })
    ).toThrow();
  });

  it('freezes exact create and command CAS pins', () => {
    const create = snapshotApprovalExternalSignatureCreateInput({
      expectedRequestVersion: 4,
      expectedSourceRevision: `sigp-${sha}`,
      expectedSourceSha256: sha,
      provider,
      idempotencyKey: 'external:create:1',
    });
    const command = snapshotApprovalExternalSignatureCommandInput({
      expectedVersion: 2,
      expectedSourceRevision: `sigp-${sha}`,
      expectedSourceSha256: sha,
      idempotencyKey: 'external:handover:1',
    });
    expect(create.provider).toEqual(provider);
    expect(command.expectedVersion).toBe(2);
    expect(Object.isFrozen(create)).toBe(true);
    expect(() =>
      snapshotApprovalExternalSignatureCommandInput({
        ...command,
        expectedSourceRevision: `sigp-${'b'.repeat(64)}`,
      })
    ).toThrow();
  });

  it('requires paired audit evidence and retained exact artifact evidence', () => {
    expect(
      readApprovalExternalSignatureAudit({
        items: [
          {
            eventId: id,
            sequence: 1,
            action: 'HANDOVER',
            state: 'OUT_FOR_SIGNATURE',
            reasonCodes: [],
            evidenceId: policyId,
            evidenceSha256: sha,
            occurredAt: '2026-09-15T00:00:00Z',
          },
        ],
        truncated: false,
      }).items
    ).toHaveLength(1);
    expect(
      readApprovalExternalSignatureArtifact({
        artifactId: id,
        kind: 'SIGNED_PDF',
        mediaType: 'application/pdf',
        sha256: sha,
        sizeBytes: 2048,
        storageLocatorSha256: sha,
        objectVersionSha256: sha,
        retainUntil: '2036-09-15T00:00:00Z',
        evidenceId: policyId,
        evidenceSha256: sha,
        recordedAt: '2026-09-15T00:00:00Z',
      }).kind
    ).toBe('SIGNED_PDF');
    expect(() =>
      readApprovalExternalSignatureAudit({
        items: [
          {
            eventId: id,
            sequence: 1,
            action: 'HANDOVER',
            state: 'OUT_FOR_SIGNATURE',
            reasonCodes: [],
            evidenceId: policyId,
            evidenceSha256: null,
            occurredAt: '2026-09-15T00:00:00Z',
          },
        ],
        truncated: false,
      })
    ).toThrow();
  });
});
