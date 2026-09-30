import type { ProviderCommandCenter } from '@dwp-frontend/shared-utils';

type ProviderOperatingState = ProviderCommandCenter['operatingState'];
export type ProviderOperatingPresentationState = ProviderOperatingState | 'UNAVAILABLE';
export type ProviderActionSeverityPresentation = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

const stateRank: Record<ProviderOperatingState, number> = {
  HEALTHY: 0,
  ATTENTION: 1,
  CRITICAL: 2,
};

export function providerOperatingStatePresentation(
  state: unknown
): ProviderOperatingPresentationState {
  return state === 'HEALTHY' || state === 'ATTENTION' || state === 'CRITICAL'
    ? state
    : 'UNAVAILABLE';
}

export function providerActionSeverityPresentation(
  severity: unknown
): ProviderActionSeverityPresentation {
  return severity === 'CRITICAL' ||
    severity === 'HIGH' ||
    severity === 'MEDIUM' ||
    severity === 'LOW'
    ? severity
    : 'UNKNOWN';
}

/**
 * Keep the command-center headline consistent with the operational evidence rendered below it.
 * The Provider API remains authoritative, but the UI must never downgrade failed services or an
 * explicit action queue to a contradictory "healthy" presentation when snapshots arrive from
 * different reconciliation intervals.
 */
export function providerCommandCenterPresentationState(
  command: ProviderCommandCenter
): ProviderOperatingPresentationState {
  const evidenceState: ProviderOperatingState =
    command.services.some((service) => service.failedInstances > 0) ||
    command.actionQueue.some((item) => item.severity === 'CRITICAL')
      ? 'CRITICAL'
      : command.activeIncidents > 0 ||
          command.actionQueue.length > 0 ||
          command.services.some(
            (service) => service.pendingInstances > 0 || service.degradedInstances > 0
          )
        ? 'ATTENTION'
        : 'HEALTHY';

  const authoritativeState = providerOperatingStatePresentation(command.operatingState);
  if (authoritativeState === 'UNAVAILABLE') return authoritativeState;

  return stateRank[evidenceState] > stateRank[authoritativeState]
    ? evidenceState
    : authoritativeState;
}

export function providerCustomerImpactTone(
  activeIncidents: number,
  impactedTenants: number
): 'error' | 'warning' | 'success' {
  if (activeIncidents > 0) return 'error';
  if (impactedTenants > 0) return 'warning';
  return 'success';
}
