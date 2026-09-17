import { describe, expect, it } from 'vitest';

import {
  workplaceSafetyActivationBlocked,
  workplaceSafetyCanResend,
  workplaceSafetyHasSourceRisk,
  workplaceSafetyNeedsGetOnlyRecovery,
} from './workplace-safety-ui-model';

import type {
  WorkplaceSafetyActivationPreview,
  WorkplaceSafetyIncident,
} from '@dwp-frontend/shared-utils';

const NOW = '2026-09-16T12:00:00Z';

function incident(state: 'FAILED' | 'RESULT_UNKNOWN'): WorkplaceSafetyIncident {
  return {
    incidentId: '20000000-0000-4000-8000-000000000001',
    incidentNumber: 'INC-20',
    incidentType: 'EVACUATION',
    severity: 'CRITICAL',
    state: 'ACTIVE',
    siteId: '20000000-0000-4000-8000-000000000002',
    floorIds: [],
    zoneIds: [],
    message: 'Evacuate.',
    safetyAction: 'Use the marked exit.',
    assemblyPoint: null,
    channels: ['APP_PUSH'],
    audience: {
      audienceSnapshotId: '20000000-0000-4000-8000-000000000003',
      totalCandidates: 1,
      deduplicatedCount: 1,
      excludedCount: 0,
      unknownCount: 0,
      finalTargetCount: 1,
      sources: [],
      members: [],
      asOf: NOW,
    },
    responses: { safe: 0, needsHelp: 0, noResponse: 1 },
    assembly: { confirmed: 0, pending: 1 },
    dispatches: [
      {
        dispatchBatchId: '20000000-0000-4000-8000-000000000004',
        state,
        attemptCount: 1,
        deliveredCount: 0,
        failedCount: state === 'FAILED' ? 1 : 0,
        unknownCount: state === 'RESULT_UNKNOWN' ? 1 : 0,
        channels: ['APP_PUSH'],
        updatedAt: NOW,
      },
    ],
    connectorTruth: [],
    version: 1,
    activatedAt: NOW,
    closedAt: null,
    updatedAt: NOW,
  };
}

describe('Workplace safety UI policy', () => {
  it('permits resend only for verified failures and forces GET-only recovery for unknown results', () => {
    expect(workplaceSafetyCanResend(incident('FAILED'))).toBe(true);
    expect(workplaceSafetyCanResend(incident('RESULT_UNKNOWN'))).toBe(false);
    expect(workplaceSafetyNeedsGetOnlyRecovery(incident('RESULT_UNKNOWN'))).toBe(true);
  });

  it('blocks resend through an external channel until matching connector truth is READY', () => {
    const failed = incident('FAILED');
    expect(
      workplaceSafetyCanResend({
        ...failed,
        channels: ['APP_PUSH', 'EBS'],
        connectorTruth: [
          {
            kind: 'EBS',
            providerCode: 'ebs-provider',
            state: 'CONFIGURED_UNVERIFIED',
            configurationVersion: 3,
            observedConfigurationVersion: null,
            evidenceReference: null,
            sourceAt: NOW,
            receivedAt: NOW,
            lastSuccessAt: null,
            errorCode: 'PROVIDER_NOT_VERIFIED',
            version: 4,
            evaluatedAt: NOW,
          },
        ],
      })
    ).toBe(false);
  });

  it('treats stale or partial audience sources as an explicit risk', () => {
    expect(
      workplaceSafetyHasSourceRisk([
        {
          source: 'ACTUAL_PRESENCE',
          candidateCount: 10,
          includedCount: 6,
          excludedCount: 1,
          unknownCount: 3,
          coveragePercent: 60,
          freshness: 'STALE',
          availability: 'PARTIAL',
          sourceAt: NOW,
          receivedAt: NOW,
        },
      ])
    ).toBe(true);
  });

  it('blocks selected external channels until their observed connector truth is READY', () => {
    const preview: WorkplaceSafetyActivationPreview = {
      activationPreviewId: '20000000-0000-4000-8000-000000000005',
      incidentType: 'EVACUATION',
      severity: 'CRITICAL',
      siteId: '20000000-0000-4000-8000-000000000002',
      floorIds: [],
      zoneIds: [],
      message: 'Evacuate.',
      safetyAction: 'Use the marked exit.',
      assemblyPoint: null,
      channels: ['EBS'],
      eligible: true,
      audience: {
        audienceSnapshotId: '20000000-0000-4000-8000-000000000003',
        totalCandidates: 10,
        deduplicatedCount: 10,
        excludedCount: 0,
        unknownCount: 0,
        finalTargetCount: 10,
        sources: [],
        members: [],
        asOf: NOW,
      },
      connectorTruth: [
        {
          kind: 'EBS',
          providerCode: 'ebs-provider',
          state: 'CONFIGURED_UNVERIFIED',
          configurationVersion: 3,
          observedConfigurationVersion: null,
          evidenceReference: null,
          sourceAt: NOW,
          receivedAt: NOW,
          lastSuccessAt: null,
          errorCode: 'PROVIDER_NOT_VERIFIED',
          version: 4,
          evaluatedAt: NOW,
        },
      ],
      limitations: [],
      expiresAt: '2026-09-16T12:05:00Z',
      createdAt: NOW,
    };
    expect(workplaceSafetyActivationBlocked(preview)).toBe(true);
    expect(
      workplaceSafetyActivationBlocked({
        ...preview,
        connectorTruth: [{ ...preview.connectorTruth[0]!, state: 'READY' }],
      })
    ).toBe(false);
  });
});
