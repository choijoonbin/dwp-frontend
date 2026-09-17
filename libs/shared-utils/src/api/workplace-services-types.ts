export const WORKPLACE_SERVICE_CATEGORIES = [
  'CATERING',
  'AV',
  'ROOM_LAYOUT',
  'IT_SUPPORT',
  'CLEANING',
] as const;
export const WORKPLACE_SERVICE_PROVIDER_STATES = [
  'NOT_CONFIGURED',
  'CONFIGURED_UNVERIFIED',
  'READY',
  'DEGRADED',
  'STALE',
] as const;
export const WORKPLACE_SERVICE_ORDER_STATES = [
  'SUBMITTED',
  'ACCEPTED',
  'IN_PREPARATION',
  'PARTIALLY_FULFILLED',
  'FULFILLED',
  'BLOCKED',
  'DELAYED',
  'CANCELLED',
  'RESULT_UNKNOWN',
] as const;
export const WORKPLACE_SERVICE_WORK_STATES = [
  ...WORKPLACE_SERVICE_ORDER_STATES,
  'NOT_CONFIGURED',
] as const;

export type WorkplaceServiceCategory = (typeof WORKPLACE_SERVICE_CATEGORIES)[number];
export type WorkplaceServiceProviderState = (typeof WORKPLACE_SERVICE_PROVIDER_STATES)[number];
export type WorkplaceServiceOrderState = (typeof WORKPLACE_SERVICE_ORDER_STATES)[number];
export type WorkplaceServiceWorkState = (typeof WORKPLACE_SERVICE_WORK_STATES)[number];
export type WorkplaceServiceReservationAuthority = 'WORKPLACE' | 'CALENDAR';
export type WorkplaceServiceReservationImpact =
  'NONE' | 'RECONFIRMATION_REQUIRED' | 'CANCELLATION_REVIEW';
export type WorkplaceServiceCommandState = 'ACCEPTED' | 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN';
export type WorkplaceServiceRefundScope = 'FULL' | 'PARTIAL' | 'NONE';
export type WorkplaceServiceLineAdjustmentState =
  | 'CANCELLATION_PENDING'
  | 'RECONCILIATION_PENDING'
  | 'CANCELLATION_SUCCEEDED'
  | 'REFUNDED'
  | 'REFUND_NOT_CONFIGURED'
  | 'FAILED'
  | 'RESULT_UNKNOWN';
export type WorkplaceServiceAttachmentScanState =
  'NOT_CONFIGURED' | 'QUARANTINED' | 'CLEAN' | 'INFECTED' | 'ERROR';
export type WorkplaceServiceAttachmentScanVerdict = 'CLEAN' | 'INFECTED' | 'ERROR';
export type WorkplaceServiceCapacityMode = 'UNBOUNDED' | 'BUCKETED';
export type WorkplaceServiceInspectionMode = 'NONE' | 'OPERATOR' | 'REQUESTER';

export type WorkplaceServiceCatalogItem = Readonly<{
  catalogItemId: string;
  serviceCode: string;
  category: WorkplaceServiceCategory;
  nameKo: string;
  nameEn: string;
  descriptionKo: string | null;
  descriptionEn: string | null;
  providerState: WorkplaceServiceProviderState;
  providerCode: string;
  optionSchema: readonly Readonly<Record<string, unknown>>[];
  supportedResourceTypes: readonly string[];
  unitPrice: number;
  currency: string;
  minimumQuantity: number;
  maximumQuantity: number;
  orderCutoffMinutes: number;
  cancellationCutoffMinutes: number;
  slaResponseMinutes: number;
  slaFulfillmentLeadMinutes: number;
  cancellationPolicyKo: string;
  cancellationPolicyEn: string;
  capacityMode: WorkplaceServiceCapacityMode;
  capacityFreshnessSeconds: number;
  inspectionMode: WorkplaceServiceInspectionMode;
  inspectionChecklistSchema: readonly Readonly<Record<string, unknown>>[];
  requiresAttendeeCount: boolean;
  requiresCostCenter: boolean;
  version: number;
}>;

export type WorkplaceServiceCatalog = Readonly<{
  reservationAuthority: WorkplaceServiceReservationAuthority;
  reservationId: string;
  reservationVersion: number;
  reservationStartsAt: string;
  reservationEndsAt: string;
  siteReference: string | null;
  resourceReference: string | null;
  resourceType: string;
  items: readonly WorkplaceServiceCatalogItem[];
  generatedAt: string;
}>;

export type WorkplaceServiceCatalogAdminItem = Readonly<{
  item: WorkplaceServiceCatalogItem;
  siteScope: readonly string[];
  lifecycleState: 'ACTIVE' | 'INACTIVE';
  updatedAt: string;
}>;

export type WorkplaceServiceCatalogAdminItems = Readonly<{
  items: readonly WorkplaceServiceCatalogAdminItem[];
  generatedAt: string;
}>;

export type WorkplaceServiceCatalogCommandResult = Readonly<{
  item: WorkplaceServiceCatalogAdminItem;
  receipt: Readonly<{
    commandId: string;
    catalogItemId: string;
    state: WorkplaceServiceCommandState;
    statusHref: string;
    replayed: boolean;
    correlationId: string;
    acceptedAt: string;
  }>;
}>;

export type WorkplaceServicePreviewLine = Readonly<{
  catalogItemId: string;
  catalogVersion: number | null;
  serviceCode: string;
  category: WorkplaceServiceCategory;
  nameKo: string;
  nameEn: string;
  providerState: WorkplaceServiceProviderState;
  providerCode: string;
  providerConfigurationVersion: number | null;
  siteScope: readonly string[];
  supportedResourceTypes: readonly string[];
  optionSchema: readonly Readonly<Record<string, unknown>>[];
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  orderCutoffMinutes: number | null;
  cancellationCutoffMinutes: number | null;
  slaResponseMinutes: number | null;
  slaFulfillmentLeadMinutes: number | null;
  cancellationPolicyKo: string | null;
  cancellationPolicyEn: string | null;
  capacityMode: WorkplaceServiceCapacityMode | null;
  capacityFreshnessSeconds: number | null;
  inspectionMode: WorkplaceServiceInspectionMode | null;
  inspectionChecklistSchema: readonly Readonly<Record<string, unknown>>[];
  capacityReservation: Readonly<{
    holdIds: readonly string[];
    expiresAt: string;
    capacityFreshUntil: string;
  }> | null;
  quantity: number;
  options: Readonly<Record<string, unknown>>;
  unitPrice: number;
  estimatedCost: number;
  currency: string;
  limitations: readonly string[];
}>;

export type WorkplaceServiceOrderPreview = Readonly<{
  previewId: string;
  reservationAuthority: WorkplaceServiceReservationAuthority;
  reservationId: string;
  reservationVersion: number;
  reservationStartsAt: string;
  reservationEndsAt: string;
  siteReference: string | null;
  resourceReference: string | null;
  attendeeCount: number;
  costCenter: string | null;
  specialRequest: string | null;
  estimatedCost: number;
  currency: string;
  eligible: boolean;
  limitations: readonly string[];
  lines: readonly WorkplaceServicePreviewLine[];
  expiresAt: string;
  createdAt: string;
}>;

export type WorkplaceServiceOrderLine = Readonly<{
  serviceOrderLineId: string;
  catalogItemId: string;
  serviceCode: string;
  category: WorkplaceServiceCategory;
  nameKo: string;
  nameEn: string;
  providerState: WorkplaceServiceProviderState;
  providerCode: string;
  catalogVersion: number;
  providerConfigurationVersion: number;
  siteScope: readonly string[];
  supportedResourceTypes: readonly string[];
  quantity: number;
  options: Readonly<Record<string, unknown>>;
  optionSchema: readonly Readonly<Record<string, unknown>>[];
  unitPrice: number;
  estimatedCost: number;
  currency: string;
  cancellationCutoffMinutes: number;
  cancellationPolicyKo: string;
  cancellationPolicyEn: string;
  slaResponseMinutes: number;
  slaFulfillmentLeadMinutes: number;
  minimumQuantity: number;
  maximumQuantity: number;
  orderCutoffMinutes: number;
  inspectionMode: WorkplaceServiceInspectionMode;
  inspectionChecklistSchema: readonly Readonly<Record<string, unknown>>[];
  state: WorkplaceServiceWorkState;
  fulfilledQuantity: number;
  cancelledQuantity: number;
  refundedAmount: number;
  blockerCode: string | null;
  version: number;
}>;

export type WorkplaceServiceFulfillmentTask = Readonly<{
  fulfillmentTaskId: string;
  serviceOrderLineId: string;
  state: WorkplaceServiceWorkState;
  providerState: WorkplaceServiceProviderState;
  providerCode: string;
  assigneeUserId: number | null;
  assigneeDirectorySubjectId: string | null;
  assigneeDisplayName: string | null;
  assigneeSecondaryLabel: string | null;
  responseDueAt: string;
  dueAt: string;
  providerReceiptAt: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  externalFulfillmentReference: string | null;
  blockerCode: string | null;
  blockerDetail: string | null;
  resultDetail: string | null;
  responseRemainingSeconds: number;
  fulfillmentRemainingSeconds: number;
  responseBreached: boolean;
  fulfillmentBreached: boolean;
  version: number;
  updatedAt: string;
}>;

export type WorkplaceServiceOrderEvent = Readonly<{
  eventId: string;
  eventType: string;
  actorUserId?: number;
  detail: Readonly<Record<string, unknown>>;
  occurredAt: string;
}>;

export type WorkplaceServiceOrderMessage = Readonly<{
  messageId: string;
  authorUserId?: number;
  authorDisplayName: string | null;
  authorRole: 'REQUESTER' | 'OPERATOR';
  message: string;
  createdAt: string;
}>;

export type WorkplaceServiceOrderAttachment = Readonly<{
  attachmentId: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  scanState: WorkplaceServiceAttachmentScanState;
  scanVersion: number;
  scannerEvidenceReference: string | null;
  scanDetail: string | null;
  scannedAt: string | null;
  createdAt: string;
}>;

export type WorkplaceServiceOrder = Readonly<{
  serviceOrderId: string;
  requesterUserId: number;
  reservationAuthority: WorkplaceServiceReservationAuthority;
  reservationId: string;
  reservationVersion: number;
  currentReservationVersion: number | null;
  reservationStartsAt: string;
  reservationEndsAt: string;
  siteReference: string | null;
  resourceReference: string | null;
  attendeeCount: number;
  costCenter: string | null;
  estimatedCost: number;
  currency: string;
  specialRequest: string | null;
  state: WorkplaceServiceOrderState;
  reservationImpact: WorkplaceServiceReservationImpact;
  reconfirmationRequired: boolean;
  providerOperationReference: string | null;
  resultDetail: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
  lines: readonly WorkplaceServiceOrderLine[];
  tasks: readonly WorkplaceServiceFulfillmentTask[];
  eventCount: number;
  messageCount: number;
  attachmentCount: number;
}>;

export type WorkplaceServiceOrders = Readonly<{
  items: readonly WorkplaceServiceOrder[];
  nextCursor: string | null;
  hasMore: boolean;
  generatedAt: string;
}>;

export type WorkplaceServiceOrderEventsPage = Readonly<{
  items: readonly WorkplaceServiceOrderEvent[];
  nextCursor: string | null;
  hasMore: boolean;
  generatedAt: string;
}>;

export type WorkplaceServiceOrderMessagesPage = Readonly<{
  items: readonly WorkplaceServiceOrderMessage[];
  nextCursor: string | null;
  hasMore: boolean;
  generatedAt: string;
}>;

export type WorkplaceServiceOrderAttachmentsPage = Readonly<{
  items: readonly WorkplaceServiceOrderAttachment[];
  nextCursor: string | null;
  hasMore: boolean;
  generatedAt: string;
}>;

export type WorkplaceServiceLineCancellationImpact = Readonly<{
  cancellationPreviewId: string;
  serviceOrderId: string;
  serviceOrderLineId: string;
  orderVersion: number;
  lineVersion: number;
  cancelQuantity: number;
  fulfilledQuantity: number;
  previouslyCancelledQuantity: number;
  remainingQuantity: number;
  refundScope: WorkplaceServiceRefundScope;
  refundableAmount: number;
  currency: string;
  eligible: boolean;
  reason: string;
  expiresAt: string;
  generatedAt: string;
}>;

export type WorkplaceServiceLineAdjustment = Readonly<{
  lineAdjustmentId: string;
  serviceOrderId: string;
  serviceOrderLineId: string;
  cancellationPreviewId: string;
  cancelQuantity: number;
  refundScope: WorkplaceServiceRefundScope;
  refundableAmount: number;
  refundedAmount: number;
  currency: string;
  state: WorkplaceServiceLineAdjustmentState;
  providerOperationReference: string | null;
  refundReceiptReference: string | null;
  resultDetail: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type WorkplaceServiceCommandResult = Readonly<{
  order: WorkplaceServiceOrder;
  receipt: Readonly<{
    commandId: string;
    serviceOrderId: string;
    state: WorkplaceServiceCommandState;
    statusHref: string;
    replayed: boolean;
    correlationId: string;
    acceptedAt: string;
  }>;
}>;

export type WorkplaceServiceLineAdjustmentCommandResult = Readonly<{
  adjustment: WorkplaceServiceLineAdjustment;
  order: WorkplaceServiceOrder;
  receipt: WorkplaceServiceCommandResult['receipt'];
}>;

export type WorkplaceServiceAttachmentScanCommandResult = Readonly<{
  attachment: WorkplaceServiceOrderAttachment;
  receipt: WorkplaceServiceCommandResult['receipt'];
}>;
