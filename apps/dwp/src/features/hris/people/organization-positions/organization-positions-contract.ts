import { HttpError } from '@dwp-frontend/shared-utils';

export const HRIS_ORGANIZATION_POSITIONS_FEATURE = 'HRIS_ORGANIZATION_POSITIONS' as const;
export const HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND = 'HRIS_ORGANIZATION_POSITIONS_V2' as const;
export const HRIS_ORGANIZATION_GRAPH_PATH = '/api/people/v1/hris/organizations/graph' as const;

export const HRIS_ORGANIZATION_GRAPH_CONTRACT = Object.freeze({
  bindingId: 'PEP-HRM-010',
  routeContractKey: 'route.hcm.operations.organization-graph.data',
  pageRouteContractKey: 'route.hcm.operations.organization-positions.page',
  method: 'GET',
  path: HRIS_ORGANIZATION_GRAPH_PATH,
  purposeCode: 'HR_OPERATIONS',
  capability: 'hcm.operations.organization.view',
});

export type OrganizationGraphWithPositionsV2Query = Readonly<{
  asOf: string;
  rootPublicId: string;
  depth: number;
  relationshipType: 'REPORTING';
  includePositions: boolean;
}>;

export type OrganizationNodeV2 = Readonly<{
  organizationPublicId: string;
  parentPublicId: string | null;
  name: string;
  depth: number;
}>;

export type OrganizationPositionV2 = Readonly<{
  positionPublicId: string;
  positionKey: string;
  title: string;
  organizationPublicId: string;
  reportsToPositionPublicId: string | null;
  status: string;
  positionType: string;
  criticality: string;
  budgetedFte: number;
  annualCostAmount: number | null;
  costCurrency: string | null;
  jobProfileName: string | null;
  locationName: string | null;
  availabilityDate: string | null;
  incumbentPersonPublicIds: readonly string[];
  subordinatePositionCount: number;
}>;

export type OrganizationGraphWithPositionsV2 = Readonly<{
  schemaVersion: 2;
  asOf: string;
  effectiveDate: string;
  rootPublicId: string;
  depth: number;
  relationshipType: 'REPORTING';
  positionsIncluded: boolean;
  nodes: readonly OrganizationNodeV2[];
  positions: readonly OrganizationPositionV2[];
}>;

export type HrisOrganizationPositionsQueryAdapter = Readonly<{
  kind: typeof HRIS_ORGANIZATION_POSITIONS_ADAPTER_KIND;
  query: (
    request: OrganizationGraphWithPositionsV2Query,
    signal: AbortSignal
  ) => Promise<OrganizationGraphWithPositionsV2>;
}>;

export type HrisOrganizationPositionsRuntimeGate = Readonly<{
  feature: typeof HRIS_ORGANIZATION_POSITIONS_FEATURE;
  enabled: boolean;
  tenantEnrolled: boolean;
}>;

export const HRIS_ORGANIZATION_POSITIONS_DEFAULT_GATE: HrisOrganizationPositionsRuntimeGate =
  Object.freeze({
    feature: HRIS_ORGANIZATION_POSITIONS_FEATURE,
    enabled: false,
    tenantEnrolled: false,
  });

export type OrganizationGraphFailureKind =
  'INVALID_QUERY' | 'PERMISSION_DENIED' | 'NOT_FOUND' | 'STALE' | 'UNSUPPORTED' | 'UNAVAILABLE';

export type OrganizationGraphFailure = Readonly<{
  kind: OrganizationGraphFailureKind;
  reference?: string;
}>;

const UUID_INPUT = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const UUID_CANONICAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const INSTANT_WITH_OFFSET =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const QUERY_KEYS = [
  'asOf',
  'rootPublicId',
  'depth',
  'relationshipType',
  'includePositions',
] as const;
const RESPONSE_KEYS = [
  'schemaVersion',
  'asOf',
  'effectiveDate',
  'rootPublicId',
  'depth',
  'relationshipType',
  'positionsIncluded',
  'nodes',
  'positions',
] as const;
const NODE_KEYS = ['organizationPublicId', 'parentPublicId', 'name', 'depth'] as const;
const POSITION_KEYS = [
  'positionPublicId',
  'positionKey',
  'title',
  'organizationPublicId',
  'reportsToPositionPublicId',
  'status',
  'positionType',
  'criticality',
  'budgetedFte',
  'annualCostAmount',
  'costCurrency',
  'jobProfileName',
  'locationName',
  'availabilityDate',
  'incumbentPersonPublicIds',
  'subordinatePositionCount',
] as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasOnlyKeys(source: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(source).every((key) => allowed.includes(key));
}

function hasExactKeys(source: Record<string, unknown>, expected: readonly string[]): boolean {
  return hasOnlyKeys(source, expected) && expected.every((key) => key in source);
}

function validInstant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    INSTANT_WITH_OFFSET.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function validCivilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !CIVIL_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

function nonBlank(value: unknown, maximum = 256): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= maximum
  );
}

function nullableString(value: unknown, maximum = 256): value is string | null {
  return value === null || nonBlank(value, maximum);
}

function finiteNonnegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function integerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum && Number(value) <= maximum;
}

function compareCodePoints(left: string, right: string): number {
  const leftPoints = Array.from(left, (value) => value.codePointAt(0)!);
  const rightPoints = Array.from(right, (value) => value.codePointAt(0)!);
  const length = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < length; index += 1) {
    const difference = leftPoints[index]! - rightPoints[index]!;
    if (difference !== 0) return difference;
  }
  return leftPoints.length - rightPoints.length;
}

export function assertOrganizationGraphQuery(
  value: unknown
): OrganizationGraphWithPositionsV2Query {
  const source = record(value);
  if (
    !source ||
    !hasExactKeys(source, QUERY_KEYS) ||
    !validInstant(source.asOf) ||
    typeof source.rootPublicId !== 'string' ||
    !UUID_INPUT.test(source.rootPublicId) ||
    !integerInRange(source.depth, 0, 12) ||
    source.relationshipType !== 'REPORTING' ||
    typeof source.includePositions !== 'boolean'
  ) {
    throw new Error('Organization graph query is invalid.');
  }
  return Object.freeze({
    asOf: source.asOf,
    rootPublicId: source.rootPublicId.toLowerCase(),
    depth: source.depth,
    relationshipType: 'REPORTING',
    includePositions: source.includePositions,
  });
}

export function organizationGraphQueryString(
  request: OrganizationGraphWithPositionsV2Query
): string {
  const query = assertOrganizationGraphQuery(request);
  return new URLSearchParams({
    asOf: query.asOf,
    rootPublicId: query.rootPublicId,
    depth: String(query.depth),
    relationshipType: query.relationshipType,
    includePositions: String(query.includePositions),
  }).toString();
}

function selectNode(value: unknown, requestedDepth: number): OrganizationNodeV2 {
  const source = record(value);
  if (
    !source ||
    !hasOnlyKeys(source, NODE_KEYS) ||
    !['organizationPublicId', 'name', 'depth'].every((key) => key in source) ||
    typeof source.organizationPublicId !== 'string' ||
    !UUID_CANONICAL.test(source.organizationPublicId) ||
    (source.parentPublicId !== undefined &&
      source.parentPublicId !== null &&
      (typeof source.parentPublicId !== 'string' || !UUID_CANONICAL.test(source.parentPublicId))) ||
    !nonBlank(source.name) ||
    !integerInRange(source.depth, 0, requestedDepth)
  ) {
    throw new Error('Organization graph node is invalid.');
  }
  return Object.freeze({
    organizationPublicId: source.organizationPublicId,
    parentPublicId: typeof source.parentPublicId === 'string' ? source.parentPublicId : null,
    name: source.name,
    depth: source.depth,
  });
}

function selectPosition(value: unknown): OrganizationPositionV2 {
  const source = record(value);
  const required = [
    'positionPublicId',
    'positionKey',
    'title',
    'organizationPublicId',
    'status',
    'positionType',
    'criticality',
    'budgetedFte',
    'incumbentPersonPublicIds',
    'subordinatePositionCount',
  ];
  if (
    !source ||
    !hasOnlyKeys(source, POSITION_KEYS) ||
    !required.every((key) => key in source) ||
    typeof source.positionPublicId !== 'string' ||
    !UUID_CANONICAL.test(source.positionPublicId) ||
    typeof source.organizationPublicId !== 'string' ||
    !UUID_CANONICAL.test(source.organizationPublicId) ||
    (source.reportsToPositionPublicId !== undefined &&
      source.reportsToPositionPublicId !== null &&
      (typeof source.reportsToPositionPublicId !== 'string' ||
        !UUID_CANONICAL.test(source.reportsToPositionPublicId))) ||
    !nonBlank(source.positionKey, 128) ||
    !nonBlank(source.title) ||
    !nonBlank(source.status, 64) ||
    !nonBlank(source.positionType, 64) ||
    !nonBlank(source.criticality, 64) ||
    !finiteNonnegative(source.budgetedFte) ||
    (source.annualCostAmount !== undefined &&
      source.annualCostAmount !== null &&
      !finiteNonnegative(source.annualCostAmount)) ||
    (source.costCurrency !== undefined && !nullableString(source.costCurrency, 3)) ||
    (source.jobProfileName !== undefined && !nullableString(source.jobProfileName)) ||
    (source.locationName !== undefined && !nullableString(source.locationName)) ||
    (source.availabilityDate !== undefined &&
      source.availabilityDate !== null &&
      !validCivilDate(source.availabilityDate)) ||
    !Array.isArray(source.incumbentPersonPublicIds) ||
    source.incumbentPersonPublicIds.some(
      (id) => typeof id !== 'string' || !UUID_CANONICAL.test(id)
    ) ||
    !integerInRange(source.subordinatePositionCount, 0, Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error('Organization graph position is invalid.');
  }
  const incumbents = [...source.incumbentPersonPublicIds].sort(compareCodePoints);
  if (new Set(incumbents).size !== incumbents.length) {
    throw new Error('Organization graph position contains duplicate incumbents.');
  }
  return Object.freeze({
    positionPublicId: source.positionPublicId,
    positionKey: source.positionKey,
    title: source.title,
    organizationPublicId: source.organizationPublicId,
    reportsToPositionPublicId:
      typeof source.reportsToPositionPublicId === 'string'
        ? source.reportsToPositionPublicId
        : null,
    status: source.status,
    positionType: source.positionType,
    criticality: source.criticality,
    budgetedFte: source.budgetedFte,
    annualCostAmount: typeof source.annualCostAmount === 'number' ? source.annualCostAmount : null,
    costCurrency: typeof source.costCurrency === 'string' ? source.costCurrency : null,
    jobProfileName: typeof source.jobProfileName === 'string' ? source.jobProfileName : null,
    locationName: typeof source.locationName === 'string' ? source.locationName : null,
    availabilityDate: typeof source.availabilityDate === 'string' ? source.availabilityDate : null,
    incumbentPersonPublicIds: Object.freeze(incumbents),
    subordinatePositionCount: source.subordinatePositionCount,
  });
}

export function selectOrganizationGraphWithPositionsV2(
  value: unknown,
  requested: OrganizationGraphWithPositionsV2Query
): OrganizationGraphWithPositionsV2 {
  const request = assertOrganizationGraphQuery(requested);
  const source = record(value);
  if (
    !source ||
    !hasExactKeys(source, RESPONSE_KEYS) ||
    source.schemaVersion !== 2 ||
    !validInstant(source.asOf) ||
    !source.asOf.endsWith('Z') ||
    Date.parse(source.asOf) !== Date.parse(request.asOf) ||
    !validCivilDate(source.effectiveDate) ||
    source.effectiveDate !== new Date(source.asOf).toISOString().slice(0, 10) ||
    source.rootPublicId !== request.rootPublicId ||
    source.depth !== request.depth ||
    source.relationshipType !== 'REPORTING' ||
    source.positionsIncluded !== request.includePositions ||
    !Array.isArray(source.nodes) ||
    !Array.isArray(source.positions)
  ) {
    throw new Error('Organization graph response is invalid.');
  }

  const nodes = source.nodes.map((node) => selectNode(node, request.depth));
  const nodeIds = new Set(nodes.map((node) => node.organizationPublicId));
  if (nodeIds.size !== nodes.length) {
    throw new Error('Organization graph contains duplicate organizations.');
  }
  if (!nodeIds.has(request.rootPublicId)) {
    throw new Error('Organization graph root is invalid.');
  }
  for (const node of nodes) {
    if (node.organizationPublicId === request.rootPublicId) {
      if (node.depth !== 0 || node.parentPublicId !== null) {
        throw new Error('Organization graph root is invalid.');
      }
    } else if (node.parentPublicId === null || !nodeIds.has(node.parentPublicId)) {
      throw new Error('Organization graph parent is invalid.');
    }
  }

  const positions = source.positions.map(selectPosition);
  const positionIds = new Set(positions.map((position) => position.positionPublicId));
  if (positionIds.size !== positions.length) {
    throw new Error('Organization graph contains duplicate positions.');
  }
  for (const position of positions) {
    if (
      !nodeIds.has(position.organizationPublicId) ||
      (position.reportsToPositionPublicId !== null &&
        !positionIds.has(position.reportsToPositionPublicId))
    ) {
      throw new Error('Organization graph position ownership is invalid.');
    }
  }
  if (!request.includePositions && positions.length > 0) {
    throw new Error('Organization-only graph disclosed position data.');
  }

  nodes.sort(
    (left, right) =>
      left.depth - right.depth ||
      compareCodePoints(left.organizationPublicId, right.organizationPublicId)
  );
  positions.sort(
    (left, right) =>
      compareCodePoints(left.organizationPublicId, right.organizationPublicId) ||
      compareCodePoints(left.positionKey, right.positionKey) ||
      compareCodePoints(left.positionPublicId, right.positionPublicId)
  );
  return Object.freeze({
    schemaVersion: 2,
    asOf: source.asOf,
    effectiveDate: source.effectiveDate,
    rootPublicId: source.rootPublicId,
    depth: source.depth,
    relationshipType: 'REPORTING',
    positionsIncluded: source.positionsIncluded,
    nodes: Object.freeze(nodes),
    positions: Object.freeze(positions),
  });
}

function problemCode(details: unknown): string | undefined {
  const source = record(details);
  if (!source) return undefined;
  if (typeof source.code === 'string') return source.code;
  return problemCode(source.detail);
}

function failureReference(details: unknown): string | undefined {
  const source = record(details);
  if (!source) return undefined;
  for (const key of ['correlationId', 'requestId', 'traceId']) {
    if (nonBlank(source[key])) return source[key];
  }
  return failureReference(source.detail);
}

export function organizationGraphFailure(error: unknown): OrganizationGraphFailure {
  if (error instanceof HttpError) {
    const code = problemCode(error.details);
    const reference = failureReference(error.details);
    const withReference = <T extends OrganizationGraphFailureKind>(kind: T) => ({
      kind,
      ...(reference ? { reference } : {}),
    });
    if (error.status === 401 || error.status === 403 || code === 'OPAQUE_AUTHORIZATION_DENIED') {
      return withReference('PERMISSION_DENIED');
    }
    if (error.status === 404 || code === 'ORGANIZATION_GRAPH_NOT_FOUND') {
      return withReference('NOT_FOUND');
    }
    if (error.status === 409 || error.status === 412 || code?.includes('STALE')) {
      return withReference('STALE');
    }
    if (error.status === 422 || code === 'UNSUPPORTED_RELATIONSHIP_MODEL') {
      return withReference('UNSUPPORTED');
    }
    if (error.status === 400 || code === 'INVALID_ORGANIZATION_GRAPH_QUERY') {
      return withReference('INVALID_QUERY');
    }
    return withReference('UNAVAILABLE');
  }
  return { kind: 'UNAVAILABLE' };
}
