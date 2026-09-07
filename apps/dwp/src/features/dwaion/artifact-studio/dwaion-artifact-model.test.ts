import { describe, expect, it } from 'vitest';

import {
  artifactExportCapability,
  artifactPreflightIsCurrent,
  artifactPublishCapability,
  artifactVersionsComparable,
  selectArtifact,
} from './dwaion-artifact-model';

import type {
  DwaionArtifactDocument,
  DwaionArtifactVersion,
  DwaionDlpPreflight,
} from './dwaion-artifact-model';

const artifact: DwaionArtifactDocument = {
  artifactId: 'artifact-1',
  title: 'Decision note',
  artifactType: 'DOCUMENT',
  state: 'DRAFT',
  revision: 4,
  draftRevision: 2,
  currentVersionNumber: 1,
  publishedVersionNumber: null,
  updatedAt: '2026-09-04T00:00:00Z',
  body: 'Grounded content',
  format: 'MARKDOWN',
  sources: [],
  autosaveState: 'SAVED',
  lastSavedAt: '2026-09-04T00:00:00Z',
  capabilities: {
    immutableVersionsAvailable: true,
    deterministicPreflightAvailable: true,
    sourceVerificationAvailable: false,
    sourceFreshnessAvailable: false,
    personalPublishStateAvailable: true,
    recipientSharingAvailable: false,
    exportRequestAvailable: true,
    exportExecutionAvailable: false,
  },
};

const preflight: DwaionDlpPreflight = {
  preflightId: 'preflight-1',
  artifactId: artifact.artifactId,
  artifactRevision: artifact.revision,
  versionNumber: 1,
  outcome: 'PASS',
  current: true,
  findings: [],
  evaluatedAt: '2026-09-04T00:00:00Z',
  expiresAt: '2026-09-04T00:15:00Z',
  publishAllowed: true,
  exportAllowed: true,
};

const version = (
  versionNumber: number,
  artifactId = artifact.artifactId
): DwaionArtifactVersion => ({
  artifactId,
  versionNumber,
  contentFingerprint: 'a'.repeat(64),
  sourceCount: 0,
  createdAt: '2026-09-04T00:00:00Z',
  immutable: true,
  content: { title: 'Decision note', body: `Version ${versionNumber}`, format: 'MARKDOWN' },
});

describe('DWAI governed artifact model', () => {
  it('allows personal publication only for a saved current version with passing preflight', () => {
    expect(artifactPublishCapability({ artifact, preflight, permitted: true })).toEqual({
      allowed: true,
    });
    expect(
      artifactPublishCapability({
        artifact: { ...artifact, autosaveState: 'SAVING' },
        preflight,
        permitted: true,
      })
    ).toEqual({ allowed: false, reason: 'UNSAVED_CHANGES' });
    expect(
      artifactPublishCapability({
        artifact,
        preflight: { ...preflight, outcome: 'REVIEW' },
        permitted: true,
      })
    ).toEqual({ allowed: false, reason: 'PREFLIGHT_BLOCKED' });
    expect(
      artifactPublishCapability({
        artifact: { ...artifact, revision: artifact.revision + 1 },
        preflight,
        permitted: true,
      })
    ).toEqual({ allowed: false, reason: 'PREFLIGHT_REQUIRED' });
    expect(
      artifactPublishCapability({
        artifact,
        preflight: { ...preflight, publishAllowed: false },
        permitted: true,
      })
    ).toEqual({ allowed: false, reason: 'PREFLIGHT_BLOCKED' });
  });

  it('requires personal publication before an export request', () => {
    expect(artifactExportCapability({ artifact, preflight, permitted: true })).toEqual({
      allowed: false,
      reason: 'PUBLISH_REQUIRED',
    });
    expect(
      artifactExportCapability({
        artifact: { ...artifact, state: 'PUBLISHED', publishedVersionNumber: 1 },
        preflight,
        permitted: true,
      })
    ).toEqual({ allowed: true });
    expect(
      artifactExportCapability({
        artifact: { ...artifact, state: 'PUBLISHED', publishedVersionNumber: 1 },
        preflight: { ...preflight, exportAllowed: false },
        permitted: true,
      })
    ).toEqual({ allowed: false, reason: 'PREFLIGHT_BLOCKED' });
  });

  it('invalidates preflight when it does not target the current immutable version', () => {
    expect(artifactPreflightIsCurrent(artifact, preflight)).toBe(true);
    expect(artifactPreflightIsCurrent({ ...artifact, currentVersionNumber: 2 }, preflight)).toBe(
      false
    );
  });

  it('compares immutable loaded versions only within the same artifact', () => {
    expect(artifactVersionsComparable(version(1), version(2))).toBe(true);
    expect(artifactVersionsComparable(version(1), version(1))).toBe(false);
    expect(artifactVersionsComparable(version(1), version(2, 'artifact-2'))).toBe(false);
    expect(artifactVersionsComparable({ ...version(1), content: undefined }, version(2))).toBe(
      false
    );
  });

  it('does not manufacture a selection for an unknown identifier', () => {
    expect(selectArtifact([artifact], 'artifact-1')?.artifactId).toBe('artifact-1');
    expect(selectArtifact([artifact], 'unknown')).toBeNull();
    expect(selectArtifact([artifact], undefined)).toBeNull();
  });
});
