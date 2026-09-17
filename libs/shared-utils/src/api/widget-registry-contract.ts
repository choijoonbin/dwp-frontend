export const WIDGET_REGISTRY_CAPABILITIES = {
  controlPlane: 'WIDGET_REGISTRY_CONTROL_PLANE',
  shadowEvaluation: 'WIDGET_REGISTRY_SHADOW_EVALUATION',
  tenantPolicy: 'TENANT_WIDGET_POLICY',
  authoritativeRuntime: 'WIDGET_REGISTRY_AUTHORITATIVE_RUNTIME',
} as const;

export type WidgetRegistryCapability =
  (typeof WIDGET_REGISTRY_CAPABILITIES)[keyof typeof WIDGET_REGISTRY_CAPABILITIES];
export type WidgetRegistryMigrationMode = 'STATIC' | 'SHADOW' | 'AUTHORITATIVE';

export type WidgetRegistryReadiness = Readonly<{
  schemaVersion: 1;
  migrationMode: WidgetRegistryMigrationMode;
  controlPlaneReady: boolean;
  runtimeActivationReady: boolean;
  capabilities: readonly string[];
  registryRevision: number;
  policyRevision: number;
  safetyRevision: number;
}>;

export type WidgetDefinitionState = 'ACTIVE' | 'RETIRED';
export type WidgetWorkflowState = 'DRAFT' | 'VALIDATED' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type WidgetReleaseState = 'UNPUBLISHED' | 'PUBLISHED' | 'BLOCKED' | 'DEPRECATED';
export type WidgetSafetyState = 'CLEAR' | 'QUARANTINED' | 'REVOKED';
export type WidgetCertificationStatus = 'NOT_RUN' | 'PASS' | 'FAIL' | 'EXPIRED' | 'WAIVED';
export type WidgetReleaseChannel = 'STABLE' | 'PREVIEW';
export type WidgetRiskTier = 'LOW' | 'MEDIUM' | 'HIGH';
export type WidgetDataClassification = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
export type WidgetEvidenceType =
  'MANIFEST' | 'SECURITY' | 'PRIVACY' | 'A11Y' | 'PERFORMANCE' | 'LOCALIZATION';
export type WidgetEvidenceStatus = 'PASS' | 'FAIL' | 'EXPIRED' | 'WAIVED';

export type WidgetDefinition = Readonly<{
  definitionId: string;
  definitionKey: string;
  legacyWidgetKey: string | null;
  ownerProductKey: string;
  ownerTeamKey: string;
  riskTier: WidgetRiskTier;
  dataClassification: WidgetDataClassification;
  definitionState: WidgetDefinitionState;
  version: number;
  createdAt: string;
  updatedAt: string;
  allowedTransitions: readonly string[];
}>;

export type NativeWidgetManifest = Readonly<{
  schemaVersion: 1;
  definitionKey: string;
  owner: Readonly<{
    productKey: string;
    sourceAppResourceKey: string;
  }>;
  renderer: Readonly<{
    kind: 'NATIVE';
    rendererKey: string;
    minimumHostApiVersion: number;
  }>;
  supportedSurfaces: readonly string[];
  requiredAuthorities: readonly string[];
  placement: Readonly<{
    supportedContexts: readonly WidgetPlacementContext[];
    policyClass: 'PERSONAL' | 'GOVERNED';
    canHide: boolean;
    defaultSize: string;
    allowedSizes: readonly string[];
    defaultHeight: string;
    allowedHeights: readonly string[];
  }>;
  configurationContract: Readonly<{
    sourceKey: string;
    fieldKeys: readonly string[];
    filterPresets: readonly string[];
    itemLimit: Readonly<{ min: number; max: number }>;
  }> | null;
  dataCapabilities: readonly string[];
  actionCapabilities: readonly string[];
  sharing: Readonly<{ presetEligible: boolean }>;
  operations: Readonly<{ freshnessSeconds: number; analyticsKey: string }>;
  privacy: Readonly<{
    classification: WidgetDataClassification;
    retention: 'NONE';
    recipientContextBinding: boolean;
  }>;
}>;

export type WidgetVersion = Readonly<{
  versionId: string;
  definitionId: string;
  semanticVersion: string;
  manifest: Readonly<Record<string, unknown>>;
  manifestHash: string;
  workflowState: WidgetWorkflowState;
  releaseState: WidgetReleaseState;
  safetyState: WidgetSafetyState;
  attestation: Readonly<Record<string, unknown>>;
  certificationStatus: WidgetCertificationStatus;
  predecessorVersionId: string | null;
  replacementVersionId: string | null;
  validationRunId: string | null;
  bindingCatalogRevision: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  allowedTransitions: readonly string[];
}>;

export type WidgetEvidence = Readonly<{
  evidenceId: string;
  versionId: string;
  evidenceType: WidgetEvidenceType;
  status: WidgetEvidenceStatus;
  manifestHash: string;
  evidenceRef: string;
  evidenceSha256: string;
  expiresAt: string | null;
  decisionRevision: number;
  waivedEvidenceId: string | null;
  trackingTicketRef: string | null;
  reviewedBy: string;
  createdAt: string;
}>;

export type WidgetReleaseChannelHead = Readonly<{
  definitionId: string;
  channel: WidgetReleaseChannel;
  currentVersionId: string | null;
  previousVersionId: string | null;
  version: number;
  updatedAt: string;
  allowedTransitions: readonly string[];
}>;

export type WidgetDefinitionRetirementImpact = Readonly<{
  definitionId: string;
  versionId: string | null;
  operation: string;
  activeChannelCount: number;
  tenantPolicyReferenceCount: number;
  instanceReferenceCount: number;
  affectedTenantCount: number;
  operationAllowed: boolean;
  impactRevision: string;
  calculatedAt: string;
}>;

export type WidgetValidation = Readonly<{
  validationRunId: string;
  versionId: string;
  manifestHash: string;
  status: 'PASS' | 'FAIL';
  bindingCatalogRevision: string;
  errors: readonly Readonly<{ code: string; jsonPointer: string }>[];
  validatedAt: string;
}>;

export type WidgetRuntimeControl = Readonly<{
  controlId: string;
  tenantId: number | null;
  providerProductKey: string | null;
  scope: 'CATALOG_MUTATIONS' | 'CATALOG_DISCOVERY' | 'RUNTIME_RENDER' | 'RUNTIME_ACTION';
  targetType: 'GLOBAL' | 'PROVIDER' | 'TENANT' | 'DEFINITION' | 'VERSION';
  targetId: string | null;
  state: 'ENABLED' | 'DISABLED';
  reasonCode: string;
  expiresAt: string | null;
  controlRevision: number;
  version: number;
  createdAt: string;
}>;

export type WidgetAuditEvent = Readonly<{
  eventId: string;
  registryRevision: number;
  tenantId: number | null;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  commandId: string | null;
  actorRef: string | null;
  correlationId: string;
  before: Readonly<Record<string, unknown>> | null;
  after: Readonly<Record<string, unknown>> | null;
  evidenceRefs: readonly string[];
  occurredAt: string;
}>;

export type WidgetRegistryPage<T> = Readonly<{
  items: readonly T[];
  page: number;
  size: number;
  totalElements: number;
  hasNext: boolean;
  readRevision: string;
}>;

export type AudienceSelector = Readonly<{
  schemaVersion: 1;
  mode: 'ALL_ENTITLED' | 'ANY_OF' | 'ALL_OF';
  roleCodes: readonly string[];
  groupRefs: readonly string[];
}>;

export type TenantWidgetPolicyState = 'DRAFT' | 'PUBLISHED' | 'SUPERSEDED' | 'REVOKED';
export type TenantWidgetPolicySelector = 'CHANNEL' | 'PINNED';
export type TenantWidgetSharingPolicy = 'PRIVATE' | 'TENANT' | 'DISABLED';

export type TenantWidgetPolicy = Readonly<{
  definitionId: string;
  currentRevisionId: string;
  current: TenantWidgetPolicyRevision;
  version: number;
  allowedTransitions: readonly string[];
}>;

export type TenantWidgetPolicyRevision = Readonly<{
  policyRevisionId: string;
  tenantId: number;
  definitionId: string;
  revisionNumber: number;
  policyState: TenantWidgetPolicyState;
  enabled: boolean;
  selector: TenantWidgetPolicySelector;
  channel: WidgetReleaseChannel | null;
  versionId: string | null;
  supportedSurfaceKeys: readonly string[];
  audienceSelector: AudienceSelector;
  required: boolean;
  lockedConfiguration: Readonly<Record<string, unknown>>;
  sharingPolicy: TenantWidgetSharingPolicy;
  impactRevision: string | null;
  predecessorRevisionId: string | null;
  createdAt: string;
  version: number;
}>;

export type WidgetPlacementContext =
  'CLASSIC_PERSONAL' | 'FLOW_PERSONAL' | 'FLOW_GOVERNED' | 'MZ_PERSONAL' | 'MZ_GOVERNED';
export type WidgetEffectiveState = 'AVAILABLE' | 'ALREADY_ADDED' | 'DEPRECATED' | 'DENY';
export type WidgetPublicReasonCode =
  | 'NOT_AVAILABLE'
  | 'DISABLED_BY_ORGANIZATION'
  | 'APP_ACCESS_REQUIRED'
  | 'INCOMPATIBLE'
  | 'TEMPORARILY_UNAVAILABLE'
  | 'DEPRECATED'
  | 'AVAILABLE'
  | 'ALREADY_ADDED';

export type EffectiveWidgetCatalogItem = Readonly<{
  definitionId: string;
  definitionKey: string;
  legacyWidgetKey: string | null;
  resolvedVersionId: string | null;
  semanticVersion: string | null;
  effectiveState: WidgetEffectiveState;
  reasonCodes: readonly WidgetPublicReasonCode[];
  placementCapabilities: Readonly<{
    canAdd: boolean;
    canHide: boolean;
    canMove: boolean;
    canResize: boolean;
  }>;
  addedInstanceCount: number;
}>;

export type EffectiveWidgetCatalogContext = Readonly<{
  placementContext: WidgetPlacementContext;
  capabilities: Readonly<{
    libraryRead: boolean;
    legacyPlacementWrite: boolean;
    instanceV6Write: boolean;
    brokerRead: boolean;
    presetCreate: boolean;
    presetShare: boolean;
  }>;
  items: readonly EffectiveWidgetCatalogItem[];
}>;

export type EffectiveWidgetCatalog = Readonly<{
  schemaVersion: 1;
  mode: WidgetRegistryMigrationMode;
  catalogRevision: string;
  bindingCatalogRevision: string;
  policyRevision: string;
  safetyRevision: string;
  hostContext: Readonly<{
    surfaceKey: 'workspace-home';
    resolvedHostMode: 'CLASSIC' | 'FLOW' | 'MZ';
    homeExperienceVersion: number;
    compositionSchemaVersion: number;
    layoutSource: 'HOME_VIEW' | 'LEGACY_PREFERENCE';
    activeViewRef: string | null;
    layoutRevision: number;
    hostConfigurationRevision: string;
    hostCapabilityVersion: number;
    decisionRevision: string;
  }>;
  contexts: readonly EffectiveWidgetCatalogContext[];
}>;

// Wave 3 deliberately reuses the server-owned effective envelope for tenant catalog and
// explain reads. Keeping aliases makes that shared decision contract explicit without
// inventing a second client-side projection that could drift from runtime evaluation.
export type TenantWidgetCatalog = EffectiveWidgetCatalog;
export type TenantWidgetExplain = EffectiveWidgetCatalog;
export type TenantWidgetPolicyImpact = WidgetDefinitionRetirementImpact;

export type WidgetMutationReason = Readonly<{
  expectedVersion: number;
  reasonCode: string;
  reasonText: string;
}>;

export type WidgetCommandHeaders = Readonly<{
  idempotencyKey: string;
  correlationId: string;
}>;

export type WidgetRuntimeEnableApproval = Readonly<{
  approvalId: string;
  controlId: string;
  controlRevision: number;
  state: string;
  evidenceRefs: readonly string[];
  expiresAt: string;
  consumedAt: string | null;
  approvedBy: string;
  createdAt: string;
}>;
