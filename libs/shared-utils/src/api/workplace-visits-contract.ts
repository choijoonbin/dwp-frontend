export const WORKPLACE_VISIT_STATES = [
  'DRAFT',
  'PREVIEWED',
  'INVITED',
  'APPROVAL_PENDING',
  'APPROVED',
  'ACCESS_PENDING',
  'READY',
  'ARRIVED',
  'CHECKED_OUT',
  'REJECTED',
  'CANCELLED',
  'ACCESS_FAILED',
  'OVERSTAY',
  'RESULT_UNKNOWN',
] as const;

export const WORKPLACE_VISIT_PROVIDER_STATES = [
  'NOT_CONFIGURED',
  'CONFIGURED_UNVERIFIED',
  'READY',
  'DEGRADED',
  'STALE',
] as const;

export const WORKPLACE_KIOSK_STATES = [
  'READY',
  'OFFLINE',
  'UNREGISTERED',
  'WRONG_SITE',
  'PRIVACY_NOTICE_REQUIRED',
  'PROVIDER_UNAVAILABLE',
  'HELP_REQUESTED',
  'RETIRED',
] as const;

export const WORKPLACE_VISIT_EXCEPTION_KINDS = [
  'APPROVAL_PENDING',
  'ACCESS_FAILED',
  'HOST_UNRESPONSIVE',
  'OVERSTAY',
  'RESULT_UNKNOWN',
] as const;

export type WorkplaceVisitState = (typeof WORKPLACE_VISIT_STATES)[number];
export type WorkplaceVisitProviderState = (typeof WORKPLACE_VISIT_PROVIDER_STATES)[number];
export type WorkplaceKioskState = (typeof WORKPLACE_KIOSK_STATES)[number];
export type WorkplaceVisitExceptionKind = (typeof WORKPLACE_VISIT_EXCEPTION_KINDS)[number];
export type WorkplaceVisitReservationAuthority = 'WORKPLACE' | 'CALENDAR';
export type WorkplaceVisitProviderKind = 'VISITOR' | 'ACCESS';
export type WorkplaceVisitCommandState = 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN';

export type WorkplaceVisitReservationReference = Readonly<{
  authority: WorkplaceVisitReservationAuthority;
  id: string;
  version: number;
}>;

export type WorkplaceVisitGuestRefInput = Readonly<{
  opaqueRef: string;
  maskedLabel: string;
  purpose: string;
  fieldRetentionExpiresAt: Readonly<Record<string, string>>;
}>;

export type WorkplaceVisitGuestRef = WorkplaceVisitGuestRefInput;

export type WorkplaceVisitProviderTruth = Readonly<{
  kind: WorkplaceVisitProviderKind;
  state: WorkplaceVisitProviderState;
  configurationVersion: number;
  observedConfigurationVersion: number | null;
  evidenceReference: string | null;
  lastSuccessAt: string | null;
  sourceAt: string | null;
  receivedAt: string | null;
  limitationCode: string | null;
  manualOwner: string | null;
  manualProcedure: string | null;
}>;

export type WorkplaceVisitPreviewInput = Readonly<{
  reservation: WorkplaceVisitReservationReference;
  visitType: string;
  siteId: string;
  startsAt: string;
  endsAt: string;
  zoneIds: readonly string[];
  guests: readonly WorkplaceVisitGuestRefInput[];
  reason: string;
  explicitConfirmation: boolean;
}>;

export type WorkplaceVisitPreview = Readonly<{
  previewId: string;
  version: number;
  reservation: WorkplaceVisitReservationReference;
  visitType: string;
  siteId: string;
  startsAt: string;
  endsAt: string;
  zoneIds: readonly string[];
  guestCount: number;
  approvalRequired: boolean;
  ndaRequired: boolean;
  identityVerificationRequired: boolean;
  minimumCollectionFields: readonly string[];
  visitorProvider: WorkplaceVisitProviderTruth;
  accessProvider: WorkplaceVisitProviderTruth;
  eligible: boolean;
  limitations: readonly string[];
  expiresAt: string;
  generatedAt: string;
}>;

export type WorkplaceVisitCreateInput = Readonly<{
  previewId: string;
  expectedPreviewVersion: number;
  guests: readonly WorkplaceVisitGuestRefInput[];
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceVisitVersionInput = Readonly<{
  expectedVersion: number;
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceVisitApprovalInput = WorkplaceVisitVersionInput &
  Readonly<{ approved: boolean }>;

export type WorkplaceVisitTimelineItem = Readonly<{
  eventId: string;
  eventType: string;
  state: WorkplaceVisitState;
  detailCode: string | null;
  occurredAt: string;
}>;

export type WorkplaceRequesterVisit = Readonly<{
  visitId: string;
  reservation: WorkplaceVisitReservationReference;
  visitType: string;
  siteId: string;
  startsAt: string;
  endsAt: string;
  zoneIds: readonly string[];
  guests: readonly WorkplaceVisitGuestRef[];
  state: WorkplaceVisitState;
  version: number;
  recoveryByGetOnly: boolean;
  recoveryHref: string | null;
  timeline: readonly WorkplaceVisitTimelineItem[];
  updatedAt: string;
}>;

export type WorkplaceAdminVisit = Readonly<{
  visitId: string;
  requesterUserId: number;
  reservation: WorkplaceVisitReservationReference;
  visitType: string;
  siteId: string;
  startsAt: string;
  endsAt: string;
  zoneIds: readonly string[];
  guests: readonly WorkplaceVisitGuestRef[];
  state: WorkplaceVisitState;
  version: number;
  providerOperationEvidenceReference: string | null;
  limitationCode: string | null;
  timeline: readonly WorkplaceVisitTimelineItem[];
  updatedAt: string;
}>;

export type WorkplaceKioskVisit = Readonly<{
  visitId: string;
  maskedLabel: string;
  purpose: string;
  siteId: string;
  startsAt: string;
  endsAt: string;
  state: WorkplaceVisitState;
  version: number;
}>;

export type WorkplaceVisitPage<T> = Readonly<{
  items: readonly T[];
  generatedAt: string;
}>;

export type WorkplaceVisitCommandReceipt = Readonly<{
  commandId: string;
  visitId: string;
  state: WorkplaceVisitCommandState;
  statusHref: string;
  replayed: boolean;
  correlationId: string;
  acceptedAt: string;
}>;

export type WorkplaceVisitCommandResult<T> = Readonly<{
  visit: T;
  receipt: WorkplaceVisitCommandReceipt;
}>;

export type WorkplaceVisitException = Readonly<{
  visitId: string;
  kind: WorkplaceVisitExceptionKind;
  state: WorkplaceVisitState;
  maskedGuestLabel: string;
  siteId: string;
  startsAt: string;
  version: number;
  limitationCode: string | null;
  updatedAt: string;
}>;

export type WorkplaceVisitPolicy = Readonly<{
  policyId: string;
  visitType: string;
  approvalRequired: boolean;
  ndaRequired: boolean;
  identityVerificationRequired: boolean;
  allowedFrom: string;
  allowedUntil: string;
  minimumCollectionFields: readonly string[];
  retentionDays: number;
  active: boolean;
  version: number;
  updatedAt: string;
}>;

export type WorkplaceVisitPolicyInput = Readonly<{
  visitType: string;
  approvalRequired: boolean;
  ndaRequired: boolean;
  identityVerificationRequired: boolean;
  allowedFrom: string;
  allowedUntil: string;
  minimumCollectionFields: readonly string[];
  retentionDays: number;
  expectedVersion: number;
  active: boolean;
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceVisitPolicyImpact = Readonly<{
  policyId: string;
  currentVersion: number;
  affectedFutureVisits: number;
  warnings: readonly string[];
  generatedAt: string;
}>;

export type WorkplaceVisitAccessZone = Readonly<{
  zoneId: string;
  siteId: string;
  zoneCode: string;
  name: string;
  accessLevel: string;
  providerMappingReference: string;
  allowedVisitTypes: readonly string[];
  active: boolean;
  version: number;
  updatedAt: string;
}>;

export type WorkplaceVisitAccessZoneInput = Readonly<{
  siteId: string;
  zoneCode: string;
  name: string;
  accessLevel: string;
  providerMappingReference: string;
  allowedVisitTypes: readonly string[];
  expectedVersion: number;
  active: boolean;
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceVisitProviderBinding = Readonly<{
  bindingId: string;
  kind: WorkplaceVisitProviderKind;
  providerCode: string;
  configurationVersion: number;
  observedConfigurationVersion: number | null;
  state: WorkplaceVisitProviderState;
  evidenceReference: string | null;
  lastSuccessAt: string | null;
  sourceAt: string | null;
  receivedAt: string | null;
  manualOwner: string;
  manualProcedure: string;
  active: boolean;
  version: number;
  updatedAt: string;
}>;

export type WorkplaceVisitProviderBindingInput = Readonly<{
  kind: WorkplaceVisitProviderKind;
  providerCode: string;
  configurationVersion: number;
  manualOwner: string;
  manualProcedure: string;
  expectedVersion: number;
  active: boolean;
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceVisitProviderEvidenceInput = Readonly<{
  expectedVersion: number;
  observedConfigurationVersion: number;
  reportedState: WorkplaceVisitProviderState;
  evidenceReference: string;
  sourceAt: string;
  receivedAt: string;
  lastSuccessAt: string | null;
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceKioskDevice = Readonly<{
  deviceId: string;
  siteId: string;
  policyId: string | null;
  privacyNoticeVersion: string;
  privacyNoticeAccepted: boolean;
  lastHeartbeatAt: string | null;
  helpRequested: boolean;
  state: WorkplaceKioskState;
  active: boolean;
  version: number;
  updatedAt: string;
}>;

export type WorkplaceKioskDeviceInput = Readonly<{
  deviceIdentitySha256: string;
  siteId: string;
  policyId: string | null;
  privacyNoticeVersion: string;
  expectedVersion: number;
  active: boolean;
  reason: string;
  explicitConfirmation: true;
}>;

export type WorkplaceKioskHeartbeatInput = Readonly<{
  expectedVersion: number;
  privacyNoticeVersion: string;
  privacyNoticeAccepted: boolean;
  observedAt: string;
}>;

export type WorkplaceKioskSession = Readonly<{
  deviceId: string | null;
  siteId: string | null;
  state: WorkplaceKioskState;
  privacyNoticeVersion: string | null;
  privacyNoticeAccepted: boolean;
  helpRequested: boolean;
  lastHeartbeatAt: string | null;
  active: boolean;
  version: number;
  updatedAt: string;
}>;

export type WorkplaceKioskCommandVisit = Readonly<{
  visitId: string;
  state: WorkplaceVisitState;
  version: number;
  recoveryByGetOnly: boolean;
  recoveryHref: string | null;
  updatedAt: string;
}>;

export type WorkplaceKioskVisitCommandResult = Readonly<{
  visit: WorkplaceKioskCommandVisit;
  receipt: WorkplaceVisitCommandReceipt;
}>;

export type WorkplaceVisitManagementReceipt = Readonly<{
  commandId: string;
  resourceType: string;
  resourceId: string;
  resourceVersion: number;
  replayed: boolean;
  correlationId: string;
  acceptedAt: string;
}>;

export type WorkplaceVisitManagementResult<T> = Readonly<{
  item: T;
  receipt: WorkplaceVisitManagementReceipt;
}>;
