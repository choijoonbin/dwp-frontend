import type {
  CatalogCriticality,
  CatalogEntityKind,
  CatalogRelationType,
} from '@dwp-frontend/shared-utils';

export const CATALOG_KINDS: Array<CatalogEntityKind | 'ALL'> = [
  'ALL',
  'APP',
  'CONNECTOR',
  'API',
  'DATA_PRODUCT',
  'REFERENCE_SET',
  'CODE_SET',
  'NAVIGATION',
  'PERMISSION',
  'SERVICE',
  'AGENT',
  'TOOL',
  'POLICY',
  'CONNECTOR_INSTANCE',
];

export const CATALOG_RELATION_TYPES: CatalogRelationType[] = [
  'DEPENDS_ON',
  'CONSUMES',
  'PRODUCES',
  'EXPOSES',
  'GOVERNS',
  'NAVIGATES_TO',
  'REQUIRES_PERMISSION',
  'SYNCHRONIZES',
];

export const CATALOG_CRITICALITIES: CatalogCriticality[] = [
  'INFORMATIONAL',
  'OPERATIONAL',
  'CRITICAL',
];

export const APPLICATION_LIFECYCLE_OWNER_QUERY_KEYS = [
  ['admin', 'app-governance'],
  ['admin', 'tenant-app-adoption', 'projection'],
  ['admin', 'tenant-app-adoption', 'assignments'],
] as const;
