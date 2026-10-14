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
  parseApproveCompensationPlanBody,
  parseCancelCompensationCycleBody,
  parseCompensationBudgetBody,
  parseCompensationProposalCollection,
  parseCompensationProposalDetail,
  parseCompensationRichCommandResult,
  parseCompensationSnapshotPublished,
  parseCreateCompensationCycleBody,
  parsePerformanceCommandReceipt,
  parsePublishCompensationSnapshotBody,
  parseReviseCompensationCycleBody,
  parseSubmitCompensationProposalBody,
  parseUpsertCompensationProposalBody,
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

export const COMPENSATION_PLANNING_READ_API_CONTRACTS = [
  {
    apiFunction: 'queryCompensationCycles',
    routeContractKey: 'route.hcm.operations.compensation-planning.page',
    method: 'GET',
    path: `${COMPENSATION_PLANNING_BASE_PATH}/cycles`,
  },
  {
    apiFunction: 'queryCompensationCycle',
    routeContractKey: 'route.hcm.operations.compensation-cycle-detail.data',
    method: 'GET',
    path: `${COMPENSATION_PLANNING_BASE_PATH}/cycles/{cycleId}`,
  },
  {
    apiFunction: 'queryCompensationProposals',
    routeContractKey: 'route.hcm.operations.compensation-proposals.data',
    method: 'GET',
    path: `${COMPENSATION_PLANNING_BASE_PATH}/cycles/{cycleId}/proposals`,
  },
  {
    apiFunction: 'queryCompensationProposal',
    routeContractKey: 'route.hcm.operations.compensation-proposal-detail.data',
    method: 'GET',
    path: `${COMPENSATION_PLANNING_BASE_PATH}/proposals/{proposalId}`,
  },
] as const;

export const COMPENSATION_PLANNING_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'createCompensationCycle',
    routeContractKey: 'route.hcm.operations.compensation-cycle-create.action',
    method: 'POST',
    path: `${COMPENSATION_PLANNING_BASE_PATH}/cycles`,
  },
  {
    apiFunction: 'reviseCompensationCycle',
    routeContractKey: 'route.hcm.operations.compensation-cycle-revise.action',
    method: 'POST',
    path: `${COMPENSATION_PLANNING_BASE_PATH}/cycles/{cycleId}/revisions`,
  },
  {
    apiFunction: 'allocateCompensationBudget',
    routeContractKey: 'route.hcm.operations.compensation-budget-allocate.action',
    method: 'POST',
    path: `${COMPENSATION_PLANNING_BASE_PATH}/cycles/{cycleId}/budget-allocations`,
  },
  {
    apiFunction: 'upsertCompensationProposal',
    routeContractKey: 'route.hcm.operations.compensation-proposal-upsert.action',
    method: 'POST',
    path: `${COMPENSATION_PLANNING_BASE_PATH}/cycles/{cycleId}/proposals/{proposalId}`,
  },
  {
    apiFunction: 'submitCompensationProposal',
    routeContractKey: 'route.hcm.operations.compensation-proposal-submit.action',
    method: 'POST',
    path: `${COMPENSATION_PLANNING_BASE_PATH}/cycles/{cycleId}/proposals/{proposalId}/submit`,
  },
  {
    apiFunction: 'approveCompensationPlan',
    routeContractKey: 'route.hcm.operations.compensation-plan-approve.action',
    method: 'POST',
    path: `${COMPENSATION_PLANNING_BASE_PATH}/cycles/{cycleId}/approve`,
  },
  {
    apiFunction: 'publishCompensationSnapshot',
    routeContractKey: 'route.hcm.operations.compensation-snapshot-publish.action',
    method: 'POST',
    path: `${COMPENSATION_PLANNING_BASE_PATH}/cycles/{cycleId}/approved-snapshots`,
  },
  {
    apiFunction: 'cancelCompensationCycle',
    routeContractKey: 'route.hcm.operations.compensation-cycle-cancel.action',
    method: 'POST',
    path: `${COMPENSATION_PLANNING_BASE_PATH}/cycles/{cycleId}/cancel`,
  },
] as const;

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

export const COMPENSATION_PLANNING_PROJECTION_VERSION_HEADER =
  'X-HRIS-Compplan-Projection-Version';
export const COMPENSATION_PLANNING_PROJECTION_VERSION = '5';

function readConfig(context: CompensationReadContext) {
  return {
    ...(productSurfaceReadScopeConfig(context.contextScopeKey, context.signal) ?? {}),
    headers: correlationHeader(context.correlationId),
  };
}

function cycleDetailReadConfig(context: CompensationReadContext) {
  const config = readConfig(context);
  return {
    ...config,
    headers: {
      ...config.headers,
      [COMPENSATION_PLANNING_PROJECTION_VERSION_HEADER]:
        COMPENSATION_PLANNING_PROJECTION_VERSION,
    },
  };
}

function queryString(
  query: CompensationCollectionQuery,
  anchorKey: 'asOf' | 'referenceEffectiveAt'
) {
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
    cycleDetailReadConfig(context)
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
  bodyParser: (value: unknown) => TBody,
  highRisk = false
): Promise<TResult> {
  const canonicalBody = bodyParser(envelope.body);
  const response = await axiosInstance.post<ApiResponse<unknown>>(
    path,
    canonicalBody,
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
    parsePerformanceCommandReceipt,
    parseCreateCompensationCycleBody
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
    parseCompensationRichCommandResult,
    parseReviseCompensationCycleBody
  );
}

export function allocateCompensationBudget(
  cycleId: string,
  envelope: CompensationCommandEnvelope<CompensationBudgetBody>,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<PerformanceCommandReceipt> {
  return post(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(cycleId)}/budget-allocations`,
    requireVersion(envelope),
    authority,
    parsePerformanceCommandReceipt,
    parseCompensationBudgetBody
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
    parseCompensationRichCommandResult,
    parseUpsertCompensationProposalBody
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
    parsePerformanceCommandReceipt,
    parseSubmitCompensationProposalBody
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
    parseApproveCompensationPlanBody,
    true
  );
}

export function publishCompensationSnapshot(
  cycleId: string,
  envelope: CompensationCommandEnvelope<PublishCompensationSnapshotBody>,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<CompensationSnapshotPublished> {
  return post(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(cycleId)}/approved-snapshots`,
    requireVersion(envelope),
    authority,
    parseCompensationSnapshotPublished,
    parsePublishCompensationSnapshotBody,
    true
  );
}

export function cancelCompensationCycle(
  cycleId: string,
  envelope: CompensationCommandEnvelope<Record<string, never>>,
  authority: ProductSurfaceGovernedMutationAuthority
): Promise<CompensationRichCommandResult> {
  return post(
    `${COMPENSATION_PLANNING_BASE_PATH}/cycles/${encodeURIComponent(cycleId)}/cancel`,
    requireVersion(envelope),
    authority,
    parseCompensationRichCommandResult,
    parseCancelCompensationCycleBody
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
