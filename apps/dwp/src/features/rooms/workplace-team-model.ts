import { Temporal } from 'temporal-polyfill';

import type { WorkplaceSharingVisibility } from '@dwp-frontend/shared-utils';

export const workplaceSharingLevels: readonly WorkplaceSharingVisibility[] = [
  'PRIVATE',
  'SITE',
  'FLOOR',
  'RESOURCE',
];

export function workplacePlanWeek(date: string) {
  const selected = Temporal.PlainDate.from(date);
  const start = selected.subtract({ days: selected.dayOfWeek - 1 });
  const days = Array.from({ length: 7 }, (_, index) => start.add({ days: index }).toString());
  return { from: days[0]!, to: days[6]!, days };
}

export function workplaceSharingOptions({
  enabled,
  maximumVisibility,
  optIn,
  preferredVisibility,
  hasGroups,
}: {
  enabled: boolean;
  maximumVisibility: WorkplaceSharingVisibility;
  optIn: boolean;
  preferredVisibility: WorkplaceSharingVisibility;
  hasGroups: boolean;
}) {
  const maximum =
    enabled && optIn && hasGroups
      ? Math.min(
          workplaceSharingLevels.indexOf(maximumVisibility),
          workplaceSharingLevels.indexOf(preferredVisibility)
        )
      : 0;
  return workplaceSharingLevels.slice(0, maximum + 1);
}
