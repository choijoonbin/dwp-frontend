import type { HomeWidgetConfiguration } from '@dwp-frontend/shared-utils';

export type HomeWidgetContentContract = {
  sourceKey: string;
  fieldKeys: readonly string[];
  filterPresets: readonly string[];
};

const CONTRACTS: Readonly<Record<string, HomeWidgetContentContract>> = {
  activity: {
    sourceKey: 'ACTIVITY',
    fieldKeys: ['eventType', 'title', 'occurredAt', 'actor'],
    filterPresets: ['RECENT', 'MY_ACTIVITY'],
  },
  focus: {
    sourceKey: 'WORK',
    fieldKeys: ['title', 'status', 'priority', 'dueAt'],
    filterPresets: ['ASSIGNED_TO_ME', 'DUE_SOON', 'HIGH_PRIORITY'],
  },
  schedule: {
    sourceKey: 'CALENDAR',
    fieldKeys: ['title', 'startAt', 'endAt', 'location'],
    filterPresets: ['TODAY', 'NEXT_7_DAYS'],
  },
  'daily-brief': {
    sourceKey: 'RECOMMENDATION',
    fieldKeys: ['title', 'reason', 'action'],
    filterPresets: ['RECOMMENDED', 'NEXT_ACTIONS'],
  },
};

export function homeWidgetContentContract(widgetKey: string): HomeWidgetContentContract | null {
  return CONTRACTS[widgetKey] ?? null;
}

export function buildHomeWidgetConfiguration(
  widgetKey: string,
  fieldKeys: readonly string[],
  filterPreset: string,
  itemLimit: number
): HomeWidgetConfiguration {
  const contract = homeWidgetContentContract(widgetKey);
  if (!contract) throw new Error(`Widget ${widgetKey} does not allow content configuration.`);
  const fields = fieldKeys.filter(
    (field, index, values) => contract.fieldKeys.includes(field) && values.indexOf(field) === index
  );
  if (fields.length === 0) throw new Error('At least one registered widget field is required.');
  if (!contract.filterPresets.includes(filterPreset)) {
    throw new Error('The selected widget filter is not registered.');
  }
  return {
    sourceKey: contract.sourceKey,
    fieldKeys: fields,
    filterPreset,
    itemLimit: Math.min(20, Math.max(1, Math.trunc(itemLimit))),
  };
}
