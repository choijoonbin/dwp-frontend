import type { NormalizedHomeContribution } from '../contributions';
import type { FlowSignal } from './flow-home-model';

export type DedicatedCalendarSignalVisibility = Readonly<{
  focusBalance: boolean;
  meetingLoad: boolean;
}>;

const SIGNAL_KEYS_BY_PROVIDER: Readonly<Record<string, readonly FlowSignal['key'][] | undefined>> =
  {
    'workspace-work': ['open-work'],
    'calendar-home': ['focus-time', 'schedule-load'],
    'workspace-activity': ['activity-attention'],
  };

/**
 * Keeps role pulse rows that add information beyond the visual insight.
 * A provider row is removed only when a matching, permission-scoped signal is
 * actually available; partial data therefore never turns into a silent gap.
 */
export function filterRolePulseTextItems(
  items: readonly NormalizedHomeContribution[],
  signals: readonly FlowSignal[]
): readonly NormalizedHomeContribution[] {
  if (signals.length === 0) return items;
  const availableSignals = new Set(signals.map((signal) => signal.key));

  return items.filter((item) => {
    const coveredSignals = SIGNAL_KEYS_BY_PROVIDER[item.providerKey];
    return !coveredSignals?.some((signalKey) => availableSignals.has(signalKey));
  });
}

/**
 * A calendar signal belongs either to its independent widget or to the compact
 * role overview, never both. Hiding a specialist widget restores its signal in
 * role pulse so personalization cannot remove the underlying information.
 */
export function filterRolePulseSignals(
  signals: readonly FlowSignal[],
  dedicated: DedicatedCalendarSignalVisibility
): FlowSignal[] {
  return signals.filter(
    (signal) =>
      (signal.key !== 'focus-time' || !dedicated.focusBalance) &&
      (signal.key !== 'schedule-load' || !dedicated.meetingLoad)
  );
}
