import { describe, expect, it } from 'vitest';

import {
  ArtifactFormError,
  artifactEnumPresentation,
  buildArtifactManifest,
  buildArtifactRollback,
  buildArtifactStages,
  buildArtifactTarget,
  canDecideArtifactPlan,
  canReviewArtifact,
  compatibilityEvidenceTemplate,
  deriveCompatibilityDecision,
  parseCompatibilityPolicy,
  parseRolloutProjection,
} from './provider-artifact-governance-model';

const policy = {
  schema: {
    currentVersion: '2.4.2',
    targetVersion: '2.5.0',
    migrationState: 'ADDITIVE_ONLY',
  },
  clients: [{ clientType: 'WEB', minimumVersion: '2.4' }],
  dependencies: [{ dependencyKey: 'idp.adapter', requiredVersion: '2.1' }],
  capabilities: { allowAdded: true, allowRemoved: false, allowIncreased: false },
  rollback: { required: true, strategy: 'TRAFFIC_REVERT' },
};

describe('provider artifact governance model', () => {
  it('creates a typed review template without inventing successful evidence', () => {
    const evidence = compatibilityEvidenceTemplate(policy)!;

    expect(parseCompatibilityPolicy(policy)).not.toBeNull();
    expect(evidence?.dependencies[0]).toEqual({
      dependencyKey: 'idp.adapter',
      observedVersion: '',
      requiredVersion: '2.1',
      state: 'REVIEW_REQUIRED',
    });
    expect(evidence.rollbackReadiness.state).toBe('REVIEW_REQUIRED');
    expect(deriveCompatibilityDecision(policy, evidence)).toBeNull();

    evidence.schema.state = 'PASSED';
    evidence.clients[0]!.state = 'PASSED';
    evidence.dependencies[0]!.observedVersion = '2.3.4';
    evidence.dependencies[0]!.state = 'PASSED';
    evidence.rollbackReadiness.state = 'READY';
    evidence.rollbackReadiness.reasons = [];
    expect(deriveCompatibilityDecision(policy, evidence)).toBe('COMPATIBLE');
  });

  it('blocks a forbidden capability removal', () => {
    const evidence = compatibilityEvidenceTemplate(policy)!;
    evidence.schema.state = 'PASSED';
    evidence.clients[0]!.state = 'PASSED';
    evidence.dependencies[0]!.observedVersion = '2.3.4';
    evidence.dependencies[0]!.state = 'PASSED';
    evidence.rollbackReadiness.state = 'READY';
    evidence.rollbackReadiness.reasons = [];
    evidence.capabilities.removed = ['legacy-export'];

    expect(deriveCompatibilityDecision(policy, evidence)).toBe('BLOCKED');
  });

  it('projects target, stages, and recovery without inventing executor state', () => {
    const projection = parseRolloutProjection(
      {
        environmentKey: 'kr-prod',
        tenantKeys: ['tenant-a'],
        cohortKeys: ['pilot'],
        targetPercentage: 30,
      },
      [
        {
          stageKey: 'pilot',
          targetPercentage: 10,
          minimumObservationMinutes: 60,
          approvalGate: true,
        },
      ],
      {
        strategy: 'TRAFFIC_REVERT',
        targetVersion: '2.4.2',
        dataHandling: 'PRESERVE_CURRENT_SCHEMA',
        validationChecks: ['health'],
        manualSteps: [],
      }
    );

    expect(projection.target?.targetPercentage).toBe(30);
    expect(projection.stages[0]?.approvalGate).toBe(true);
    expect(projection.rollback?.dataHandling).toBe('PRESERVE_CURRENT_SCHEMA');
  });

  it('fails closed for malformed opaque payloads', () => {
    expect(parseCompatibilityPolicy({ schema: {} })).toBeNull();
    expect(deriveCompatibilityDecision(policy, { schema: {} })).toBeNull();
    expect(parseRolloutProjection({}, [{}], {}).target).toBeNull();
  });

  it('fails closed when evidence drifts from the declared client contract', () => {
    const evidence = compatibilityEvidenceTemplate(policy)!;
    evidence.schema.state = 'PASSED';
    evidence.clients[0]!.minimumVersion = '1.0';
    evidence.clients[0]!.state = 'PASSED';
    evidence.dependencies[0]!.observedVersion = '2.3.4';
    evidence.dependencies[0]!.state = 'PASSED';
    evidence.rollbackReadiness.state = 'READY';
    evidence.rollbackReadiness.reasons = [];

    expect(deriveCompatibilityDecision(policy, evidence)).toBeNull();
  });

  it('builds typed manifest, target, stages, and rollback payloads', () => {
    expect(
      buildArtifactManifest({
        entrypoint: 'service-main',
        packageReference: 'registry://workspace/2.5.0',
        changeSummary: 'Adds typed governance controls',
      })
    ).toEqual({
      entrypoint: 'service-main',
      packageReference: 'registry://workspace/2.5.0',
      changeSummary: 'Adds typed governance controls',
    });
    expect(
      buildArtifactTarget({
        environmentKey: 'production',
        tenantKeys: ['tenant-a'],
        cohortKeys: ['pilot'],
        targetPercentage: '25',
      })
    ).toMatchObject({ targetPercentage: 25 });
    expect(
      buildArtifactStages([
        {
          id: '1',
          stageKey: 'pilot',
          targetPercentage: '10',
          minimumObservationMinutes: '60',
          approvalGate: true,
        },
        {
          id: '2',
          stageKey: 'general',
          targetPercentage: '100',
          minimumObservationMinutes: '120',
          approvalGate: true,
        },
      ])
    ).toHaveLength(2);
    expect(
      buildArtifactRollback({
        strategy: 'TRAFFIC_REVERT',
        targetVersion: '2.4.2',
        dataHandling: 'PRESERVE_CURRENT_SCHEMA',
        validationChecks: ['service-health'],
        manualSteps: [],
      })
    ).toMatchObject({ strategy: 'TRAFFIC_REVERT' });
  });

  it('fails closed for invalid stages, enums, and self decisions', () => {
    expect(() =>
      buildArtifactStages([
        {
          id: '1',
          stageKey: 'general',
          targetPercentage: '50',
          minimumObservationMinutes: '0',
          approvalGate: false,
        },
        {
          id: '2',
          stageKey: 'pilot',
          targetPercentage: '10',
          minimumObservationMinutes: '0',
          approvalGate: false,
        },
      ])
    ).toThrowError(ArtifactFormError);
    expect(artifactEnumPresentation('artifactType', 'FUTURE_TYPE')).toBe('UNAVAILABLE_VALUE');
    expect(canReviewArtifact({ createdBy: 10 }, 10, true)).toBe(false);
    expect(canReviewArtifact({ createdBy: 10 }, 11, true)).toBe(true);
    expect(canDecideArtifactPlan({ requestedBy: 10 }, 10, true)).toBe(false);
    expect(canDecideArtifactPlan({ requestedBy: 10 }, 11, true)).toBe(true);
  });
});
