const VALUES = {
  domainType: ['LOGIN', 'EMAIL', 'CUSTOM'],
  domainVerificationMethod: ['DNS_TXT', 'HTTP', 'INTERNAL'],
  codeConfigurationLevel: ['SYSTEM', 'EXTENSIBLE', 'USER'],
  codeContractKind: [
    'REFERENCE',
    'STATE_MACHINE',
    'SECURITY',
    'PROTOCOL',
    'OBSERVABILITY',
    'REGISTRY_META',
  ],
  codeRegistrationState: ['REGISTERED', 'INCOMPLETE'],
  codeRuntimeVisibility: ['ADMIN_ONLY', 'RUNTIME'],
  dataStatus: ['AVAILABLE', 'UNAVAILABLE'],
  dataClassification: ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'],
  dataFindingCategory: [
    'SOURCE_UNAVAILABLE',
    'OWNERSHIP_REVIEW',
    'MISSING_PRIMARY_KEY',
    'MISSING_DOCUMENTATION',
    'TIMEZONE_AMBIGUITY',
    'UNINDEXED_FOREIGN_KEY',
    'DUPLICATE_FOREIGN_KEY',
    'ANNOTATION_DRIFT',
    'LINEAGE_DRIFT',
  ],
  dataFindingSeverity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
  widgetDefinitionState: ['ACTIVE', 'RETIRED'],
  widgetWorkflowState: ['DRAFT', 'VALIDATED', 'SUBMITTED', 'APPROVED', 'REJECTED'],
  widgetReleaseState: ['UNPUBLISHED', 'PUBLISHED', 'BLOCKED', 'DEPRECATED'],
  widgetSafetyState: ['CLEAR', 'QUARANTINED', 'REVOKED'],
  widgetCertificationStatus: ['NOT_RUN', 'PASS', 'FAIL', 'EXPIRED', 'WAIVED'],
} as const;

export type ProviderSafeEnumKind = keyof typeof VALUES;

export function providerSafeEnumPresentation(kind: ProviderSafeEnumKind, value: unknown): string {
  return typeof value === 'string' && (VALUES[kind] as readonly string[]).includes(value)
    ? value
    : 'UNAVAILABLE';
}

type ProviderCodeEnumKind =
  'codeConfigurationLevel' | 'codeContractKind' | 'codeRegistrationState' | 'codeRuntimeVisibility';

const CODE_SECTIONS: Record<ProviderCodeEnumKind, string> = {
  codeConfigurationLevel: 'levels',
  codeContractKind: 'kinds',
  codeRegistrationState: 'states',
  codeRuntimeVisibility: 'visibility',
};

export function providerCodeEnumTranslationKey(kind: ProviderCodeEnumKind, value: unknown): string {
  return `codeContracts.${CODE_SECTIONS[kind]}.${providerSafeEnumPresentation(kind, value)}`;
}

type ProviderWidgetEnumKind =
  | 'widgetDefinitionState'
  | 'widgetWorkflowState'
  | 'widgetReleaseState'
  | 'widgetSafetyState'
  | 'widgetCertificationStatus';

const WIDGET_SECTIONS: Record<ProviderWidgetEnumKind, string> = {
  widgetDefinitionState: 'definitionState',
  widgetWorkflowState: 'workflowState',
  widgetReleaseState: 'releaseState',
  widgetSafetyState: 'safetyState',
  widgetCertificationStatus: 'certificationStatus',
};

export function providerWidgetEnumTranslationKey(
  kind: ProviderWidgetEnumKind,
  value: unknown
): string {
  return `widgetCatalog.controlPlane.${WIDGET_SECTIONS[kind]}.${providerSafeEnumPresentation(
    kind,
    value
  )}`;
}
