import { HRIS_INVENTORY_GROUP_ORDER } from './hris-product-map-contract';
import { HRIS_DWP_CONTROL_CATALOG } from './catalog/dwp-control';
import { HRIS_HR_OPERATIONS_CATALOG } from './catalog/hr-operations';
import { HRIS_MY_HR_CATALOG } from './catalog/my-hr';
import { HRIS_PAYROLL_CATALOG } from './catalog/payroll';
import { HRIS_PERFORMANCE_CATALOG } from './catalog/performance';
import { HRIS_SETTINGS_CATALOG } from './catalog/settings';
import { HRIS_TEAM_CATALOG } from './catalog/team';
import { HRIS_TIME_CATALOG } from './catalog/time';

import type {
  HrisCatalogLocale,
  HrisCatalogNode,
  HrisInventoryGroup,
  HrisModule,
  HrisPersona,
  HrisWorkSurface,
} from './hris-product-map-contract';

export type {
  HrisAvailability,
  HrisCatalogLocale,
  HrisCatalogNode,
  HrisExternalTarget,
  HrisInventoryGroup,
  HrisLifecycle,
  HrisLocalizedText,
  HrisModule,
  HrisPersona,
  HrisWorkSurface,
} from './hris-product-map-contract';
export { HRIS_RETAINED_OUTSIDE_TARGET } from './hris-retained-route-registry';
export {
  HRIS_INVENTORY_GROUP_LABELS,
  HRIS_INVENTORY_GROUP_ORDER,
} from './hris-product-map-contract';

export const HRIS_PRODUCT_MAP_CATALOG: readonly HrisCatalogNode[] = Object.freeze([
  ...HRIS_MY_HR_CATALOG,
  ...HRIS_TEAM_CATALOG,
  ...HRIS_HR_OPERATIONS_CATALOG,
  ...HRIS_TIME_CATALOG,
  ...HRIS_PAYROLL_CATALOG,
  ...HRIS_PERFORMANCE_CATALOG,
  ...HRIS_SETTINGS_CATALOG,
  ...HRIS_DWP_CONTROL_CATALOG,
]);

export function resolveHrisCatalogLocale(locale: string | undefined): HrisCatalogLocale {
  try {
    return new Intl.Locale(locale || 'en').language === 'ko' ? 'ko' : 'en';
  } catch {
    return 'en';
  }
}

export function filterHrisCatalog(
  surface: HrisWorkSurface,
  module: HrisModule | 'ALL',
  persona: HrisPersona | 'ALL'
): readonly HrisCatalogNode[] {
  return HRIS_PRODUCT_MAP_CATALOG.filter(
    (item) =>
      item.surface === surface &&
      (module === 'ALL' || item.module === module) &&
      (persona === 'ALL' || item.personas.includes(persona))
  );
}

export function countHrisCatalogByInventoryGroup(): Readonly<Record<HrisInventoryGroup, number>> {
  return Object.fromEntries(
    HRIS_INVENTORY_GROUP_ORDER.map((group) => [
      group,
      HRIS_PRODUCT_MAP_CATALOG.filter((item) => item.inventoryGroup === group).length,
    ])
  ) as Record<HrisInventoryGroup, number>;
}
