import type {
  WorkplaceSafetyActivationPreview,
  WorkplaceSafetyCommandReceipt,
  WorkplaceSafetyConnectorState,
  WorkplaceSafetyDispatchSummary,
  WorkplaceSafetyIncident,
  WorkplaceSafetySeverity,
  WorkplaceSafetySourceSummary,
} from '@dwp-frontend/shared-utils';

export type WorkplaceSafetyTone = 'default' | 'info' | 'success' | 'warning' | 'error';

export function workplaceSafetySeverityTone(
  severity: WorkplaceSafetySeverity
): WorkplaceSafetyTone {
  if (severity === 'CRITICAL') return 'error';
  if (severity === 'URGENT') return 'warning';
  return 'info';
}

export function workplaceSafetyConnectorTone(
  state: WorkplaceSafetyConnectorState
): WorkplaceSafetyTone {
  if (state === 'READY') return 'success';
  if (state === 'DEGRADED' || state === 'STALE') return 'warning';
  return 'error';
}

export function workplaceSafetySourceTone(
  source: WorkplaceSafetySourceSummary
): WorkplaceSafetyTone {
  if (source.availability === 'UNAVAILABLE') return 'error';
  if (
    source.availability === 'PARTIAL' ||
    source.freshness === 'STALE' ||
    source.freshness === 'UNKNOWN'
  ) {
    return 'warning';
  }
  return 'success';
}

export function workplaceSafetyIncidentTone(
  incident: Pick<WorkplaceSafetyIncident, 'state' | 'severity'>
): WorkplaceSafetyTone {
  if (incident.state === 'CLOSED' || incident.state === 'CANCELLED') return 'default';
  if (incident.state === 'CLOSURE_PENDING') return 'warning';
  return workplaceSafetySeverityTone(incident.severity);
}

export function latestWorkplaceSafetyDispatch(
  dispatches: readonly WorkplaceSafetyDispatchSummary[]
): WorkplaceSafetyDispatchSummary | null {
  return (
    [...dispatches].sort(
      (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
    )[0] ?? null
  );
}

export function workplaceSafetyNeedsGetOnlyRecovery(
  incident: Pick<WorkplaceSafetyIncident, 'dispatches'> | null | undefined,
  receipt?: WorkplaceSafetyCommandReceipt | null
): boolean {
  if (receipt?.state === 'RESULT_UNKNOWN') return true;
  return (
    incident?.dispatches.some(
      (dispatch) => dispatch.state === 'RESULT_UNKNOWN' || dispatch.unknownCount > 0
    ) ?? false
  );
}

export function workplaceSafetyCanResend(incident: WorkplaceSafetyIncident): boolean {
  if (incident.state !== 'ACTIVE' || workplaceSafetyNeedsGetOnlyRecovery(incident)) return false;
  const connectorReady = incident.channels.every((channel) => {
    const kind = channel === 'EBS' ? 'EBS' : channel === 'BLE_MESH' ? 'BLE_MESH' : null;
    return (
      kind === null ||
      incident.connectorTruth.some(
        (connector) => connector.kind === kind && connector.state === 'READY'
      )
    );
  });
  if (!connectorReady) return false;
  return incident.dispatches.some(
    (dispatch) =>
      dispatch.state === 'FAILED' || dispatch.state === 'PARTIAL' || dispatch.failedCount > 0
  );
}

export function workplaceSafetyHasSourceRisk(
  sources: readonly WorkplaceSafetySourceSummary[]
): boolean {
  return sources.some(
    (source) => source.availability !== 'AVAILABLE' || source.freshness !== 'FRESH'
  );
}

export function workplaceSafetyActivationBlocked(preview: WorkplaceSafetyActivationPreview) {
  return (
    !preview.eligible ||
    preview.audience.finalTargetCount < 1 ||
    preview.connectorTruth.some(
      (connector) =>
        ((connector.kind === 'EBS' && preview.channels.includes('EBS')) ||
          (connector.kind === 'BLE_MESH' && preview.channels.includes('BLE_MESH'))) &&
        connector.state !== 'READY'
    )
  );
}
