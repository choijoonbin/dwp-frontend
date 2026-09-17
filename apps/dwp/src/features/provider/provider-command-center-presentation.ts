import type { ProviderCommandCenter } from '@dwp-frontend/shared-utils';

type ProviderOperatingState = ProviderCommandCenter['operatingState'];

const stateRank: Record<ProviderOperatingState, number> = {
  HEALTHY: 0,
  ATTENTION: 1,
  CRITICAL: 2,
};

/**
 * Keep the command-center headline consistent with the operational evidence rendered below it.
 * The Provider API remains authoritative, but the UI must never downgrade failed services or an
 * explicit action queue to a contradictory "healthy" presentation when snapshots arrive from
 * different reconciliation intervals.
 */
export function providerCommandCenterPresentationState(
  command: ProviderCommandCenter
): ProviderOperatingState {
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

  return stateRank[evidenceState] > stateRank[command.operatingState]
    ? evidenceState
    : command.operatingState;
}

export function providerCustomerImpactTone(
  activeIncidents: number,
  impactedTenants: number
): 'error' | 'warning' | 'success' {
  if (activeIncidents > 0) return 'error';
  if (impactedTenants > 0) return 'warning';
  return 'success';
}
