import { describe, expect, it } from 'vitest';

import { hasCurrentWidgetCertificationEvidence } from './provider-widget-catalog';

import type { WidgetEvidence, WidgetEvidenceType, WidgetVersion } from '@dwp-frontend/shared-utils';

const version = {
  versionId: 'version-1',
  definitionId: 'definition-1',
  semanticVersion: '1.0.0',
  manifest: {},
  manifestHash: 'a'.repeat(64),
  workflowState: 'APPROVED',
  releaseState: 'PUBLISHED',
  safetyState: 'CLEAR',
  attestation: {},
  certificationStatus: 'PASS',
  predecessorVersionId: null,
  replacementVersionId: null,
  validationRunId: 'validation-1',
  bindingCatalogRevision: 'binding-1',
  version: 1,
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z',
  allowedTransitions: [],
} as unknown as WidgetVersion;

function evidence(evidenceType: WidgetEvidenceType, overrides: Partial<WidgetEvidence> = {}) {
  return {
    evidenceId: `evidence-${evidenceType}`,
    versionId: 'version-1',
    evidenceType,
    status: 'PASS',
    manifestHash: 'a'.repeat(64),
    evidenceRef: `ref-${evidenceType}`,
    evidenceSha256: 'b'.repeat(64),
    expiresAt: '2026-10-15T00:00:00Z',
    decisionRevision: 1,
    waivedEvidenceId: null,
    trackingTicketRef: null,
    reviewedBy: 'reviewer-ref',
    createdAt: '2026-09-15T00:00:00Z',
    ...overrides,
  } as WidgetEvidence;
}

describe('provider certification display gate', () => {
  const required: WidgetEvidenceType[] = [
    'MANIFEST',
    'SECURITY',
    'PRIVACY',
    'A11Y',
    'PERFORMANCE',
    'LOCALIZATION',
  ];

  it('does not claim certification from a seed manifest record alone', () => {
    expect(
      hasCurrentWidgetCertificationEvidence(
        version,
        [evidence('MANIFEST')],
        new Date('2026-09-15T00:00:00Z')
      )
    ).toBe(false);
  });

  it('requires every current evidence category and rejects expiry or hash drift', () => {
    const complete = required.map((type) => evidence(type));
    expect(
      hasCurrentWidgetCertificationEvidence(version, complete, new Date('2026-09-15T00:00:00Z'))
    ).toBe(true);
    expect(
      hasCurrentWidgetCertificationEvidence(
        version,
        complete.map((entry) =>
          entry.evidenceType === 'SECURITY'
            ? { ...entry, expiresAt: '2026-09-14T00:00:00Z' }
            : entry
        ),
        new Date('2026-09-15T00:00:00Z')
      )
    ).toBe(false);
    expect(
      hasCurrentWidgetCertificationEvidence(
        version,
        complete.map((entry) =>
          entry.evidenceType === 'PRIVACY' ? { ...entry, manifestHash: 'c'.repeat(64) } : entry
        ),
        new Date('2026-09-15T00:00:00Z')
      )
    ).toBe(false);
  });
});
