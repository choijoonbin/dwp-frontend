import {
  axiosInstance,
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  COMPENSATION_PLANNING_BASE_PATH,
  parseCompensationCycleCollection,
  parseCompensationCycleDetail,
  parseCompensationProposalCollection,
  parseCompensationProposalDetail,
  parseCompensationRichCommandResult,
  parseCompensationSnapshotPublished,
  parsePerformanceCommandReceipt,
} from './compensation-planning-contract';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type {
  ApproveCompensationPlanBody,
  CompensationBudgetBody,
  CompensationCycleCollection,
  CompensationCycleDetail,
  CompensationProposalCollection,
  CompensationProposalDetail,
  CompensationRichCommandResult,
  CompensationSnapshotPublished,
  CreateCompensationCycleBody,
  PerformanceCommandReceipt,
  PublishCompensationSnapshotBody,
  ReviseCompensationCycleBody,
  SubmitCompensationProposalBody,
  UpsertCompensationProposalBody,
} from './compensation-planning-contract';

export const COMPENSATION_PLANNING_API_OPERATIONS = Object.freeze({
  queryCycles: 'modern.compplan.cycles.query',
  queryCycle: 'modern.compplan.cycle.query',
  createCycle: 'modern.compplan.cycle.create',
  reviseCycle: 'modern.compplan.cycle.revise',
  allocateBudget: 'modern.compplan.budget.allocate',
  upsertProposal: 'modern.compplan.proposal.upsert',
  submitProposal: 'modern.compplan.proposal.submit',
  queryProposals: 'modern.compplan.proposals.query',
  queryProposal: 'modern.compplan.proposal.query',
  approvePlan: 'modern.compplan.plan.approve',
  publishSnapshot: 'modern.compplan.snapshot.publish',
  cancelCycle: 'modern.compplan.cycle.cancel',
} as const);

export type CompensationReadContext = Readonly<{
  correlationId: string;
  contextScopeKey?: string;
  signal?: AbortSignal;
}>;

export type CompensationCommandEnvelope<T> = Readonly<{
  correlationId: string;
  idempotencyKey: string;
  expectedVersion?: number;
  body: T;
}>;

export type CompensationCollectionQuery = Readonly<{
  asOf?: string | null;
  referenceEffectiveAt?: string | null;
  cursor?: string | null;
  limit?: number;
}>;

export type CompensationPlanningDataSource = Readonly<{
  cycles: (
    query: CompensationCollectionQuery,
    context: CompensationReadContext
  ) => Promise<CompensationCycleCollection>;
  cycle: (cycleId: string, context: CompensationReadContext) => Promise<CompensationCycleDetail>;
  proposals: (
    cycleId: string,
    query: CompensationCollectionQuery,
    context: CompensationReadContext
  ) => Promise<CompensationProposalCollection>;
  proposal: (
    proposalId: string,
    context: CompensationReadContext
  ) => Promise<CompensationProposalDetail>;
}>;

const correlationHeader = (correlationId: string) => ({
  'X-Correlation-ID': correlationId,
});

function readConfig(context: CompensationReadContext) {
  return {
    ...(productSurfaceReadScopeConfig(context.contextScopeKey, context.signal) ?? {}),
    headers: correlationHeader(context.correlationId),
  };
}

function queryString(query: CompensationCollectionQuery, anchorKey: 'asOf' | 'referenceEffectiveAt') {
  const params = new URLSearchParams();
  const anchor = anchorKey === 'asOf' ? query.asOf : query.referenceEffectiveAt;
  if (anchor) params.set(anchorKey, anchor);
  if (query.cursor) params.set('cursor', query.cursor);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export async function queryCompensationCycles(
  query: CompensationCollectionQuery,
  context: CompensationReadContext
): Promise<CompensationCycleCollection> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles${queryString(query, 'asOf')}`,
    readConfig(context)
  );
  return parseCompensationCycleCollection(response.data.data);
}

export async function queryCompensationCycle(
  cycleId: string,
  context: CompensationReadContext
): Promise<CompensationCycleDetail> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(cycleId)}`,
    readConfig(context)
  );
  return parseCompensationCycleDetail(response.data.data);
}

export async function queryCompensationProposals(
  cycleId: string,
  query: CompensationCollectionQuery,
  context: CompensationReadContext
): Promise<CompensationProposalCollection> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(
      cycleId
    )}/proposals${queryString(query, 'referenceEffectiveAt')}`,
    readConfig(context)
  );
  return parseCompensationProposalCollection(response.data.data);
}

export async function queryCompensationProposal(
  proposalId: string,
  context: CompensationReadContext
): Promise<CompensationProposalDetail> {
  const response = await axiosInstance.get<ApiResponse<unknown>>(
    `${COMPENSATION_PLANNING_BASE_PATH}/proposals/${encodeURIComponent(proposalId)}`,
    readConfig(context)
  );
  return parseCompensationProposalDetail(response.data.data);
}

function commandConfig<T>(
  envelope: CompensationCommandEnvelope<T>,
  authority: ProductSurfaceGovernedMutationAuthority,
  highRisk: boolean
) {
  if (
    authority.mode === 'SECURE' &&
    ((authority.idempotencyKey !== undefined &&
      authority.idempotencyKey !== envelope.idempotencyKey) ||
      (authority.objectVersion !== undefined &&
        envelope.expectedVersion !== undefined &&
        authority.objectVersion !== envelope.expectedVersion))
  ) {
    throw new Error('Compensation command authority does not match the sealed envelope.');
  }
  const governed = highRisk
    ? productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: true })
    : productSurfaceGovernedMutationConfig(authority);
  return {
    ...governed,
    headers: {
      ...governed.headers,
      ...correlationHeader(envelope.correlationId),
      'Idempotency-Key': envelope.idempotencyKey,
      ...(envelope.expectedVersion === undefined
        ? {}
        : { 'If-Match': String(envelope.expectedVersion) }),
    },
  };
}

async function post<TBody, TResult>(
  path: string,
  envelope: CompensationCommandEnvelope<TBody>,
  authority: ProductSurfaceGovernedMutationAuthority,
  parser: (value: unknown) => TResult,
  highRisk = false
): Promise<TResult> {
  const response = await axiosInstance.post<ApiResponse<unknown>>(
    path,
    envelope.body,
    commandConfig(envelope, authority, highRisk)
  );
  return parser(response.data.data);
}

export function createCompensationCycle(
  envelope: CompensationCommandEnvelope<CreateCompensationCycleBody>,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<PerformanceCommandReceipt> {
  if (envelope.expectedVersion !== undefined) {
    throw new Error('Cycle creation must not carry If-Match.');
  }
  return post(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles`,
    envelope,
    authority,
    parsePerformanceCommandReceipt
  );
}

export function reviseCompensationCycle(
  cycleId: string,
  envelope: CompensationCommandEnvelope<ReviseCompensationCycleBody>,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<CompensationRichCommandResult> {
  return post(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(cycleId)}/revisions`,
    requireVersion(envelope),
    authority,
    parseCompensationRichCommandResult
  );
}

export function allocateCompensationBudget(
  cycleId: string,
  envelope: CompensationCommandEnvelope<CompensationBudgetBody>,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<PerformanceCommandReceipt> {
  return post(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(
      cycleId
    )}/budget-allocations`,
    requireVersion(envelope),
    authority,
    parsePerformanceCommandReceipt
  );
}

export function upsertCompensationProposal(
  cycleId: string,
  proposalId: string,
  envelope: CompensationCommandEnvelope<UpsertCompensationProposalBody>,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<CompensationRichCommandResult> {
  return post(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(
      cycleId
    )}/proposals/${encodeURIComponent(proposalId)}`,
    requireVersion(envelope),
    authority,
    parseCompensationRichCommandResult
  );
}

export function submitCompensationProposal(
  cycleId: string,
  proposalId: string,
  envelope: CompensationCommandEnvelope<SubmitCompensationProposalBody>,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<PerformanceCommandReceipt> {
  return post(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(
      cycleId
    )}/proposals/${encodeURIComponent(proposalId)}/submit`,
    requireVersion(envelope),
    authority,
    parsePerformanceCommandReceipt
  );
}

export function approveCompensationPlan(
  cycleId: string,
  envelope: CompensationCommandEnvelope<ApproveCompensationPlanBody>,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<PerformanceCommandReceipt> {
  return post(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(cycleId)}/approve`,
    requireVersion(envelope),
    authority,
    parsePerformanceCommandReceipt,
    true
  );
}

export function publishCompensationSnapshot(
  cycleId: string,
  envelope: CompensationCommandEnvelope<PublishCompensationSnapshotBody>,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<CompensationSnapshotPublished> {
  return post(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(
      cycleId
    )}/approved-snapshots`,
    requireVersion(envelope),
    authority,
    parseCompensationSnapshotPublished,
    true
  );
}

export function cancelCompensationCycle(
  cycleId: string,
  envelope: CompensationCommandEnvelope<Record<string, never>>,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<CompensationRichCommandResult> {
  if (Object.keys(envelope.body).length !== 0) {
    throw new Error('Cycle cancellation has an empty closed body.');
  }
  return post(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(cycleId)}/cancel`,
    requireVersion(envelope),
    authority,
    parseCompensationRichCommandResult
  );
}

function requireVersion<T>(
  envelope: CompensationCommandEnvelope<T>
): CompensationCommandEnvelope<T> & Readonly<{ expectedVersion: number }> {
  if (
    envelope.expectedVersion === undefined ||
    !Number.isSafeInteger(envelope.expectedVersion) ||
    envelope.expectedVersion < 0
  ) {
    throw new Error('Compensation command requires a nonnegative If-Match version.');
  }
  return envelope as CompensationCommandEnvelope<T> & Readonly<{ expectedVersion: number }>;
}

export const compensationPlanningDataSource: CompensationPlanningDataSource = Object.freeze({
  cycles: queryCompensationCycles,
  cycle: queryCompensationCycle,
  proposals: queryCompensationProposals,
  proposal: queryCompensationProposal,
});
