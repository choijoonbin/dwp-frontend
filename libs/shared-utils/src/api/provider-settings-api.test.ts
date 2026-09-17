import { beforeEach, describe, expect, it, vi } from 'vitest';

import { axiosInstance } from '../axios-instance';
import {
  getProviderEffectiveSetting,
  listProviderSettings,
  type ProviderSettingDefinition,
  type ProviderSettingResolution,
} from './provider-settings-api';

vi.mock('../axios-instance', () => ({ axiosInstance: { get: vi.fn() } }));

const definition: ProviderSettingDefinition = {
  settingId: 'feature.rollout.example',
  displayName: 'Example feature',
  description: 'A governed feature rollout.',
  owner: {
    service: 'dwp-provider-server',
    domain: 'FEATURE_ROLLOUT',
    readPermission: 'PROVIDER.FEATURE_ROLLOUT:READ',
    managementPath: '/provider/feature-rollouts',
  },
  supportedScopes: ['TENANT'],
  validation: {
    valueType: 'BOOLEAN',
    schemaVersion: '1',
    schema: { type: 'boolean' },
    ownerRevalidatesOnWrite: true,
  },
  sensitivity: 'INTERNAL',
  change: {
    riskTier: 'L2',
    workflow: 'APPROVE_AND_ACTIVATE',
    approvalRequired: true,
    activationRequired: true,
  },
  lifecycleState: 'ACTIVE',
  definitionVersion: 1,
};

describe('provider settings read API', () => {
  beforeEach(() => vi.resetAllMocks());

  it('encodes catalog filters and unwraps the API response', async () => {
    vi.mocked(axiosInstance.get).mockResolvedValue({ data: { data: [definition] } });

    await expect(
      listProviderSettings({
        query: ' rollout value ',
        ownerService: ' provider service ',
        scopeType: 'TENANT',
      })
    ).resolves.toEqual([definition]);
    expect(axiosInstance.get).toHaveBeenCalledWith(
      '/api/provider/v1/admin/settings?query=rollout+value&ownerService=provider+service&scopeType=TENANT',
      undefined
    );
  });

  it('keeps the typed unsupported-observation state instead of implying convergence', async () => {
    const resolution: ProviderSettingResolution = {
      settingId: definition.settingId,
      resolutionState: 'RESOLVED',
      definition,
      target: { scopeType: 'TENANT', scopeId: 'tenant-1', environment: 'production' },
      effectiveValue: true,
      effectiveVersion: '7',
      provenance: [],
      applicationStatus: {
        state: 'OBSERVATION_UNSUPPORTED',
        desiredState: 'PUBLISHED',
        desiredVersion: '7',
        publishedVersion: '7',
        uniformlyObservedVersion: null,
        expectedTargetCount: 0,
        observedTargetCount: 0,
        convergedTargetCount: 0,
        failedTargetCount: 0,
        driftedTargetCount: 0,
        publishAcceptedAt: null,
        latestObservationAt: null,
        stale: false,
      },
      reasonCode: 'RESOLVED_FROM_ACTIVE_ROLLOUT',
      resolvedAt: '2026-09-17T12:00:00Z',
    };
    vi.mocked(axiosInstance.get).mockResolvedValue({ data: { data: resolution } });

    await expect(
      getProviderEffectiveSetting(
        ' feature/rollout ',
        { scopeType: 'TENANT', scopeId: ' tenant-1 ', environment: ' production ' },
        undefined
      )
    ).resolves.toEqual(resolution);
    expect(axiosInstance.get).toHaveBeenCalledWith(
      '/api/provider/v1/admin/settings/feature%2Frollout/effective?scopeType=TENANT&scopeId=tenant-1&environment=production',
      undefined
    );
  });

  it('rejects incomplete effective-value targets before issuing a request', async () => {
    await expect(
      getProviderEffectiveSetting('', { scopeType: 'TENANT', scopeId: 'tenant-1' })
    ).rejects.toThrow('settingId is required.');
    await expect(
      getProviderEffectiveSetting('feature.rollout.example', { scopeType: 'TENANT', scopeId: ' ' })
    ).rejects.toThrow('scopeId is required.');
    expect(axiosInstance.get).not.toHaveBeenCalled();
  });
});
