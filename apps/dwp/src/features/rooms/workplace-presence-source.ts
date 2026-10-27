import type { WorkplaceConnectorStatus } from '@dwp-frontend/shared-utils';
export type WorkplacePresenceSourceState =
  'LOADING' | 'READY' | 'DEGRADED' | 'STALE' | 'UNAVAILABLE';

export type WorkplacePresenceSource = Readonly<{
  state: WorkplacePresenceSourceState;
  provider: string | null;
  updatedAt: string | null;
}>;

export function workplacePresenceSource(
  connector: WorkplaceConnectorStatus | undefined,
  pending: boolean,
  failed: boolean
): WorkplacePresenceSource {
  if (!connector) {
    return {
      state: pending && !failed ? 'LOADING' : 'UNAVAILABLE',
      provider: null,
      updatedAt: null,
    };
  }
  if (failed) {
    return {
      state: connector.lastVerifiedAt ? 'STALE' : 'UNAVAILABLE',
      provider: connector.provider,
      updatedAt: connector.lastVerifiedAt,
    };
  }
  if (connector.status === 'HEALTHY' && connector.lastVerifiedAt) {
    return {
      state: 'READY',
      provider: connector.provider,
      updatedAt: connector.lastVerifiedAt,
    };
  }
  if (connector.status === 'DEGRADED' && connector.lastVerifiedAt) {
    return {
      state: 'DEGRADED',
      provider: connector.provider,
      updatedAt: connector.lastVerifiedAt,
    };
  }
  if (connector.status === 'STALE' && connector.lastVerifiedAt) {
    return {
      state: 'STALE',
      provider: connector.provider,
      updatedAt: connector.lastVerifiedAt,
    };
  }
  return {
    state: 'UNAVAILABLE',
    provider: connector.provider,
    updatedAt: null,
  };
}
