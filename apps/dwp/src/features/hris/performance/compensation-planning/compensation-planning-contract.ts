import { Temporal } from 'temporal-polyfill';

export const COMPENSATION_PLANNING_ROUTE =
  '/hr/operations/performance/compensation-planning' as const;
export const COMPENSATION_PLANNING_PAGE_ROUTE_CONTRACT =
  'route.hcm.operations.compensation-planning.page' as const;
export const COMPENSATION_PLANNING_VIEW_CAPABILITY = 'hcm.compensation.plan.view' as const;

export const COMPENSATION_PLANNING_BASE_PATH =
  '/api/people/v1/hris/performance/compensation-planning' as const;

export const COMPENSATION_CYCLE_STATUSES = [
  'DRAFT',
  'OPEN',
  'PROPOSAL_REVIEW',
  'APPROVED',
  'PUBLISHED',
  'CANCELLED',
] as const;
export type CompensationCycleStatus = (typeof COMPENSATION_CYCLE_STATUSES)[number];

export const COMPENSATION_PROPOSAL_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'FROZEN',
  'CANCELLED',
] as const;
export type CompensationProposalStatus = (typeof COMPENSATION_PROPOSAL_STATUSES)[number];

export type PostedMoney = string;

export type CompensationGuideline = Readonly<{
  componentCode: string;
  currency: string;
  minimumAmount: PostedMoney;
  maximumAmount: PostedMoney;
  exceptionPolicyCode: string;
  roundingPolicyVersionPublicId: string;
}>;

export type CompensationGuidelines = Readonly<{
  components: readonly CompensationGuideline[];
  budgetMode: 'HARD_CAP';
  effectiveFrom: string;
  effectiveTo: string | null;
}>;

export type CompensationPopulationLine = Readonly<{
  workerPublicId: string;
  assignmentPublicId: string;
  organizationPublicId: string;
  gradePublicId: string | null;
  jobProfilePublicId: string | null;
  assignmentOwnerRevision: number;
  eligibleComponentCodes: readonly string[];
}>;

export type CompensationPopulation = Readonly<{
  asOf: string;
  hrmOwnerRevision: number;
  lines: readonly CompensationPopulationLine[];
}>;

export type CompensationProposalContent = Readonly<{
  cyclePublicId: string;
  workerPublicId: string;
  assignmentPublicId: string;
  componentCode: string;
  currency: string;
  amount: PostedMoney;
  effectiveFrom: string;
  effectiveTo: string | null;
  exceptionReasonCode: null;
  supersedesProposalPublicId: string | null;
}>;

export type CompensationBudgetEntry = Readonly<{
  entryId: string;
  entrySequence: number;
  organizationPublicId: string;
  currency: string;
  amount: PostedMoney;
  entryType: 'ALLOCATE' | 'REVERSE';
  sourceEntryPublicId: string | null;
  createdAt: string;
}>;

export type CompensationBudgetAggregate = Readonly<{
  organizationPublicId: string;
  currency: string;
  allocatedAmount: PostedMoney;
  committedAmount: PostedMoney;
  remainingAmount: PostedMoney;
}>;

export type CompensationCycle = Readonly<{
  cycleId: string;
  aggregateVersion: number;
  cycleCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: CompensationCycleStatus;
  budgetMasked: boolean;
  guidelines?: CompensationGuidelines;
  population?: CompensationPopulation;
  budgetEntries?: readonly CompensationBudgetEntry[];
  budgetAggregates?: readonly CompensationBudgetAggregate[];
}>;

export type CompensationProposal = Readonly<{
  proposalId: string;
  aggregateVersion: number;
  cycleId: string;
  workerId: string;
  assignmentId: string;
  componentCode: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  currentRevision: number;
  status: CompensationProposalStatus;
  contentDigest: string;
  amountMasked: boolean;
  amount?: PostedMoney;
  content?: CompensationProposalContent;
}>;

export type CompensationCycleCollection = Readonly<{
  items: readonly CompensationCycle[];
  nextCursor: string | null;
  hasMore: boolean;
  asOf: string;
  scopeRevision: number;
  fieldPolicyRevision: number;
}>;

export type CompensationCycleDetail = Readonly<{
  item: CompensationCycle;
  referenceEffectiveAt: string;
  freshnessWatermark: string;
  fieldPolicyRevision: number;
}>;

export type CompensationProposalCollection = Readonly<{
  items: readonly CompensationProposal[];
  nextCursor: string | null;
  hasMore: boolean;
  referenceEffectiveAt: string;
  freshnessWatermark: string;
  fieldPolicyRevision: number;
}>;

export type CompensationProposalDetail = Readonly<{
  item: CompensationProposal;
  referenceEffectiveAt: string;
  freshnessWatermark: string;
  fieldPolicyRevision: number;
}>;

export type PerformanceCommandReceipt = Readonly<{
  receiptId: string;
  status: 'ACCEPTED' | 'COMPLETED' | 'REJECTED' | 'RESULT_UNKNOWN';
  aggregateId?: string;
  aggregateVersion?: number;
  correlationId: string;
  occurredAt: string;
  payloadDigest: string;
}>;

export type CompensationTypedChild = Readonly<{
  entityType: string;
  publicId: string;
  aggregateVersion: number;
  ordinal: number;
  resultDigest: string;
}>;

export type CompensationRichCommandResult = Readonly<{
  commandReceiptId: string;
  status: 'ACCEPTED' | 'COMPLETED';
  correlationId: string;
  completedAt: string;
  resultDigest: string;
  aggregatePublicId: string;
  aggregateVersion: number;
  childResults: readonly CompensationTypedChild[];
}>;

export type CompensationSnapshotPublished = Readonly<{
  approvalReceiptId: string;
  cycleId: string;
  snapshotId: string;
  snapshotRevision: number;
  sourceVersion: number;
  aggregateVersion: number;
  lineCount: number;
  payloadDigest: string;
  correlationId: string;
  publishedAt: string;
}>;

export type CompensationCommandResult =
  PerformanceCommandReceipt | CompensationRichCommandResult | CompensationSnapshotPublished;

export type HrmSourceSnapshotRef = Readonly<{
  snapshotPublicId: string;
  ownerRevision: number;
  projectionSchemaId: 'CompensationPopulationContent.v1';
  asOf: string;
  sha256: string;
  purposeCode: 'HRIS_PER_COMPENSATION_POPULATION';
}>;

/** Central-projected authoring evidence. UI code must never fabricate these values. */
export type CompensationCycleAuthoringContext = Readonly<{
  guidelines: CompensationGuidelines;
  population: CompensationPopulation;
  populationSourceRef: HrmSourceSnapshotRef;
}>;

export type CreateCompensationCycleBody = Readonly<{
  cycleCode: string;
  guidelines: CompensationGuidelines;
  population: CompensationPopulation;
  effectiveFrom: string;
  effectiveTo: string | null;
  populationSourceRef: HrmSourceSnapshotRef;
}>;

export type ReviseCompensationCycleBody = Readonly<{
  guidelines: CompensationGuidelines;
  population: CompensationPopulation;
  populationSourceRef: HrmSourceSnapshotRef;
  effectiveFrom: string;
  effectiveTo: string | null;
}>;

export type CompensationBudgetBody = Readonly<{
  organizationPublicId: string;
  amount: PostedMoney;
  currency: string;
  ledgerEntryType: 'ALLOCATE' | 'REVERSE';
  reversesEntryPublicId?: string | null;
}>;

export type UpsertCompensationProposalBody = Readonly<{
  content: CompensationProposalContent;
}>;

export type SubmitCompensationProposalBody = Readonly<{
  submissionDigest: string;
  effectiveDate?: string | null;
}>;

export type ApproveCompensationPlanBody = Readonly<{
  decision: 'APPROVE';
  reasonCode: string;
}>;

export type PublishCompensationSnapshotBody = Readonly<{
  approvalReceiptId: string;
}>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA_256 = /^[0-9a-f]{64}$/;
const CODE = /^[A-Z0-9][A-Z0-9._-]{0,79}$/;
const CURRENCY = /^[A-Z]{3}$/;
const MONEY = /^(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{0,3}[1-9])?$/;

function invalid(): never {
  throw new Error('Compensation-planning contract payload is invalid.');
}

function record(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = []
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  const source = value as Record<string, unknown>;
  if (required.some((key) => !Object.prototype.hasOwnProperty.call(source, key))) return invalid();
  const allowed = new Set([...required, ...optional]);
  if (Object.keys(source).some((key) => !allowed.has(key))) return invalid();
  return source;
}

function text(value: unknown, maximum: number, pattern?: RegExp): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximum ||
    value !== value.trim() ||
    (pattern && !pattern.test(value))
  ) {
    return invalid();
  }
  return value;
}

function uuid(value: unknown): string {
  return text(value, 36, UUID);
}

function digest(value: unknown): string {
  return text(value, 64, SHA_256);
}

function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : invalid();
}

function bool(value: unknown): boolean {
  return typeof value === 'boolean' ? value : invalid();
}

function instant(value: unknown): string {
  const candidate = text(value, 100);
  try {
    Temporal.Instant.from(candidate);
    return candidate;
  } catch {
    return invalid();
  }
}

function date(value: unknown): string {
  const candidate = text(value, 10);
  try {
    if (Temporal.PlainDate.from(candidate).toString() !== candidate) return invalid();
    return candidate;
  } catch {
    return invalid();
  }
}

function nullableDate(value: unknown): string | null {
  return value === null ? null : date(value);
}

function money(value: unknown): PostedMoney {
  return text(value, 20, MONEY);
}

function values<T extends string>(value: unknown, allowed: readonly T[]): T {
  return typeof value === 'string' && allowed.includes(value as T) ? (value as T) : invalid();
}

function array(value: unknown, maximum = 100_000): unknown[] {
  return Array.isArray(value) && value.length <= maximum ? value : invalid();
}

function guideline(value: unknown): CompensationGuideline {
  const source = record(value, [
    'componentCode',
    'currency',
    'minimumAmount',
    'maximumAmount',
    'exceptionPolicyCode',
    'roundingPolicyVersionPublicId',
  ]);
  return Object.freeze({
    componentCode: text(source.componentCode, 40, CODE),
    currency: text(source.currency, 3, CURRENCY),
    minimumAmount: money(source.minimumAmount),
    maximumAmount: money(source.maximumAmount),
    exceptionPolicyCode: text(source.exceptionPolicyCode, 80, CODE),
    roundingPolicyVersionPublicId: uuid(source.roundingPolicyVersionPublicId),
  });
}

function guidelines(value: unknown): CompensationGuidelines {
  const source = record(value, ['components', 'budgetMode', 'effectiveFrom', 'effectiveTo']);
  if (source.budgetMode !== 'HARD_CAP') return invalid();
  const components = array(source.components, 1_000).map(guideline);
  if (components.length === 0) return invalid();
  return Object.freeze({
    components: Object.freeze(components),
    budgetMode: 'HARD_CAP',
    effectiveFrom: date(source.effectiveFrom),
    effectiveTo: nullableDate(source.effectiveTo),
  });
}

function populationLine(value: unknown): CompensationPopulationLine {
  const source = record(value, [
    'workerPublicId',
    'assignmentPublicId',
    'organizationPublicId',
    'gradePublicId',
    'jobProfilePublicId',
    'assignmentOwnerRevision',
    'eligibleComponentCodes',
  ]);
  const components = array(source.eligibleComponentCodes, 1_000).map((item) =>
    text(item, 40, CODE)
  );
  if (components.length === 0 || new Set(components).size !== components.length) return invalid();
  return Object.freeze({
    workerPublicId: uuid(source.workerPublicId),
    assignmentPublicId: uuid(source.assignmentPublicId),
    organizationPublicId: uuid(source.organizationPublicId),
    gradePublicId: source.gradePublicId === null ? null : uuid(source.gradePublicId),
    jobProfilePublicId: source.jobProfilePublicId === null ? null : uuid(source.jobProfilePublicId),
    assignmentOwnerRevision: integer(source.assignmentOwnerRevision, 1),
    eligibleComponentCodes: Object.freeze(components),
  });
}

function population(value: unknown): CompensationPopulation {
  const source = record(value, ['asOf', 'hrmOwnerRevision', 'lines']);
  const lines = array(source.lines).map(populationLine);
  if (lines.length === 0) return invalid();
  return Object.freeze({
    asOf: instant(source.asOf),
    hrmOwnerRevision: integer(source.hrmOwnerRevision, 1),
    lines: Object.freeze(lines),
  });
}

function proposalContent(value: unknown): CompensationProposalContent {
  const source = record(value, [
    'cyclePublicId',
    'workerPublicId',
    'assignmentPublicId',
    'componentCode',
    'currency',
    'amount',
    'effectiveFrom',
    'effectiveTo',
    'exceptionReasonCode',
    'supersedesProposalPublicId',
  ]);
  if (source.exceptionReasonCode !== null) return invalid();
  return Object.freeze({
    cyclePublicId: uuid(source.cyclePublicId),
    workerPublicId: uuid(source.workerPublicId),
    assignmentPublicId: uuid(source.assignmentPublicId),
    componentCode: text(source.componentCode, 40, CODE),
    currency: text(source.currency, 3, CURRENCY),
    amount: money(source.amount),
    effectiveFrom: date(source.effectiveFrom),
    effectiveTo: nullableDate(source.effectiveTo),
    exceptionReasonCode: null,
    supersedesProposalPublicId:
      source.supersedesProposalPublicId === null ? null : uuid(source.supersedesProposalPublicId),
  });
}

function populationSourceRef(value: unknown): HrmSourceSnapshotRef {
  const source = record(value, [
    'snapshotPublicId',
    'ownerRevision',
    'projectionSchemaId',
    'asOf',
    'sha256',
    'purposeCode',
  ]);
  if (
    source.projectionSchemaId !== 'CompensationPopulationContent.v1' ||
    source.purposeCode !== 'HRIS_PER_COMPENSATION_POPULATION'
  ) {
    return invalid();
  }
  return Object.freeze({
    snapshotPublicId: uuid(source.snapshotPublicId),
    ownerRevision: integer(source.ownerRevision, 1),
    projectionSchemaId: 'CompensationPopulationContent.v1',
    asOf: instant(source.asOf),
    sha256: digest(source.sha256),
    purposeCode: 'HRIS_PER_COMPENSATION_POPULATION',
  });
}

export function parseCompensationCycleAuthoringContext(
  value: unknown
): CompensationCycleAuthoringContext {
  const source = record(value, ['guidelines', 'population', 'populationSourceRef']);
  const parsedGuidelines = guidelines(source.guidelines);
  const parsedPopulation = population(source.population);
  const parsedSourceRef = populationSourceRef(source.populationSourceRef);
  const componentCodes = parsedGuidelines.components.map((item) => item.componentCode);
  const availableComponents = new Set(componentCodes);
  if (
    componentCodes.length !== availableComponents.size ||
    parsedPopulation.asOf !== parsedSourceRef.asOf ||
    parsedPopulation.hrmOwnerRevision !== parsedSourceRef.ownerRevision ||
    parsedPopulation.lines.some((line) =>
      line.eligibleComponentCodes.some((code) => !availableComponents.has(code))
    )
  ) {
    return invalid();
  }
  return Object.freeze({
    guidelines: parsedGuidelines,
    population: parsedPopulation,
    populationSourceRef: parsedSourceRef,
  });
}

export function parseCreateCompensationCycleBody(value: unknown): CreateCompensationCycleBody {
  const source = record(value, [
    'cycleCode',
    'guidelines',
    'population',
    'effectiveFrom',
    'effectiveTo',
    'populationSourceRef',
  ]);
  return Object.freeze({
    cycleCode: text(source.cycleCode, 40, CODE),
    guidelines: guidelines(source.guidelines),
    population: population(source.population),
    effectiveFrom: date(source.effectiveFrom),
    effectiveTo: nullableDate(source.effectiveTo),
    populationSourceRef: populationSourceRef(source.populationSourceRef),
  });
}

export function parseReviseCompensationCycleBody(value: unknown): ReviseCompensationCycleBody {
  const source = record(value, [
    'guidelines',
    'population',
    'populationSourceRef',
    'effectiveFrom',
    'effectiveTo',
  ]);
  return Object.freeze({
    guidelines: guidelines(source.guidelines),
    population: population(source.population),
    populationSourceRef: populationSourceRef(source.populationSourceRef),
    effectiveFrom: date(source.effectiveFrom),
    effectiveTo: nullableDate(source.effectiveTo),
  });
}

export function parseCompensationBudgetBody(value: unknown): CompensationBudgetBody {
  const source = record(
    value,
    ['organizationPublicId', 'amount', 'currency', 'ledgerEntryType'],
    ['reversesEntryPublicId']
  );
  const ledgerEntryType = values(source.ledgerEntryType, ['ALLOCATE', 'REVERSE'] as const);
  const reversesEntryPublicId =
    source.reversesEntryPublicId === undefined || source.reversesEntryPublicId === null
      ? null
      : uuid(source.reversesEntryPublicId);
  if ((ledgerEntryType === 'REVERSE') !== (reversesEntryPublicId !== null)) return invalid();
  return Object.freeze({
    organizationPublicId: uuid(source.organizationPublicId),
    amount: money(source.amount),
    currency: text(source.currency, 3, CURRENCY),
    ledgerEntryType,
    reversesEntryPublicId,
  });
}

export function parseUpsertCompensationProposalBody(
  value: unknown
): UpsertCompensationProposalBody {
  const source = record(value, ['content']);
  return Object.freeze({ content: proposalContent(source.content) });
}

export function parseSubmitCompensationProposalBody(
  value: unknown
): SubmitCompensationProposalBody {
  const source = record(value, ['submissionDigest'], ['effectiveDate']);
  return Object.freeze({
    submissionDigest: digest(source.submissionDigest),
    ...(source.effectiveDate === undefined
      ? {}
      : { effectiveDate: source.effectiveDate === null ? null : date(source.effectiveDate) }),
  });
}

export function parseApproveCompensationPlanBody(value: unknown): ApproveCompensationPlanBody {
  const source = record(value, ['decision', 'reasonCode']);
  if (source.decision !== 'APPROVE') return invalid();
  return Object.freeze({
    decision: 'APPROVE',
    reasonCode: text(source.reasonCode, 80, CODE),
  });
}

export function parsePublishCompensationSnapshotBody(
  value: unknown
): PublishCompensationSnapshotBody {
  const source = record(value, ['approvalReceiptId']);
  return Object.freeze({ approvalReceiptId: uuid(source.approvalReceiptId) });
}

export function parseCancelCompensationCycleBody(value: unknown): Record<string, never> {
  record(value, []);
  return Object.freeze({});
}

function budgetEntry(value: unknown): CompensationBudgetEntry {
  const source = record(value, [
    'entryId',
    'entrySequence',
    'organizationPublicId',
    'currency',
    'amount',
    'entryType',
    'sourceEntryPublicId',
    'createdAt',
  ]);
  const entryType = values(source.entryType, ['ALLOCATE', 'REVERSE'] as const);
  const sourceEntryPublicId =
    source.sourceEntryPublicId === null ? null : uuid(source.sourceEntryPublicId);
  if ((entryType === 'ALLOCATE') === (sourceEntryPublicId !== null)) return invalid();
  return Object.freeze({
    entryId: uuid(source.entryId),
    entrySequence: integer(source.entrySequence, 1),
    organizationPublicId: uuid(source.organizationPublicId),
    currency: text(source.currency, 3, CURRENCY),
    amount: money(source.amount),
    entryType,
    sourceEntryPublicId,
    createdAt: instant(source.createdAt),
  });
}

function budgetAggregate(value: unknown): CompensationBudgetAggregate {
  const source = record(value, [
    'organizationPublicId',
    'currency',
    'allocatedAmount',
    'committedAmount',
    'remainingAmount',
  ]);
  return Object.freeze({
    organizationPublicId: uuid(source.organizationPublicId),
    currency: text(source.currency, 3, CURRENCY),
    allocatedAmount: money(source.allocatedAmount),
    committedAmount: money(source.committedAmount),
    remainingAmount: money(source.remainingAmount),
  });
}

function cycle(value: unknown, detail: boolean): CompensationCycle {
  const required = [
    'cycleId',
    'aggregateVersion',
    'cycleCode',
    'effectiveFrom',
    'effectiveTo',
    'status',
    'budgetMasked',
  ];
  const source = record(
    value,
    required,
    detail ? ['guidelines', 'population', 'budgetEntries', 'budgetAggregates'] : []
  );
  const budgetMasked = bool(source.budgetMasked);
  if (
    budgetMasked &&
    (source.budgetEntries !== undefined || source.budgetAggregates !== undefined)
  ) {
    return invalid();
  }
  const budgetAggregates =
    source.budgetAggregates === undefined
      ? undefined
      : array(source.budgetAggregates).map(budgetAggregate);
  for (let index = 1; index < (budgetAggregates?.length ?? 0); index += 1) {
    const previous = budgetAggregates?.[index - 1];
    const aggregate = budgetAggregates?.[index];
    if (!previous || !aggregate) return invalid();
    const previousKey = `${previous.organizationPublicId}:${previous.currency}`;
    const key = `${aggregate.organizationPublicId}:${aggregate.currency}`;
    if (key <= previousKey) invalid();
  }
  return Object.freeze({
    cycleId: uuid(source.cycleId),
    aggregateVersion: integer(source.aggregateVersion, 1),
    cycleCode: text(source.cycleCode, 40, CODE),
    effectiveFrom: date(source.effectiveFrom),
    effectiveTo: nullableDate(source.effectiveTo),
    status: values(source.status, COMPENSATION_CYCLE_STATUSES),
    budgetMasked,
    ...(source.guidelines === undefined ? {} : { guidelines: guidelines(source.guidelines) }),
    ...(source.population === undefined ? {} : { population: population(source.population) }),
    ...(source.budgetEntries === undefined
      ? {}
      : { budgetEntries: Object.freeze(array(source.budgetEntries).map(budgetEntry)) }),
    ...(budgetAggregates === undefined
      ? {}
      : { budgetAggregates: Object.freeze(budgetAggregates) }),
  });
}

function proposal(value: unknown, detail: boolean): CompensationProposal {
  const source = record(
    value,
    [
      'proposalId',
      'aggregateVersion',
      'cycleId',
      'workerId',
      'assignmentId',
      'componentCode',
      'currency',
      'effectiveFrom',
      'effectiveTo',
      'currentRevision',
      'status',
      'contentDigest',
      'amountMasked',
    ],
    detail ? ['amount', 'content'] : []
  );
  const amountMasked = bool(source.amountMasked);
  if (amountMasked && (source.amount !== undefined || source.content !== undefined))
    return invalid();
  return Object.freeze({
    proposalId: uuid(source.proposalId),
    aggregateVersion: integer(source.aggregateVersion, 1),
    cycleId: uuid(source.cycleId),
    workerId: uuid(source.workerId),
    assignmentId: uuid(source.assignmentId),
    componentCode: text(source.componentCode, 40, CODE),
    currency: text(source.currency, 3, CURRENCY),
    effectiveFrom: date(source.effectiveFrom),
    effectiveTo: nullableDate(source.effectiveTo),
    currentRevision: integer(source.currentRevision, 1),
    status: values(source.status, COMPENSATION_PROPOSAL_STATUSES),
    contentDigest: digest(source.contentDigest),
    amountMasked,
    ...(source.amount === undefined ? {} : { amount: money(source.amount) }),
    ...(source.content === undefined ? {} : { content: proposalContent(source.content) }),
  });
}

function cursorInvariant(nextCursor: unknown, hasMore: boolean): string | null {
  const cursor = nextCursor === null ? null : text(nextCursor, 2_048);
  return (hasMore && cursor !== null) || (!hasMore && cursor === null) ? cursor : invalid();
}

export function parseCompensationCycleCollection(value: unknown): CompensationCycleCollection {
  const source = record(value, [
    'items',
    'nextCursor',
    'hasMore',
    'asOf',
    'scopeRevision',
    'fieldPolicyRevision',
  ]);
  const hasMore = bool(source.hasMore);
  return Object.freeze({
    items: Object.freeze(array(source.items).map((item) => cycle(item, false))),
    nextCursor: cursorInvariant(source.nextCursor, hasMore),
    hasMore,
    asOf: instant(source.asOf),
    scopeRevision: integer(source.scopeRevision, 1),
    fieldPolicyRevision: integer(source.fieldPolicyRevision, 1),
  });
}

export function parseCompensationCycleDetail(value: unknown): CompensationCycleDetail {
  const source = record(value, [
    'item',
    'referenceEffectiveAt',
    'freshnessWatermark',
    'fieldPolicyRevision',
  ]);
  return Object.freeze({
    item: cycle(source.item, true),
    referenceEffectiveAt: instant(source.referenceEffectiveAt),
    freshnessWatermark: instant(source.freshnessWatermark),
    fieldPolicyRevision: integer(source.fieldPolicyRevision, 1),
  });
}

export function parseCompensationProposalCollection(
  value: unknown
): CompensationProposalCollection {
  const source = record(value, [
    'items',
    'nextCursor',
    'hasMore',
    'referenceEffectiveAt',
    'freshnessWatermark',
    'fieldPolicyRevision',
  ]);
  const hasMore = bool(source.hasMore);
  return Object.freeze({
    items: Object.freeze(array(source.items).map((item) => proposal(item, false))),
    nextCursor: cursorInvariant(source.nextCursor, hasMore),
    hasMore,
    referenceEffectiveAt: instant(source.referenceEffectiveAt),
    freshnessWatermark: instant(source.freshnessWatermark),
    fieldPolicyRevision: integer(source.fieldPolicyRevision, 1),
  });
}

export function parseCompensationProposalDetail(value: unknown): CompensationProposalDetail {
  const source = record(value, [
    'item',
    'referenceEffectiveAt',
    'freshnessWatermark',
    'fieldPolicyRevision',
  ]);
  return Object.freeze({
    item: proposal(source.item, true),
    referenceEffectiveAt: instant(source.referenceEffectiveAt),
    freshnessWatermark: instant(source.freshnessWatermark),
    fieldPolicyRevision: integer(source.fieldPolicyRevision, 1),
  });
}

export function parsePerformanceCommandReceipt(value: unknown): PerformanceCommandReceipt {
  const source = record(
    value,
    ['receiptId', 'status', 'correlationId', 'occurredAt', 'payloadDigest'],
    ['aggregateId', 'aggregateVersion']
  );
  return Object.freeze({
    receiptId: uuid(source.receiptId),
    status: values(source.status, ['ACCEPTED', 'COMPLETED', 'REJECTED', 'RESULT_UNKNOWN'] as const),
    ...(source.aggregateId === undefined ? {} : { aggregateId: uuid(source.aggregateId) }),
    ...(source.aggregateVersion === undefined
      ? {}
      : { aggregateVersion: integer(source.aggregateVersion) }),
    correlationId: uuid(source.correlationId),
    occurredAt: instant(source.occurredAt),
    payloadDigest: digest(source.payloadDigest),
  });
}

function typedChild(value: unknown): CompensationTypedChild {
  const source = record(value, [
    'entityType',
    'publicId',
    'aggregateVersion',
    'ordinal',
    'resultDigest',
  ]);
  return Object.freeze({
    entityType: text(source.entityType, 100, CODE),
    publicId: uuid(source.publicId),
    aggregateVersion: integer(source.aggregateVersion, 1),
    ordinal: integer(source.ordinal, 1, 100_000),
    resultDigest: digest(source.resultDigest),
  });
}

export function parseCompensationRichCommandResult(value: unknown): CompensationRichCommandResult {
  const source = record(value, [
    'commandReceiptId',
    'status',
    'correlationId',
    'completedAt',
    'resultDigest',
    'aggregatePublicId',
    'aggregateVersion',
    'childResults',
  ]);
  const children = array(source.childResults).map(typedChild);
  children.forEach((child, index) => {
    if (child.ordinal !== index + 1) invalid();
  });
  return Object.freeze({
    commandReceiptId: uuid(source.commandReceiptId),
    status: values(source.status, ['ACCEPTED', 'COMPLETED'] as const),
    correlationId: uuid(source.correlationId),
    completedAt: instant(source.completedAt),
    resultDigest: digest(source.resultDigest),
    aggregatePublicId: uuid(source.aggregatePublicId),
    aggregateVersion: integer(source.aggregateVersion, 1),
    childResults: Object.freeze(children),
  });
}

export function parseCompensationSnapshotPublished(value: unknown): CompensationSnapshotPublished {
  const source = record(value, [
    'approvalReceiptId',
    'cycleId',
    'snapshotId',
    'snapshotRevision',
    'sourceVersion',
    'aggregateVersion',
    'lineCount',
    'payloadDigest',
    'correlationId',
    'publishedAt',
  ]);
  return Object.freeze({
    approvalReceiptId: uuid(source.approvalReceiptId),
    cycleId: uuid(source.cycleId),
    snapshotId: uuid(source.snapshotId),
    snapshotRevision: integer(source.snapshotRevision, 1),
    sourceVersion: integer(source.sourceVersion, 1),
    aggregateVersion: integer(source.aggregateVersion, 1),
    lineCount: integer(source.lineCount, 1, 100_000),
    payloadDigest: digest(source.payloadDigest),
    correlationId: uuid(source.correlationId),
    publishedAt: instant(source.publishedAt),
  });
}
