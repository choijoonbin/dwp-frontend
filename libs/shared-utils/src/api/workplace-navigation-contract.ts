export type WorkplaceNavigationGraphState = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type WorkplaceNavigationTravelMode = 'WALK' | 'STAIR' | 'ELEVATOR' | 'RAMP';
export type WorkplaceNavigationPoiCategory =
  | 'ROOM'
  | 'ELEVATOR'
  | 'STAIR'
  | 'RESTROOM'
  | 'PRINTER'
  | 'HELP_DESK'
  | 'AED'
  | 'EMERGENCY_EXIT'
  | 'ASSEMBLY_POINT'
  | 'ENTRY'
  | 'OTHER';
export type WorkplaceNavigationRouteOutcome =
  'GUIDED' | 'GRAPH_MISSING' | 'GRAPH_STALE' | 'ACCESS_DENIED' | 'NO_ROUTE';
export type WorkplaceDeviceType = 'ROOM_PANEL' | 'STATUS_BOARD';
export type WorkplaceDeviceRegistrationState =
  'PENDING' | 'APPROVED' | 'BOUND' | 'SUSPENDED' | 'RETIRED';
export type WorkplaceDeviceConnectivity = 'UNREGISTERED' | 'ONLINE' | 'OFFLINE';
export type WorkplaceDeviceFreshness = 'UNKNOWN' | 'FRESH' | 'STALE';
export type WorkplaceDeviceAvailability = 'AVAILABLE' | 'OCCUPIED' | 'UNAVAILABLE';
export type WorkplaceDeviceProviderCapability =
  'MDM' | 'GRAPH' | 'BLE' | 'NFC' | 'SPEED_GATE' | 'SENSOR' | 'MTLS' | 'TPM';
export type WorkplaceDeviceProviderTruthState =
  'NOT_CONFIGURED' | 'CONFIGURED_UNVERIFIED' | 'HEALTHY' | 'DEGRADED' | 'STALE';
export type WorkplaceDeviceCommandType =
  'FORCE_SYNC' | 'CLEAR_CACHE' | 'REBOOT' | 'SAFETY_TAKEOVER' | 'CLEAR_SAFETY' | 'UNBIND';
export type WorkplaceDeviceCommandState =
  'ACCEPTED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'RESULT_UNKNOWN';

export type WorkplaceNavigationPoi = Readonly<{
  poiId: string;
  nodeId: string;
  siteId: string;
  floorId: string;
  resourceId: string | null;
  category: WorkplaceNavigationPoiCategory;
  nameKo: string;
  nameEn: string;
  directionHintKo: string | null;
  directionHintEn: string | null;
}>;

export type WorkplaceNavigationStep = Readonly<{
  fromNodeId: string;
  toNodeId: string;
  floorId: string;
  travelMode: WorkplaceNavigationTravelMode;
  travelSeconds: number;
  directionKo: string;
  directionEn: string;
}>;

export type WorkplaceNavigationFallback = Readonly<{
  siteId: string;
  floorId: string | null;
  resourceId: string | null;
  siteName: string;
  floorName: string | null;
  resourceName: string | null;
  floorMapPath: string | null;
  helpDesks: readonly WorkplaceNavigationPoi[];
}>;

export type WorkplaceNavigationRoute = Readonly<{
  outcome: WorkplaceNavigationRouteOutcome;
  graphRevisionId: string | null;
  graphRevisionNumber: number;
  origin: WorkplaceNavigationPoi | null;
  destination: WorkplaceNavigationPoi | null;
  steps: readonly WorkplaceNavigationStep[];
  totalTravelSeconds: number;
  fallback: WorkplaceNavigationFallback | null;
  limitations: readonly string[];
  graphPublishedAt: string | null;
  asOf: string;
}>;

export type WorkplaceNavigationGraphRevision = Readonly<{
  graphRevisionId: string;
  siteId: string;
  revisionNumber: number;
  state: WorkplaceNavigationGraphState;
  contentHash: string;
  changeSummary: string;
  version: number;
  submittedAt: string;
  publishedAt: string | null;
  nodeCount: number;
  edgeCount: number;
  poiCount: number;
  updatedAt: string;
}>;

export type WorkplaceDevice = Readonly<{
  deviceId: string;
  displayName: string;
  deviceType: WorkplaceDeviceType;
  registrationState: WorkplaceDeviceRegistrationState;
  siteId: string | null;
  floorId: string | null;
  resourceId: string | null;
  hardwareModel: string;
  osVersion: string;
  appVersion: string | null;
  policyVersion: string | null;
  heartbeatAt: string | null;
  connectivity: WorkplaceDeviceConnectivity;
  scheduleSourceAt: string | null;
  scheduleReceivedAt: string | null;
  scheduleFreshness: WorkplaceDeviceFreshness;
  recentErrorCode: string | null;
  safetyOfflineFallback: boolean;
  version: number;
  updatedAt: string;
}>;

export type WorkplaceDeviceProviderTruth = Readonly<{
  capability: WorkplaceDeviceProviderCapability;
  providerCode: string | null;
  state: WorkplaceDeviceProviderTruthState;
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

export type WorkplaceDeviceScheduleItem = Readonly<{
  bookingId: string;
  startsAt: string;
  endsAt: string;
  title: string;
  organizer: string | null;
  privacyMasked: boolean;
}>;

export type WorkplaceDeviceSafetyFrame = Readonly<{
  safetyFrameId: string;
  state: 'ACTIVE' | 'CLEARED';
  message: string;
  direction: string;
  issuedAt: string;
  issuedByActorId: number;
  offlineFallback: boolean;
  clearedAt: string | null;
  version: number;
}>;

export type WorkplaceRoomPanelProjection = Readonly<{
  device: WorkplaceDevice;
  current: WorkplaceDeviceScheduleItem | null;
  next: WorkplaceDeviceScheduleItem | null;
  availability: WorkplaceDeviceAvailability;
  walkUpBookingAllowed: boolean;
  checkInAllowed: boolean;
  earlyEndAllowed: boolean;
  safetyFrame: WorkplaceDeviceSafetyFrame | null;
  asOf: string;
}>;

export type WorkplaceFloorResourceStatus = Readonly<{
  resourceId: string;
  zoneId: string | null;
  zoneNameKo: string | null;
  zoneNameEn: string | null;
  nameKo: string;
  nameEn: string;
  availability: WorkplaceDeviceAvailability;
  directionKo: string | null;
  directionEn: string | null;
}>;

export type WorkplaceStatusBoardProjection = Readonly<{
  device: WorkplaceDevice;
  resources: readonly WorkplaceFloorResourceStatus[];
  availableCount: number;
  occupiedCount: number;
  unavailableCount: number;
  safetyFrame: WorkplaceDeviceSafetyFrame | null;
  freshness: WorkplaceDeviceFreshness;
  asOf: string;
}>;

export type WorkplaceDeviceProjection = Readonly<{
  surface: WorkplaceDeviceType;
  roomPanel: WorkplaceRoomPanelProjection | null;
  statusBoard: WorkplaceStatusBoardProjection | null;
}>;

export type WorkplaceDeviceCommandPreview = Readonly<{
  previewId: string;
  deviceId: string;
  commandType: WorkplaceDeviceCommandType;
  expectedDeviceVersion: number;
  payload: Readonly<Record<string, string>>;
  impact: readonly string[];
  eligible: boolean;
  limitations: readonly string[];
  expiresAt: string;
  createdAt: string;
}>;

export type WorkplaceDeviceCommandReceipt = Readonly<{
  commandId: string;
  deviceId: string;
  actorUserId: number;
  commandType: WorkplaceDeviceCommandType;
  state: WorkplaceDeviceCommandState;
  reason: string;
  resultCode: string | null;
  providerOperationReference: string | null;
  version: number;
  recoveryByGetOnly: boolean;
  statusHref: string;
  correlationId: string | null;
  acceptedAt: string;
  completedAt: string | null;
  updatedAt: string;
}>;

export type WorkplaceDeviceAuditEvent = Readonly<{
  auditEventId: string;
  actorUserId: number;
  action: string;
  resourceType: string;
  resourceId: string;
  correlationId: string | null;
  occurredAt: string;
}>;

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new Error(`${label} must be a string.`);
  return value;
}

function nullableText(value: unknown, label: string): string | null {
  return value === null || value === undefined ? null : text(value, label);
}

function number(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error(`${label} must be a number.`);
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`);
  return value;
}

function strings(value: unknown, label: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value.map((entry, index) => text(entry, `${label}[${index}]`));
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) {
    throw new Error(`${label} is not supported.`);
  }
  return value as T;
}

const POI_CATEGORIES = [
  'ROOM',
  'ELEVATOR',
  'STAIR',
  'RESTROOM',
  'PRINTER',
  'HELP_DESK',
  'AED',
  'EMERGENCY_EXIT',
  'ASSEMBLY_POINT',
  'ENTRY',
  'OTHER',
] as const;
const AVAILABILITY = ['AVAILABLE', 'OCCUPIED', 'UNAVAILABLE'] as const;
const FRESHNESS = ['UNKNOWN', 'FRESH', 'STALE'] as const;

export function parseWorkplaceNavigationPoi(value: unknown): WorkplaceNavigationPoi {
  const row = object(value, 'POI');
  return {
    poiId: text(row.poiId, 'POI id'),
    nodeId: text(row.nodeId, 'Node id'),
    siteId: text(row.siteId, 'Site id'),
    floorId: text(row.floorId, 'Floor id'),
    resourceId: nullableText(row.resourceId, 'Resource id'),
    category: enumValue(row.category, POI_CATEGORIES, 'POI category'),
    nameKo: text(row.nameKo, 'Korean POI name'),
    nameEn: text(row.nameEn, 'English POI name'),
    directionHintKo: nullableText(row.directionHintKo, 'Korean direction hint'),
    directionHintEn: nullableText(row.directionHintEn, 'English direction hint'),
  };
}

export function parseWorkplaceNavigationRoute(value: unknown): WorkplaceNavigationRoute {
  const row = object(value, 'Navigation route');
  const fallback =
    row.fallback === null || row.fallback === undefined
      ? null
      : object(row.fallback, 'Navigation fallback');
  const steps = Array.isArray(row.steps)
    ? row.steps
    : (() => {
        throw new Error('Route steps must be an array.');
      })();
  const outcome = enumValue(
    row.outcome,
    ['GUIDED', 'GRAPH_MISSING', 'GRAPH_STALE', 'ACCESS_DENIED', 'NO_ROUTE'] as const,
    'Route outcome'
  );
  if (outcome !== 'GUIDED' && steps.length > 0) {
    throw new Error('Fallback navigation must not contain an invented guided route.');
  }
  return {
    outcome,
    graphRevisionId: nullableText(row.graphRevisionId, 'Graph revision id'),
    graphRevisionNumber: number(row.graphRevisionNumber, 'Graph revision number'),
    origin: row.origin ? parseWorkplaceNavigationPoi(row.origin) : null,
    destination: row.destination ? parseWorkplaceNavigationPoi(row.destination) : null,
    steps: steps.map((entry, index) => {
      const step = object(entry, `Route step ${index}`);
      return {
        fromNodeId: text(step.fromNodeId, 'From node id'),
        toNodeId: text(step.toNodeId, 'To node id'),
        floorId: text(step.floorId, 'Step floor id'),
        travelMode: enumValue(
          step.travelMode,
          ['WALK', 'STAIR', 'ELEVATOR', 'RAMP'] as const,
          'Travel mode'
        ),
        travelSeconds: number(step.travelSeconds, 'Travel seconds'),
        directionKo: text(step.directionKo, 'Korean direction'),
        directionEn: text(step.directionEn, 'English direction'),
      };
    }),
    totalTravelSeconds: number(row.totalTravelSeconds, 'Total travel seconds'),
    fallback: fallback
      ? {
          siteId: text(fallback.siteId, 'Fallback site id'),
          floorId: nullableText(fallback.floorId, 'Fallback floor id'),
          resourceId: nullableText(fallback.resourceId, 'Fallback resource id'),
          siteName: text(fallback.siteName, 'Fallback site name'),
          floorName: nullableText(fallback.floorName, 'Fallback floor name'),
          resourceName: nullableText(fallback.resourceName, 'Fallback resource name'),
          floorMapPath: nullableText(fallback.floorMapPath, 'Floor map path'),
          helpDesks: Array.isArray(fallback.helpDesks)
            ? fallback.helpDesks.map(parseWorkplaceNavigationPoi)
            : [],
        }
      : null,
    limitations: strings(row.limitations, 'Route limitations'),
    graphPublishedAt: nullableText(row.graphPublishedAt, 'Graph published time'),
    asOf: text(row.asOf, 'Route as-of'),
  };
}

export function parseWorkplaceDevice(value: unknown): WorkplaceDevice {
  const row = object(value, 'Workplace device');
  return {
    deviceId: text(row.deviceId, 'Device id'),
    displayName: text(row.displayName, 'Device name'),
    deviceType: enumValue(row.deviceType, ['ROOM_PANEL', 'STATUS_BOARD'] as const, 'Device type'),
    registrationState: enumValue(
      row.registrationState,
      ['PENDING', 'APPROVED', 'BOUND', 'SUSPENDED', 'RETIRED'] as const,
      'Registration state'
    ),
    siteId: nullableText(row.siteId, 'Site id'),
    floorId: nullableText(row.floorId, 'Floor id'),
    resourceId: nullableText(row.resourceId, 'Resource id'),
    hardwareModel: text(row.hardwareModel, 'Hardware model'),
    osVersion: text(row.osVersion, 'OS version'),
    appVersion: nullableText(row.appVersion, 'App version'),
    policyVersion: nullableText(row.policyVersion, 'Policy version'),
    heartbeatAt: nullableText(row.heartbeatAt, 'Heartbeat time'),
    connectivity: enumValue(
      row.connectivity,
      ['UNREGISTERED', 'ONLINE', 'OFFLINE'] as const,
      'Connectivity'
    ),
    scheduleSourceAt: nullableText(row.scheduleSourceAt, 'Schedule source time'),
    scheduleReceivedAt: nullableText(row.scheduleReceivedAt, 'Schedule received time'),
    scheduleFreshness: enumValue(row.scheduleFreshness, FRESHNESS, 'Schedule freshness'),
    recentErrorCode: nullableText(row.recentErrorCode, 'Recent error code'),
    safetyOfflineFallback: boolean(row.safetyOfflineFallback, 'Safety offline fallback'),
    version: number(row.version, 'Device version'),
    updatedAt: text(row.updatedAt, 'Device updated time'),
  };
}

function schedule(value: unknown): WorkplaceDeviceScheduleItem | null {
  if (value === null || value === undefined) return null;
  const row = object(value, 'Schedule item');
  return {
    bookingId: text(row.bookingId, 'Booking id'),
    startsAt: text(row.startsAt, 'Schedule start'),
    endsAt: text(row.endsAt, 'Schedule end'),
    title: text(row.title, 'Schedule title'),
    organizer: nullableText(row.organizer, 'Schedule organizer'),
    privacyMasked: boolean(row.privacyMasked, 'Privacy masked'),
  };
}

function safetyFrame(value: unknown): WorkplaceDeviceSafetyFrame | null {
  if (value === null || value === undefined) return null;
  const row = object(value, 'Safety frame');
  return {
    safetyFrameId: text(row.safetyFrameId, 'Safety frame id'),
    state: enumValue(row.state, ['ACTIVE', 'CLEARED'] as const, 'Safety frame state'),
    message: text(row.message, 'Safety message'),
    direction: text(row.direction, 'Safety direction'),
    issuedAt: text(row.issuedAt, 'Safety issued time'),
    issuedByActorId: number(row.issuedByActorId, 'Safety issuing actor id'),
    offlineFallback: boolean(row.offlineFallback, 'Offline fallback'),
    clearedAt: nullableText(row.clearedAt, 'Safety cleared time'),
    version: number(row.version, 'Safety frame version'),
  };
}

export function parseWorkplaceDeviceProjection(value: unknown): WorkplaceDeviceProjection {
  const row = object(value, 'Device projection');
  const surface = enumValue(row.surface, ['ROOM_PANEL', 'STATUS_BOARD'] as const, 'Device surface');
  const room = row.roomPanel ? object(row.roomPanel, 'Room panel') : null;
  const board = row.statusBoard ? object(row.statusBoard, 'Status board') : null;
  if ((surface === 'ROOM_PANEL' && !room) || (surface === 'STATUS_BOARD' && !board)) {
    throw new Error('Device projection does not match its declared surface.');
  }
  return {
    surface,
    roomPanel: room
      ? {
          device: parseWorkplaceDevice(room.device),
          current: schedule(room.current),
          next: schedule(room.next),
          availability: enumValue(room.availability, AVAILABILITY, 'Room availability'),
          walkUpBookingAllowed: boolean(room.walkUpBookingAllowed, 'Walk-up flag'),
          checkInAllowed: boolean(room.checkInAllowed, 'Check-in flag'),
          earlyEndAllowed: boolean(room.earlyEndAllowed, 'Early-end flag'),
          safetyFrame: safetyFrame(room.safetyFrame),
          asOf: text(room.asOf, 'Room panel as-of'),
        }
      : null,
    statusBoard: board
      ? {
          device: parseWorkplaceDevice(board.device),
          resources: Array.isArray(board.resources)
            ? board.resources.map((entry, index) => {
                const item = object(entry, `Board resource ${index}`);
                return {
                  resourceId: text(item.resourceId, 'Resource id'),
                  zoneId: nullableText(item.zoneId, 'Zone id'),
                  zoneNameKo: nullableText(item.zoneNameKo, 'Korean zone name'),
                  zoneNameEn: nullableText(item.zoneNameEn, 'English zone name'),
                  nameKo: text(item.nameKo, 'Korean resource name'),
                  nameEn: text(item.nameEn, 'English resource name'),
                  availability: enumValue(item.availability, AVAILABILITY, 'Resource availability'),
                  directionKo: nullableText(item.directionKo, 'Korean direction'),
                  directionEn: nullableText(item.directionEn, 'English direction'),
                };
              })
            : [],
          availableCount: number(board.availableCount, 'Available count'),
          occupiedCount: number(board.occupiedCount, 'Occupied count'),
          unavailableCount: number(board.unavailableCount, 'Unavailable count'),
          safetyFrame: safetyFrame(board.safetyFrame),
          freshness: enumValue(board.freshness, FRESHNESS, 'Board freshness'),
          asOf: text(board.asOf, 'Status board as-of'),
        }
      : null,
  };
}

export function parseWorkplaceDeviceCommandPreview(value: unknown): WorkplaceDeviceCommandPreview {
  const row = object(value, 'Device command preview');
  return {
    previewId: text(row.previewId, 'Preview id'),
    deviceId: text(row.deviceId, 'Device id'),
    commandType: enumValue(
      row.commandType,
      ['FORCE_SYNC', 'CLEAR_CACHE', 'REBOOT', 'SAFETY_TAKEOVER', 'CLEAR_SAFETY', 'UNBIND'] as const,
      'Command type'
    ),
    expectedDeviceVersion: number(row.expectedDeviceVersion, 'Expected device version'),
    payload: object(row.payload, 'Command payload') as Record<string, string>,
    impact: strings(row.impact, 'Command impact'),
    eligible: boolean(row.eligible, 'Command eligibility'),
    limitations: strings(row.limitations, 'Command limitations'),
    expiresAt: text(row.expiresAt, 'Preview expiry'),
    createdAt: text(row.createdAt, 'Preview created time'),
  };
}

export function parseWorkplaceDeviceCommandReceipt(value: unknown): WorkplaceDeviceCommandReceipt {
  const row = object(value, 'Device command receipt');
  return {
    commandId: text(row.commandId, 'Command id'),
    deviceId: text(row.deviceId, 'Device id'),
    actorUserId: number(row.actorUserId, 'Actor user id'),
    commandType: enumValue(
      row.commandType,
      ['FORCE_SYNC', 'CLEAR_CACHE', 'REBOOT', 'SAFETY_TAKEOVER', 'CLEAR_SAFETY', 'UNBIND'] as const,
      'Command type'
    ),
    state: enumValue(
      row.state,
      ['ACCEPTED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'RESULT_UNKNOWN'] as const,
      'Command state'
    ),
    reason: text(row.reason, 'Command reason'),
    resultCode: nullableText(row.resultCode, 'Result code'),
    providerOperationReference: nullableText(
      row.providerOperationReference,
      'Provider operation reference'
    ),
    version: number(row.version, 'Command version'),
    recoveryByGetOnly: boolean(row.recoveryByGetOnly, 'GET-only recovery'),
    statusHref: text(row.statusHref, 'Command status href'),
    correlationId: nullableText(row.correlationId, 'Correlation id'),
    acceptedAt: text(row.acceptedAt, 'Accepted time'),
    completedAt: nullableText(row.completedAt, 'Completed time'),
    updatedAt: text(row.updatedAt, 'Updated time'),
  };
}

export const workplaceNavigationContractInternals = {
  object,
  text,
  nullableText,
  number,
  boolean,
  strings,
  enumValue,
};
