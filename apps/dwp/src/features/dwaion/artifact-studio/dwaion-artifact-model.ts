export type DwaionArtifactViewState = 'loading' | 'error' | 'permission-denied' | 'ready';
export type DwaionArtifactAutosaveState =
  'IDLE' | 'DIRTY' | 'SAVING' | 'SAVED' | 'CONFLICT' | 'FAILED';
export type DwaionArtifactType = 'DOCUMENT' | 'WORK_PLAN' | 'COMPARISON';
export type DwaionArtifactState = 'DRAFT' | 'REVIEW_REQUIRED' | 'PUBLISHED' | 'ARCHIVED';

export type DwaionArtifactCapabilities = {
  immutableVersionsAvailable: boolean;
  deterministicPreflightAvailable: boolean;
  sourceVerificationAvailable: boolean;
  sourceFreshnessAvailable: boolean;
  personalPublishStateAvailable: boolean;
  recipientSharingAvailable: boolean;
  exportRequestAvailable: boolean;
  exportExecutionAvailable: boolean;
};

export type DwaionArtifactSummary = {
  artifactId: string;
  title: string;
  artifactType: DwaionArtifactType;
  state: DwaionArtifactState;
  revision: number;
  draftRevision: number;
  currentVersionNumber: number;
  publishedVersionNumber: number | null;
  updatedAt: string;
  capabilities: DwaionArtifactCapabilities;
};

export type DwaionArtifactSourceReference = {
  sourceType:
    | 'WORK_ITEM'
    | 'MAIL'
    | 'CALENDAR'
    | 'APPROVAL_TASK'
    | 'APPROVAL_REQUEST'
    | 'APPROVAL_FORM'
    | 'APPROVAL_OPERATION';
  reference: string;
};

export type DwaionArtifactDocument = DwaionArtifactSummary & {
  body: string;
  format: 'MARKDOWN';
  sources: readonly DwaionArtifactSourceReference[];
  autosaveState: DwaionArtifactAutosaveState;
  lastSavedAt?: string;
};

export type DwaionArtifactEvidence = {
  evidenceId: string;
  sourceType: string;
  reference: string;
  verificationState: 'UNVERIFIED';
  freshness: 'UNKNOWN';
  verifiedAt: string | null;
};

export type DwaionArtifactVersion = {
  artifactId: string;
  versionNumber: number;
  contentFingerprint: string;
  sourceCount: number;
  createdAt: string;
  immutable: true;
  content?: { title: string; body: string; format: string };
  sourceEvidence?: readonly DwaionArtifactEvidence[];
};

export type DwaionDlpFinding = {
  code: string;
  severity: 'PASS' | 'REVIEW' | 'BLOCKED';
  field: string;
};

export type DwaionDlpPreflight = {
  preflightId: string;
  artifactId: string;
  artifactRevision: number;
  versionNumber: number;
  outcome: 'PASS' | 'REVIEW' | 'BLOCKED';
  current: boolean;
  findings: readonly DwaionDlpFinding[];
  evaluatedAt: string;
  expiresAt: string;
  publishAllowed: boolean;
  exportAllowed: boolean;
};

export type DwaionArtifactExportEvidence = {
  exportJobId: string;
  exportFormat: 'MARKDOWN' | 'DOCX' | 'PDF';
  state: 'PENDING';
  executionAvailable: false;
  fileAvailable: false;
};

export type DwaionArtifactReleaseCapability =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | 'PERMISSION_REQUIRED'
        | 'UNSAVED_CHANGES'
        | 'REVISION_CONFLICT'
        | 'VERSION_REQUIRED'
        | 'PREFLIGHT_REQUIRED'
        | 'PREFLIGHT_BLOCKED'
        | 'PERSONAL_PUBLISH_UNAVAILABLE'
        | 'PUBLISH_REQUIRED'
        | 'EXPORT_REQUEST_UNAVAILABLE';
    };

export function artifactPublishCapability({
  artifact,
  preflight,
  permitted,
}: {
  artifact: DwaionArtifactDocument;
  preflight: DwaionDlpPreflight | null;
  permitted: boolean;
}): DwaionArtifactReleaseCapability {
  const base = artifactVersionedCapability(artifact, preflight, permitted, 'publish');
  if (!base.allowed) return base;
  if (!artifact.capabilities.personalPublishStateAvailable) {
    return { allowed: false, reason: 'PERSONAL_PUBLISH_UNAVAILABLE' };
  }
  return { allowed: true };
}

export function artifactExportCapability({
  artifact,
  preflight,
  permitted,
}: {
  artifact: DwaionArtifactDocument;
  preflight: DwaionDlpPreflight | null;
  permitted: boolean;
}): DwaionArtifactReleaseCapability {
  const base = artifactVersionedCapability(artifact, preflight, permitted, 'export');
  if (!base.allowed) return base;
  if (
    artifact.state !== 'PUBLISHED' ||
    artifact.publishedVersionNumber !== artifact.currentVersionNumber
  ) {
    return { allowed: false, reason: 'PUBLISH_REQUIRED' };
  }
  if (!artifact.capabilities.exportRequestAvailable) {
    return { allowed: false, reason: 'EXPORT_REQUEST_UNAVAILABLE' };
  }
  return { allowed: true };
}

function artifactVersionedCapability(
  artifact: DwaionArtifactDocument,
  preflight: DwaionDlpPreflight | null,
  permitted: boolean,
  operation: 'publish' | 'export'
): DwaionArtifactReleaseCapability {
  if (!permitted) return { allowed: false, reason: 'PERMISSION_REQUIRED' };
  if (artifact.autosaveState === 'CONFLICT') {
    return { allowed: false, reason: 'REVISION_CONFLICT' };
  }
  if (!['IDLE', 'SAVED'].includes(artifact.autosaveState)) {
    return { allowed: false, reason: 'UNSAVED_CHANGES' };
  }
  if (artifact.currentVersionNumber < 1) {
    return { allowed: false, reason: 'VERSION_REQUIRED' };
  }
  if (
    !preflight ||
    !preflight.current ||
    preflight.artifactId !== artifact.artifactId ||
    preflight.versionNumber !== artifact.currentVersionNumber ||
    (operation === 'publish' && preflight.artifactRevision !== artifact.revision)
  ) {
    return { allowed: false, reason: 'PREFLIGHT_REQUIRED' };
  }
  if (
    preflight.outcome !== 'PASS' ||
    (operation === 'publish' && !preflight.publishAllowed) ||
    (operation === 'export' && !preflight.exportAllowed)
  ) {
    return { allowed: false, reason: 'PREFLIGHT_BLOCKED' };
  }
  return { allowed: true };
}

export function artifactPreflightIsCurrent(
  artifact: DwaionArtifactDocument,
  preflight: DwaionDlpPreflight | null
): boolean {
  return Boolean(
    preflight &&
    preflight.current &&
    preflight.artifactId === artifact.artifactId &&
    preflight.versionNumber === artifact.currentVersionNumber
  );
}

export function artifactVersionsComparable(
  left: DwaionArtifactVersion | null,
  right: DwaionArtifactVersion | null
): boolean {
  return Boolean(
    left &&
    right &&
    left.immutable &&
    right.immutable &&
    left.content &&
    right.content &&
    left.artifactId === right.artifactId &&
    left.versionNumber !== right.versionNumber
  );
}

export function selectArtifact(
  artifacts: readonly DwaionArtifactSummary[],
  selectedId: string | undefined
): DwaionArtifactSummary | null {
  return artifacts.find((artifact) => artifact.artifactId === selectedId) ?? null;
}
