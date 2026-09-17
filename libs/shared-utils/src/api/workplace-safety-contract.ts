export const WORKPLACE_SAFETY_SEVERITIES = ['ADVISORY', 'URGENT', 'CRITICAL'] as const;
export const WORKPLACE_SAFETY_INCIDENT_STATES = [
  'ACTIVE',
  'CLOSURE_PENDING',
  'CLOSED',
  'CANCELLED',
] as const;
export const WORKPLACE_SAFETY_SOURCE_KINDS = [
  'RESERVATION',
  'ACTUAL_PRESENCE',
  'VISITOR',
  'SCHEDULED_VISITOR',
] as const;
export const WORKPLACE_SAFETY_FRESHNESS_STATES = ['FRESH', 'STALE', 'UNKNOWN'] as const;
export const WORKPLACE_SAFETY_AVAILABILITY_STATES = [
  'AVAILABLE',
  'PARTIAL',
  'UNAVAILABLE',
] as const;
export const WORKPLACE_SAFETY_DELIVERY_CHANNELS = [
  'APP_PUSH',
  'SMS',
  'EMAIL',
  'EBS',
  'BLE_MESH',
] as const;
export const WORKPLACE_SAFETY_DISPATCH_STATES = [
  'ACCEPTED',
  'DISPATCHING',
  'PARTIAL',
  'SUCCEEDED',
  'FAILED',
  'RESULT_UNKNOWN',
] as const;
export const WORKPLACE_SAFETY_ATTEMPT_STATES = [
  'QUEUED',
  'DISPATCHING',
  'DELIVERED',
  'DELIVERY_FAILED',
  'OFFLINE_QUEUED',
  'RESULT_UNKNOWN',
] as const;
export const WORKPLACE_SAFETY_RESPONSE_STATES = ['SAFE', 'NEEDS_HELP'] as const;
export const WORKPLACE_SAFETY_MESSAGE_DIRECTIONS = [
  'USER_TO_COMMAND',
  'COMMAND_TO_USER',
  'COMMAND_BROADCAST',
] as const;
export const WORKPLACE_SAFETY_COMMAND_STATES = [
  'ACCEPTED',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'RESULT_UNKNOWN',
] as const;
export const WORKPLACE_SAFETY_CONNECTOR_KINDS = [
  'EMERGENCY_119',
  'EBS',
  'BLE_MESH',
  'WORM',
  'GOVERNMENT_LOG',
] as const;
export const WORKPLACE_SAFETY_CONNECTOR_STATES = [
  'NOT_CONFIGURED',
  'CONFIGURED_UNVERIFIED',
  'READY',
  'DEGRADED',
  'STALE',
] as const;

export type WorkplaceSafetySeverity = (typeof WORKPLACE_SAFETY_SEVERITIES)[number];
export type WorkplaceSafetyIncidentState = (typeof WORKPLACE_SAFETY_INCIDENT_STATES)[number];
export type WorkplaceSafetySourceKind = (typeof WORKPLACE_SAFETY_SOURCE_KINDS)[number];
export type WorkplaceSafetyFreshnessState = (typeof WORKPLACE_SAFETY_FRESHNESS_STATES)[number];
export type WorkplaceSafetyAvailabilityState =
  (typeof WORKPLACE_SAFETY_AVAILABILITY_STATES)[number];
export type WorkplaceSafetyDeliveryChannel = (typeof WORKPLACE_SAFETY_DELIVERY_CHANNELS)[number];
export type WorkplaceSafetyDispatchState = (typeof WORKPLACE_SAFETY_DISPATCH_STATES)[number];
export type WorkplaceSafetyAttemptState = (typeof WORKPLACE_SAFETY_ATTEMPT_STATES)[number];
export type WorkplaceSafetyResponseState = (typeof WORKPLACE_SAFETY_RESPONSE_STATES)[number];
export type WorkplaceSafetyMessageDirection = (typeof WORKPLACE_SAFETY_MESSAGE_DIRECTIONS)[number];
export type WorkplaceSafetyCommandState = (typeof WORKPLACE_SAFETY_COMMAND_STATES)[number];
export type WorkplaceSafetyConnectorKind = (typeof WORKPLACE_SAFETY_CONNECTOR_KINDS)[number];
export type WorkplaceSafetyConnectorState = (typeof WORKPLACE_SAFETY_CONNECTOR_STATES)[number];
export type WorkplaceSafetyExportFormat = 'PDF' | 'CSV';

export type WorkplaceSafetySourceSummary = Readonly<{
  source: WorkplaceSafetySourceKind;
  candidateCount: number;
  includedCount: number;
  excludedCount: number;
  unknownCount: number;
  coveragePercent: number | null;
  freshness: WorkplaceSafetyFreshnessState;
  availability: WorkplaceSafetyAvailabilityState;
  sourceAt: string | null;
  receivedAt: string | null;
}>;

export type WorkplaceSafetyAudienceMember = Readonly<{
  audienceMemberId: string;
  subjectKeySha256: string;
  subjectUserId: number | null;
  maskedLabel: string;
  sources: readonly WorkplaceSafetySourceKind[];
  included: boolean;
  exclusionCode: string | null;
  unknownIdentity: boolean;
}>;

export type WorkplaceSafetyAudienceSnapshot = Readonly<{
  audienceSnapshotId: string;
  totalCandidates: number;
  deduplicatedCount: number;
  excludedCount: number;
  unknownCount: number;
  finalTargetCount: number;
  sources: readonly WorkplaceSafetySourceSummary[];
  members: readonly WorkplaceSafetyAudienceMember[];
  asOf: string;
}>;

export type WorkplaceSafetyConnectorTruth = Readonly<{
  kind: WorkplaceSafetyConnectorKind;
  providerCode: string | null;
  state: WorkplaceSafetyConnectorState;
  configurationVersion: number;
  observedConfigurationVersion: number | null;
  evidenceReference: string | null;
  sourceAt: string | null;
  receivedAt: string | null;
  lastSuccessAt: string | null;
  errorCode: string | null;
  version: number;
  evaluatedAt: string;
}>;

export type WorkplaceSafetyDispatchSummary = Readonly<{
  dispatchBatchId: string;
  state: WorkplaceSafetyDispatchState;
  attemptCount: number;
  deliveredCount: number;
  failedCount: number;
  unknownCount: number;
  channels: readonly WorkplaceSafetyDeliveryChannel[];
  updatedAt: string;
}>;

export type WorkplaceSafetyIncident = Readonly<{
  incidentId: string;
  incidentNumber: string;
  incidentType: string;
  severity: WorkplaceSafetySeverity;
  state: WorkplaceSafetyIncidentState;
  siteId: string;
  floorIds: readonly string[];
  zoneIds: readonly string[];
  message: string;
  safetyAction: string;
  assemblyPoint: string | null;
  channels: readonly WorkplaceSafetyDeliveryChannel[];
  audience: WorkplaceSafetyAudienceSnapshot;
  responses: Readonly<{ safe: number; needsHelp: number; noResponse: number }>;
  assembly: Readonly<{ confirmed: number; pending: number }>;
  dispatches: readonly WorkplaceSafetyDispatchSummary[];
  connectorTruth: readonly WorkplaceSafetyConnectorTruth[];
  version: number;
  activatedAt: string;
  closedAt: string | null;
  updatedAt: string;
}>;

export type WorkplaceSafetySheet = Readonly<{
  incidentId: string;
  incidentNumber: string;
  severity: WorkplaceSafetySeverity;
  message: string;
  safetyAction: string;
  assemblyPoint: string | null;
  scopeLabels: readonly string[];
  currentResponse: WorkplaceSafetyResponseState | null;
  accessibleAlternativeContact: string;
  version: number;
  asOf: string;
}>;

export type WorkplaceSafetyIncidentMessage = Readonly<{
  messageId: string;
  incidentId: string;
  targetUserId: number | null;
  direction: WorkplaceSafetyMessageDirection;
  maskedBody: string;
  createdAt: string;
}>;

export type WorkplaceSafetyCommandReceipt = Readonly<{
  commandId: string;
  state: WorkplaceSafetyCommandState;
  statusHref: string;
  idempotentReplay: boolean;
  correlationId: string;
  acceptedAt: string;
}>;

export type WorkplaceSafetyActivationPreview = Readonly<{
  activationPreviewId: string;
  incidentType: string;
  severity: WorkplaceSafetySeverity;
  siteId: string;
  floorIds: readonly string[];
  zoneIds: readonly string[];
  message: string;
  safetyAction: string;
  assemblyPoint: string | null;
  channels: readonly WorkplaceSafetyDeliveryChannel[];
  audience: WorkplaceSafetyAudienceSnapshot;
  connectorTruth: readonly WorkplaceSafetyConnectorTruth[];
  eligible: boolean;
  limitations: readonly string[];
  expiresAt: string;
  createdAt: string;
}>;

export type WorkplaceSafetyScopeRevisionPreview = Readonly<{
  scopeRevisionId: string;
  incidentId: string;
  incidentVersion: number;
  previousFloorIds: readonly string[];
  previousZoneIds: readonly string[];
  proposedFloorIds: readonly string[];
  proposedZoneIds: readonly string[];
  proposedMessage: string;
  audience: WorkplaceSafetyAudienceSnapshot;
  newlyIncluded: number;
  noLongerIncluded: number;
  expiresAt: string;
  createdAt: string;
}>;

export type WorkplaceSafetyClosurePreview = Readonly<{
  closurePreviewId: string;
  incidentId: string;
  incidentVersion: number;
  needsHelpCount: number;
  noResponseCount: number;
  deliveredCount: number;
  failedOrUnknownCount: number;
  eligible: boolean;
  warnings: readonly string[];
  expiresAt: string;
  createdAt: string;
}>;

export type WorkplaceSafetyClosureRequest = Readonly<{
  closureRequestId: string;
  incidentId: string;
  requestedBy: number;
  designatedApproverId: number;
  closureReason: string;
  followUpActions: string;
  state: string;
  version: number;
  requestedAt: string;
}>;

export type WorkplaceSafetyPostIncidentReport = Readonly<{
  reportId: string;
  incidentId: string;
  summary: Readonly<Record<string, unknown>>;
  version: number;
  generatedAt: string;
}>;

export type WorkplaceSafetyGuardedExport = Readonly<{
  exportId: string;
  incidentId: string;
  format: WorkplaceSafetyExportFormat;
  purpose: string;
  reason: string;
  requestedBy: number;
  correlationId: string;
  stepUpEvidence: string;
  contentType: string;
  sha256: string;
  sizeBytes: number;
  downloadHref: string;
  createdAt: string;
  expiresAt: string;
}>;

export type WorkplaceSafetyIncidentCommandResult = Readonly<{
  incident: WorkplaceSafetyIncident;
  receipt: WorkplaceSafetyCommandReceipt;
}>;
export type WorkplaceSafetyActivationPreviewCommandResult = Readonly<{
  preview: WorkplaceSafetyActivationPreview;
  receipt: WorkplaceSafetyCommandReceipt;
}>;
export type WorkplaceSafetyScopePreviewCommandResult = Readonly<{
  preview: WorkplaceSafetyScopeRevisionPreview;
  receipt: WorkplaceSafetyCommandReceipt;
}>;
export type WorkplaceSafetyClosurePreviewCommandResult = Readonly<{
  preview: WorkplaceSafetyClosurePreview;
  receipt: WorkplaceSafetyCommandReceipt;
}>;
export type WorkplaceSafetyResponseCommandResult = Readonly<{
  sheet: WorkplaceSafetySheet;
  receipt: WorkplaceSafetyCommandReceipt;
}>;
export type WorkplaceSafetyMessageCommandResult = Readonly<{
  message: WorkplaceSafetyIncidentMessage;
  receipt: WorkplaceSafetyCommandReceipt;
}>;
export type WorkplaceSafetyClosureCommandResult = Readonly<{
  closure: WorkplaceSafetyClosureRequest;
  receipt: WorkplaceSafetyCommandReceipt;
}>;
export type WorkplaceSafetyExportCommandResult = Readonly<{
  export: WorkplaceSafetyGuardedExport;
  receipt: WorkplaceSafetyCommandReceipt;
}>;
export type WorkplaceSafetyAssemblyConfirmation = Readonly<{
  assemblyConfirmationId: string;
  incidentId: string;
  subjectKeySha256: string;
  subjectUserId: number | null;
  confirmed: boolean;
  observedAt: string;
  confirmedBy: number;
  evidenceReference: string;
  version: number;
  updatedAt: string;
}>;
export type WorkplaceSafetyAssemblyCommandResult = Readonly<{
  confirmation: WorkplaceSafetyAssemblyConfirmation;
  receipt: WorkplaceSafetyCommandReceipt;
}>;
export type WorkplaceSafetyConnectorCommandResult = Readonly<{
  connector: WorkplaceSafetyConnectorTruth;
  receipt: WorkplaceSafetyCommandReceipt;
}>;

export type WorkplaceSafetyActivationPreviewInput = Readonly<{
  incidentType: string;
  severity: WorkplaceSafetySeverity;
  siteId: string;
  floorIds: readonly string[];
  zoneIds: readonly string[];
  message: string;
  safetyAction: string;
  assemblyPoint: string | null;
  channels: readonly WorkplaceSafetyDeliveryChannel[];
  excludedSubjectKeys: readonly string[];
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplaceSafetyActivateInput = Readonly<{
  activationPreviewId: string;
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplaceSafetyResponseInput = Readonly<{
  expectedIncidentVersion: number;
  response: WorkplaceSafetyResponseState;
  assistanceNote: string | null;
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplaceSafetyMessageInput = Readonly<{
  expectedIncidentVersion: number;
  targetUserId: number | null;
  body: string;
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplaceSafetyScopePreviewInput = Readonly<{
  expectedIncidentVersion: number;
  floorIds: readonly string[];
  zoneIds: readonly string[];
  message: string;
  excludedSubjectKeys: readonly string[];
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplaceSafetyApplyScopeInput = Readonly<{
  scopeRevisionId: string;
  expectedIncidentVersion: number;
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplaceSafetyResendInput = Readonly<{
  expectedIncidentVersion: number;
  channels: readonly WorkplaceSafetyDeliveryChannel[];
  retryStates: readonly WorkplaceSafetyAttemptState[];
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplaceSafetyAssemblyConfirmationInput = Readonly<{
  expectedIncidentVersion: number;
  subjectKeySha256: string;
  subjectUserId: number | null;
  confirmed: boolean;
  observedAt: string;
  evidenceReference: string;
  expectedAssemblyVersion: number;
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplaceSafetyClosurePreviewInput = Readonly<{
  expectedIncidentVersion: number;
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplaceSafetyClosureRequestInput = Readonly<{
  closurePreviewId: string;
  expectedIncidentVersion: number;
  designatedApproverId: number;
  closureReason: string;
  followUpActions: string;
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplaceSafetyClosureApprovalInput = Readonly<{
  expectedIncidentVersion: number;
  expectedClosureVersion: number;
  approved: boolean;
  approvalReason: string;
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplaceSafetyExportInput = Readonly<{
  expectedIncidentVersion: number;
  format: WorkplaceSafetyExportFormat;
  purpose: string;
  reason: string;
  explicitConfirmation: true;
}>;
export type WorkplaceSafetyConnectorConfigurationInput = Readonly<{
  kind: WorkplaceSafetyConnectorKind;
  providerCode: string;
  configurationVersion: number;
  expectedVersion: number;
  configured: boolean;
  reason: string;
  explicitConfirmation: true;
}>;
