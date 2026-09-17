import { axiosInstance } from '../axios-instance';

import type { ApiResponse } from '../types';
import type { WorkplaceResourceType } from './workplace-api';

const ROOT = '/api/platform/v1/workplace';
const id = encodeURIComponent;

export type WorkplaceBookingIntentState =
  'PREVIEWED' | 'HELD' | 'CONFIRMING' | 'COMPLETED' | 'EXPIRED';
export type WorkplaceBookingIntentItemDecision =
  'AVAILABLE' | 'ALTERNATIVES_AVAILABLE' | 'UNAVAILABLE' | 'POLICY_DENIED';
export type WorkplaceReservationHoldState =
  'ACTIVE' | 'BATCHED' | 'CONSUMED' | 'RELEASED' | 'EXPIRED';
export type WorkplaceBookingFailurePolicy = 'KEEP_SUCCEEDED' | 'COMPENSATE_ALL';
export type WorkplaceBookingAuthority = 'WORKPLACE' | 'CALENDAR';
export type WorkplaceBookingBatchState =
  | 'ACCEPTED'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'PARTIAL'
  | 'FAILED'
  | 'COMPENSATING'
  | 'COMPENSATED'
  | 'RESULT_UNKNOWN';
export type WorkplaceBookingBatchItemState =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'RESULT_UNKNOWN'
  | 'COMPENSATION_PENDING'
  | 'COMPENSATED'
  | 'COMPENSATION_FAILED';
export type WorkplaceWaitlistState =
  'ACTIVE' | 'OFFERED' | 'CONFIRMING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';
export type WorkplaceAlternativeOfferState =
  'OFFERED' | 'ACCEPTING' | 'ACCEPTED' | 'EXPIRED' | 'WITHDRAWN' | 'RESULT_UNKNOWN';
export type WorkplaceWaitlistNotificationChannel = 'IN_APP' | 'EMAIL' | 'PUSH';

export type WorkplaceBookingIntentItemInput = Readonly<{
  clientItemKey: string;
  beneficiaryUserId: number;
  beneficiaryPersonPublicId: string | null;
  beneficiaryDisplayName: string;
  delegationGrantId: string | null;
  resourceType: WorkplaceResourceType;
  preferredResourceId: string | null;
  siteId: string | null;
  floorId: string | null;
  startsAt: string;
  endsAt: string;
  purpose: string;
  visibleToColleagues: boolean;
  accessibleOnly: boolean;
  requiredFeatures: readonly string[];
}>;

export type WorkplaceBookingIntentPreviewInput = Readonly<{
  items: readonly WorkplaceBookingIntentItemInput[];
  requestedHoldTtlSeconds: number;
  allowAlternatives: boolean;
  teamPlacementConstraints: readonly WorkplaceTeamPlacementConstraint[];
  reason: string;
}>;

export type WorkplaceTeamPlacementConstraint = Readonly<{
  groupKey: string;
  clientItemKeys: readonly string[];
  sameNeighborhood: boolean;
  adjacentSeats: boolean;
  minimumDistanceMeters: number | null;
  maximumDistanceMeters: number | null;
}>;

export type WorkplaceConstraintEvaluationState = 'SATISFIED' | 'UNSATISFIED' | 'UNSUPPORTED';

export type WorkplaceTeamPlacementConstraintEvidence = Readonly<{
  groupKey: string;
  clientItemKeys: readonly string[];
  state: WorkplaceConstraintEvaluationState;
  code: string;
  message: string;
  selectedResourceIds: readonly string[];
}>;

export type WorkplaceBookingCandidate = Readonly<{
  resourceId: string;
  calendarResourceId: string | null;
  name: string;
  resourceType: WorkplaceResourceType;
  siteId: string;
  floorId: string;
  neighborhood: string | null;
  timeZone: string;
  accessible: boolean;
  features: readonly string[];
  preferred: boolean;
  resourceVersion: number;
}>;

export type WorkplaceBookingIntentItemPreview = Readonly<{
  intentItemId: string;
  clientItemKey: string;
  actorUserId: number;
  beneficiaryUserId: number;
  beneficiaryPersonPublicId: string | null;
  beneficiaryDisplayName: string;
  delegationGrantId: string | null;
  resourceType: WorkplaceResourceType;
  startsAt: string;
  endsAt: string;
  decision: WorkplaceBookingIntentItemDecision;
  decisionCode: string;
  candidates: readonly WorkplaceBookingCandidate[];
  version: number;
}>;

export type WorkplaceBookingIntentPreview = Readonly<{
  intentId: string;
  state: WorkplaceBookingIntentState;
  actorUserId: number;
  requestedHoldTtlSeconds: number;
  allowAlternatives: boolean;
  reason: string;
  items: readonly WorkplaceBookingIntentItemPreview[];
  teamPlacementConstraints: readonly WorkplaceTeamPlacementConstraint[];
  placementConstraintEvidence: readonly WorkplaceTeamPlacementConstraintEvidence[];
  version: number;
  createdAt: string;
}>;

export type WorkplaceAuthorizedBookingBeneficiary = Readonly<{
  beneficiaryUserId: number;
  beneficiaryPersonPublicId: string | null;
  displayName: string;
  delegationGrantId: string | null;
  resourceTypes: readonly WorkplaceResourceType[];
  validUntil: string | null;
  self: boolean;
}>;

export type WorkplaceAuthorizedBookingBeneficiaries = Readonly<{
  beneficiaries: readonly WorkplaceAuthorizedBookingBeneficiary[];
  generatedAt: string;
}>;

export type WorkplaceBookingHoldInput = Readonly<{
  expectedIntentVersion: number;
  selections: readonly Readonly<{
    intentItemId: string;
    resourceId: string;
    expectedItemVersion: number;
    expectedResourceVersion: number;
  }>[];
  reason: string;
  explicitConfirmation: boolean;
}>;

export type WorkplaceReservationHold = Readonly<{
  holdId: string;
  intentItemId: string;
  resourceId: string;
  state: WorkplaceReservationHoldState;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  version: number;
}>;

export type WorkplaceBookingHoldResponse = Readonly<{
  intentId: string;
  intentState: WorkplaceBookingIntentState;
  intentVersion: number;
  serverTime: string;
  holds: readonly WorkplaceReservationHold[];
}>;

export type WorkplaceBookingHoldReleaseInput = Readonly<{
  expectedIntentVersion: number;
  holds: readonly Readonly<{
    holdId: string;
    expectedHoldVersion: number;
  }>[];
  reason: string;
  explicitConfirmation: boolean;
}>;

export type WorkplaceBookingHoldReleaseReceipt = Readonly<{
  commandId: string;
  intentId: string;
  state: 'SUCCEEDED' | 'RESULT_UNKNOWN';
  releasedHoldIds: readonly string[];
  intentVersion: number;
  idempotentReplay: boolean;
  requeryRequired: boolean;
  correlationId: string;
  completedAt: string | null;
}>;

export type WorkplaceBookingHoldReleaseResult = Readonly<{
  intent: WorkplaceBookingHoldResponse;
  receipt: WorkplaceBookingHoldReleaseReceipt;
}>;

export type WorkplaceBookingIntentStatus = Readonly<{
  intent: WorkplaceBookingIntentPreview;
  holds: readonly WorkplaceReservationHold[];
  latestBatchId: string | null;
  latestBatchStatusUrl: string | null;
  serverTime: string;
}>;

export type WorkplaceBookingBatchStartInput = Readonly<{
  intentId: string;
  expectedIntentVersion: number;
  holds: readonly Readonly<{ holdId: string; expectedVersion: number }>[];
  failurePolicy: WorkplaceBookingFailurePolicy;
  reason: string;
  explicitConfirmation: boolean;
}>;

export type WorkplaceBookingBatchStartResponse = Readonly<{
  batchId: string;
  state: WorkplaceBookingBatchState;
  statusUrl: string;
  version: number;
  acceptedAt: string;
}>;

export type WorkplaceBookingBatchItem = Readonly<{
  batchItemId: string;
  intentItemId: string;
  holdId: string;
  clientItemKey: string;
  beneficiaryUserId: number;
  beneficiaryPersonPublicId: string | null;
  beneficiaryDisplayName: string;
  delegationGrantId: string | null;
  resourceType: WorkplaceResourceType;
  resourceId: string;
  resourceDisplayName: string;
  siteId: string;
  floorId: string;
  timeZone: string;
  startsAt: string;
  endsAt: string;
  authority: WorkplaceBookingAuthority;
  state: WorkplaceBookingBatchItemState;
  ownerReferenceId: string | null;
  ownerVersion: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  compensationAvailable: boolean;
  requeryRequired: boolean;
  version: number;
  updatedAt: string;
}>;

export type WorkplaceBookingBatch = Readonly<{
  batchId: string;
  intentId: string;
  actorUserId: number;
  state: WorkplaceBookingBatchState;
  failurePolicy: WorkplaceBookingFailurePolicy;
  reason: string;
  items: readonly WorkplaceBookingBatchItem[];
  terminal: boolean;
  requeryRequired: boolean;
  version: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  updatedAt: string;
}>;

export type WorkplaceBookingBatchCompensationInput = Readonly<{
  expectedBatchVersion: number;
  batchItemIds: readonly string[];
  compensateAllSucceeded: boolean;
  reason: string;
  explicitConfirmation: boolean;
}>;

export type WorkplaceBookingBatchReplanInput = Readonly<{
  expectedBatchVersion: number;
  batchItemIds: readonly string[];
  requestedHoldTtlSeconds: number;
  allowAlternatives: boolean;
  reason: string;
}>;

export type WorkplaceWaitlistConditions = Readonly<{
  maximumDistanceMeters: number | null;
  earliestStart: string | null;
  latestEnd: string | null;
  pricingMode: 'MANAGED' | 'NOT_APPLICABLE';
  maximumPrice: number | null;
  currency: string | null;
}>;

export type WorkplaceWaitlistInput = Readonly<{
  item: WorkplaceBookingIntentItemInput;
  autoConfirm: boolean;
  conditions: WorkplaceWaitlistConditions;
  notificationChannels: readonly WorkplaceWaitlistNotificationChannel[];
  reason: string;
}>;

export type WorkplaceWaitlistUpdateInput = Readonly<{
  expectedVersion: number;
  autoConfirm: boolean;
  conditions: WorkplaceWaitlistConditions;
  notificationChannels: readonly WorkplaceWaitlistNotificationChannel[];
  reason: string;
}>;

export type WorkplaceWaitlistCancelInput = Readonly<{
  expectedVersion: number;
  reason: string;
  explicitConfirmation: boolean;
}>;

export type WorkplaceAlternativeOffer = Readonly<{
  offerId: string;
  resourceId: string;
  resourceDisplayName: string;
  siteId: string;
  floorId: string;
  timeZone: string;
  holdId: string;
  state: WorkplaceAlternativeOfferState;
  startsAt: string;
  endsAt: string;
  expiresAt: string;
  acceptedBatchId: string | null;
  version: number;
}>;

export type WorkplaceWaitlistEntry = Readonly<{
  waitlistEntryId: string;
  actorUserId: number;
  beneficiaryUserId: number;
  beneficiaryPersonPublicId: string | null;
  beneficiaryDisplayName: string;
  resourceType: WorkplaceResourceType;
  preferredResourceId: string | null;
  siteId: string | null;
  floorId: string | null;
  startsAt: string;
  endsAt: string;
  purpose: string;
  autoConfirm: boolean;
  conditions: WorkplaceWaitlistConditions;
  notificationChannels: readonly WorkplaceWaitlistNotificationChannel[];
  state: WorkplaceWaitlistState;
  promotionEvaluationState: 'PENDING' | 'NO_MATCH' | 'BLOCKED' | 'MATCHED';
  promotionDecisionCode: string | null;
  promotionEvaluatedAt: string | null;
  rank: number | null;
  rankVisible: boolean;
  offer: WorkplaceAlternativeOffer | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}>;

export type WorkplaceWaitlistPage = Readonly<{
  content: readonly WorkplaceWaitlistEntry[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  generatedAt: string;
}>;

export type WorkplaceAlternativeOfferAcceptInput = Readonly<{
  expectedOfferVersion: number;
  failurePolicy: WorkplaceBookingFailurePolicy;
  reason: string;
  explicitConfirmation: boolean;
}>;

function commandHeaders(idempotencyKey: string) {
  return { headers: { 'Idempotency-Key': idempotencyKey } };
}

export async function previewWorkplaceBookingIntent(
  input: WorkplaceBookingIntentPreviewInput,
  idempotencyKey: string
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceBookingIntentPreview>,
    WorkplaceBookingIntentPreviewInput
  >(`${ROOT}/booking-intents/preview`, input, commandHeaders(idempotencyKey));
  return response.data.data;
}

export async function getWorkplaceAuthorizedBookingBeneficiaries() {
  const response = await axiosInstance.get<ApiResponse<WorkplaceAuthorizedBookingBeneficiaries>>(
    `${ROOT}/booking-intents/beneficiaries`
  );
  return response.data.data;
}

export async function getWorkplaceBookingIntent(intentId: string) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceBookingIntentStatus>>(
    `${ROOT}/booking-intents/${id(intentId)}`
  );
  return response.data.data;
}

export async function createWorkplaceReservationHolds(
  intentId: string,
  input: WorkplaceBookingHoldInput,
  idempotencyKey: string
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceBookingHoldResponse>,
    WorkplaceBookingHoldInput
  >(`${ROOT}/booking-intents/${id(intentId)}/holds`, input, commandHeaders(idempotencyKey));
  return response.data.data;
}

export async function releaseWorkplaceReservationHolds(
  intentId: string,
  input: WorkplaceBookingHoldReleaseInput,
  idempotencyKey: string
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceBookingHoldReleaseResult>,
    WorkplaceBookingHoldReleaseInput
  >(
    `${ROOT}/booking-orchestration/intents/${id(intentId)}/holds:release`,
    input,
    commandHeaders(idempotencyKey)
  );
  return response.data.data;
}

export async function startWorkplaceBookingBatch(
  input: WorkplaceBookingBatchStartInput,
  idempotencyKey: string
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceBookingBatchStartResponse>,
    WorkplaceBookingBatchStartInput
  >(`${ROOT}/booking-batches`, input, commandHeaders(idempotencyKey));
  return response.data.data;
}

export async function getWorkplaceBookingBatch(batchId: string) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceBookingBatch>>(
    `${ROOT}/booking-batches/${id(batchId)}`
  );
  return response.data.data;
}

export async function compensateWorkplaceBookingBatch(
  batchId: string,
  input: WorkplaceBookingBatchCompensationInput,
  idempotencyKey: string
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceBookingBatch>,
    WorkplaceBookingBatchCompensationInput
  >(`${ROOT}/booking-batches/${id(batchId)}/compensations`, input, commandHeaders(idempotencyKey));
  return response.data.data;
}

export async function replanWorkplaceBookingBatch(
  batchId: string,
  input: WorkplaceBookingBatchReplanInput,
  idempotencyKey: string
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceBookingIntentPreview>,
    WorkplaceBookingBatchReplanInput
  >(`${ROOT}/booking-batches/${id(batchId)}/replans`, input, commandHeaders(idempotencyKey));
  return response.data.data;
}

export async function createWorkplaceWaitlistEntry(
  input: WorkplaceWaitlistInput,
  idempotencyKey: string
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceWaitlistEntry>,
    WorkplaceWaitlistInput
  >(`${ROOT}/waitlist-entries`, input, commandHeaders(idempotencyKey));
  return response.data.data;
}

export async function getWorkplaceWaitlistEntry(waitlistEntryId: string) {
  const response = await axiosInstance.get<ApiResponse<WorkplaceWaitlistEntry>>(
    `${ROOT}/waitlist-entries/${id(waitlistEntryId)}`
  );
  return response.data.data;
}

export async function getWorkplaceWaitlistEntries({
  from,
  to,
  page = 0,
  size = 50,
}: {
  from: string;
  to: string;
  page?: number;
  size?: number;
}) {
  const query = new URLSearchParams({
    from,
    to,
    page: String(page),
    size: String(size),
  });
  const response = await axiosInstance.get<ApiResponse<WorkplaceWaitlistPage>>(
    `${ROOT}/waitlist-entries?${query.toString()}`
  );
  return response.data.data;
}

export async function updateWorkplaceWaitlistEntry(
  waitlistEntryId: string,
  input: WorkplaceWaitlistUpdateInput,
  idempotencyKey: string
) {
  const response = await axiosInstance.patch<
    ApiResponse<WorkplaceWaitlistEntry>,
    WorkplaceWaitlistUpdateInput
  >(`${ROOT}/waitlist-entries/${id(waitlistEntryId)}`, input, commandHeaders(idempotencyKey));
  return response.data.data;
}

export async function cancelWorkplaceWaitlistEntry(
  waitlistEntryId: string,
  input: WorkplaceWaitlistCancelInput,
  idempotencyKey: string
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceWaitlistEntry>,
    WorkplaceWaitlistCancelInput
  >(
    `${ROOT}/waitlist-entries/${id(waitlistEntryId)}:cancel`,
    input,
    commandHeaders(idempotencyKey)
  );
  return response.data.data;
}

export async function acceptWorkplaceAlternativeOffer(
  offerId: string,
  input: WorkplaceAlternativeOfferAcceptInput,
  idempotencyKey: string
) {
  const response = await axiosInstance.post<
    ApiResponse<WorkplaceBookingBatchStartResponse>,
    WorkplaceAlternativeOfferAcceptInput
  >(`${ROOT}/alternative-offers/${id(offerId)}:accept`, input, commandHeaders(idempotencyKey));
  return response.data.data;
}
