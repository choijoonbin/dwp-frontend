import { workspaceWidgetCatalogDefinition } from '../../components/workspace-composer/workspace-widget-catalog';

import type { HomeWidgetConfiguration } from '@dwp-frontend/shared-utils';

export type HomeWidgetContentContract = {
  sourceKey: string;
  fieldKeys: readonly string[];
  filterPresets: readonly string[];
};

export function homeWidgetContentContract(widgetKey: string): HomeWidgetContentContract | null {
  const configuration = workspaceWidgetCatalogDefinition(widgetKey)?.configuration;
  return configuration
    ? {
        sourceKey: configuration.sourceKey,
        fieldKeys: configuration.fieldKeys,
        filterPresets: configuration.filterPresets,
      }
    : null;
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
