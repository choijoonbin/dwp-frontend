export const WORKPLACE_PLANNING_SERIES = [
  'WORK_PLAN',
  'RESERVATION',
  'CHECK_IN',
  'ACCESS',
  'SENSOR_OCCUPANCY',
  'NO_SHOW',
] as const;
export const WORKPLACE_PLANNING_FORECAST_STATES = [
  'READY',
  'DATA_INSUFFICIENT',
  'STALE',
  'PARTIAL',
  'COMPUTE_FAILED',
] as const;
export const WORKPLACE_PLANNING_SCENARIO_STATES = [
  'DRAFT',
  'PREVIEWED',
  'SUBMITTED',
  'APPROVED',
  'PUBLISHED',
] as const;

export type WorkplacePlanningSeries = (typeof WORKPLACE_PLANNING_SERIES)[number];
export type WorkplacePlanningSourceAvailability =
  'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE' | 'COMPUTE_FAILED';
export type WorkplacePlanningFreshness = 'FRESH' | 'STALE' | 'UNKNOWN';
export type WorkplacePlanningForecastState = (typeof WORKPLACE_PLANNING_FORECAST_STATES)[number];
export type WorkplacePlanningScenarioState = (typeof WORKPLACE_PLANNING_SCENARIO_STATES)[number];
export type WorkplacePlanningBookingImpactState = 'READY' | 'SCOPE_INCOMPLETE' | 'COMPUTE_FAILED';
export type WorkplacePlanningEmissionEvidenceKind = 'METER' | 'APPROVED_MODEL';

export type WorkplacePlanningScope = Readonly<{
  siteId: string;
  floorId: string | null;
  neighborhood: string | null;
  resourceType:
    'ROOM' | 'DESK' | 'LOCKER' | 'PARKING' | 'FOCUS_POD' | 'PHONE_BOOTH' | 'EQUIPMENT' | null;
  from: string;
  to: string;
}>;

export type WorkplacePlanningSeriesPoint = Readonly<{
  bucketStart: string;
  value: number;
  lowerBound: number | null;
  upperBound: number | null;
  unit: string;
}>;

export type WorkplacePlanningSourceStatus = Readonly<{
  series: WorkplacePlanningSeries;
  availability: WorkplacePlanningSourceAvailability;
  coveragePercent: number;
  sourceAt: string | null;
  receivedAt: string | null;
  freshness: WorkplacePlanningFreshness;
  exclusions: readonly string[];
  evidenceReference: string | null;
  points: readonly WorkplacePlanningSeriesPoint[];
  observationId: string | null;
  sequence: number;
}>;

export type WorkplacePlanningForecastPoint = Readonly<{
  bucketStart: string;
  expectedDemand: number;
  lowerBound: number;
  upperBound: number;
  unit: string;
}>;

export type WorkplacePlanningRecommendationMetrics = Readonly<{
  peakDemand: number;
  lowUtilizationDemand: number;
  confidencePercent: number;
  calculationVersion: string;
}>;

export type WorkplacePlanningForecast = Readonly<{
  forecastId: string | null;
  state: WorkplacePlanningForecastState;
  calculationVersion: string | null;
  evidenceReference: string | null;
  sourceObservationIds: readonly string[];
  points: readonly WorkplacePlanningForecastPoint[];
  recommendationMetrics: WorkplacePlanningRecommendationMetrics | null;
  limitations: readonly string[];
  sourceAt: string | null;
  receivedAt: string | null;
  evaluatedAt: string;
}>;

export type WorkplacePlanningEmission = Readonly<{
  emissionEvidenceId: string;
  evidenceKind: WorkplacePlanningEmissionEvidenceKind;
  energyValue: number;
  energyUnit: string;
  co2eValue: number;
  co2eUnit: string;
  factorVersion: string;
  regionCode: string;
  evidenceReference: string;
  sourceAt: string;
  receivedAt: string;
}>;

export type WorkplacePlanningDraft = Readonly<{
  proposedCapacity: number;
  proposedRoomCapacity: number;
  proposedAccessibleResourceCount: number;
  operatingStart: string;
  operatingEnd: string;
  policyReference: string | null;
  affectedResourceIds: readonly string[];
  neighborhoodAllocations: readonly Readonly<{ neighborhood: string; capacity: number }>[];
  emissionEvidenceId: string | null;
}>;

export type WorkplacePlanningComparison = Readonly<{
  currentCapacity: number;
  proposedCapacity: number;
  currentRoomCapacity: number;
  proposedRoomCapacity: number;
  currentAccessibleResourceCount: number;
  proposedAccessibleResourceCount: number;
  currentUtilizationPercent: number | null;
  proposedUtilizationPercent: number | null;
  peakDemand: number | null;
  currentExcessDemand: number | null;
  proposedExcessDemand: number | null;
  impactedBookingCount: number | null;
}>;

export type WorkplacePlanningBookingImpact = Readonly<{
  impactPreviewId: string;
  scenarioId: string;
  scenarioVersion: number;
  state: WorkplacePlanningBookingImpactState;
  impactedBookingCount: number | null;
  bookings: readonly Readonly<{
    bookingId: string;
    resourceId: string;
    startsAt: string;
    endsAt: string;
    bookingStatus: string;
    impactReason: string;
    automaticallyMoved: false;
  }>[];
  limitations: readonly string[];
  expiresAt: string;
  createdAt: string;
}>;

export type WorkplacePlanningScenarioPreview = Readonly<{
  previewId: string;
  scenarioId: string;
  scenarioVersion: number;
  forecastState: WorkplacePlanningForecastState;
  forecast: WorkplacePlanningForecast;
  comparison: WorkplacePlanningComparison;
  emission: WorkplacePlanningEmission | null;
  eligible: boolean;
  limitations: readonly string[];
  expiresAt: string;
  createdAt: string;
}>;

export type WorkplacePlanningScenario = Readonly<{
  scenarioId: string;
  name: string;
  description: string | null;
  state: WorkplacePlanningScenarioState;
  scope: WorkplacePlanningScope;
  draft: WorkplacePlanningDraft;
  activePreview: WorkplacePlanningScenarioPreview | null;
  version: number;
  submittedAt: string | null;
  submittedBy: number | null;
  approvedAt: string | null;
  approvedBy: number | null;
  approvalAuthorityReference: string | null;
  publishedAt: string | null;
  publishedBy: number | null;
  lastRejectedAt: string | null;
  lastRejectedBy: number | null;
  lastRejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type WorkplacePlanningCommandResult = Readonly<{
  scenario: WorkplacePlanningScenario;
  receipt: Readonly<{
    commandId: string;
    commandType: string;
    state: 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN';
    scenarioId: string;
    scenarioState: WorkplacePlanningScenarioState;
    scenarioVersion: number;
    outboxId: string;
    outboxState: 'PENDING' | 'PUBLISHED' | 'FAILED' | 'RESULT_UNKNOWN';
    idempotentReplay: boolean;
    correlationId: string | null;
    acceptedAt: string;
  }>;
}>;

export type WorkplacePlanningBookingImpactCommandResult = Readonly<{
  preview: WorkplacePlanningBookingImpact;
  receipt: WorkplacePlanningCommandResult['receipt'];
}>;

export type WorkplacePlanningOverview = Readonly<{
  scope: WorkplacePlanningScope;
  current: Readonly<{
    capacity: number;
    roomCapacity: number;
    accessibleResourceCount: number;
    resourceCount: number;
    catalogAsOf: string;
  }>;
  sources: readonly WorkplacePlanningSourceStatus[];
  forecast: WorkplacePlanningForecast;
  emission: WorkplacePlanningEmission | null;
  scenarios: readonly WorkplacePlanningScenario[];
  generatedAt: string;
}>;
