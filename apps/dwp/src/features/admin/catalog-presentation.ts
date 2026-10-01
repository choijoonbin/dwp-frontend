const CATALOG_KINDS = new Set([
  'REFERENCE_SET',
  'APP',
  'CONNECTOR',
  'AGENT',
  'TOOL',
  'POLICY',
  'API',
  'DATA_PRODUCT',
  'CODE_SET',
  'SERVICE',
  'NAVIGATION',
  'CONNECTOR_INSTANCE',
  'PERMISSION',
]);
const CATALOG_SCOPES = new Set(['TENANT', 'GLOBAL_PRODUCT']);
const CATALOG_CRITICALITIES = new Set(['INFORMATIONAL', 'OPERATIONAL', 'CRITICAL']);
const CATALOG_RELATION_TYPES = new Set([
  'DEPENDS_ON',
  'CONSUMES',
  'PRODUCES',
  'EXPOSES',
  'GOVERNS',
  'NAVIGATES_TO',
  'REQUIRES_PERMISSION',
  'SYNCHRONIZES',
]);
const ASSURANCE_FINDINGS = new Set(['OWNER_MISSING', 'ORPHAN_ASSET', 'DEPRECATION_IMPACT']);
const ASSURANCE_STATES = new Set([
  'OPEN',
  'ACKNOWLEDGED',
  'FALSE_POSITIVE',
  'ACCEPTED_RISK',
  'RESOLVED',
]);

export function catalogKindLabelKey(value: string): string {
  return `catalog.kinds.${CATALOG_KINDS.has(value) ? value : 'UNKNOWN'}`;
}

export function catalogScopeLabelKey(value: string): string {
  return `catalog.scopes.${CATALOG_SCOPES.has(value) ? value : 'UNKNOWN'}`;
}

export function catalogRelationTypeLabelKey(value: string): string {
  return `catalog.relation.types.${CATALOG_RELATION_TYPES.has(value) ? value : 'UNKNOWN'}`;
}

export function catalogCriticalityLabelKey(value: string): string {
  return `catalog.criticality.${CATALOG_CRITICALITIES.has(value) ? value : 'UNKNOWN'}`;
}

export function catalogCriticalityStroke(value: string): string {
  const colors: Record<string, string> = {
    INFORMATIONAL: '#64748B',
    OPERATIONAL: '#0284C7',
    CRITICAL: '#DC2626',
  };
  return colors[value] ?? '#64748B';
}

export function catalogAssuranceFindingLabelKey(value: string): string {
  return `catalog.assurance.findings.${ASSURANCE_FINDINGS.has(value) ? value : 'UNKNOWN'}`;
}

export function catalogAssuranceStateLabelKey(value: string): string {
  return `catalog.assurance.states.${ASSURANCE_STATES.has(value) ? value : 'UNKNOWN'}`;
}

export type CatalogEvidenceItem = { labelKey: string; value: string };

export function catalogAssuranceEvidencePresentation(evidence: Record<string, unknown>): {
  retainedFieldCount: number;
  items: CatalogEvidenceItem[];
} {
  const items: CatalogEvidenceItem[] = [];
  const entityRevision = evidence.entityRevision;
  const dependentCount = evidence.directDependentCount;
  if (Number.isSafeInteger(entityRevision) && Number(entityRevision) >= 0) {
    items.push({
      labelKey: 'catalog.assurance.inspector.entityRevision',
      value: String(entityRevision),
    });
  }
  if (Number.isSafeInteger(dependentCount) && Number(dependentCount) >= 0) {
    items.push({
      labelKey: 'catalog.assurance.inspector.directDependents',
      value: String(dependentCount),
    });
  }
  return { retainedFieldCount: Object.keys(evidence).length, items };
}
