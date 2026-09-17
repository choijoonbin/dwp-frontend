import type {
  WorkplaceConnectorRuntimeState,
  WorkplaceConnectorRuntimeTruth,
} from '@dwp-frontend/shared-utils';

export function summarizeWorkplaceConnectorRuntime(
  connectors: readonly WorkplaceConnectorRuntimeTruth[]
) {
  return {
    total: connectors.length,
    healthy: connectors.filter((connector) => connector.state === 'HEALTHY').length,
    attention: connectors.filter((connector) =>
      ['DEGRADED', 'STALE', 'CONFIGURED_UNVERIFIED'].includes(connector.state)
    ).length,
    replaying: connectors.filter((connector) => connector.state === 'REPLAYING').length,
  };
}

export function workplaceConnectorRuntimeTone(
  state: WorkplaceConnectorRuntimeState
): 'success' | 'warning' | 'error' | 'info' | 'default' {
  if (state === 'HEALTHY') return 'success';
  if (state === 'REPLAYING') return 'info';
  if (state === 'DEGRADED' || state === 'CONFIGURED_UNVERIFIED') return 'warning';
  if (state === 'STALE') return 'error';
  return 'default';
}

export function canPreviewWorkplaceConnectorReplay(
  connector: WorkplaceConnectorRuntimeTruth | null | undefined
) {
  return Boolean(
    connector?.enabled &&
    connector.provider &&
    connector.runtimeVersion !== null &&
    connector.capabilities.includes('REPLAY') &&
    !['NOT_CONFIGURED', 'DISABLED', 'CONFIGURED_UNVERIFIED'].includes(connector.state)
  );
}

export function defaultWorkplaceConnectorReplayWindow(evaluatedAt: string) {
  const to = new Date(evaluatedAt);
  const from = new Date(to.getTime() - 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function replayDateTimeToInstant(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString();
}
