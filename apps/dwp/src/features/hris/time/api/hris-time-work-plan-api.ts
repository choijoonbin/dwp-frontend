import { Temporal } from 'temporal-polyfill';
import {
  axiosInstance,
  productSurfaceGovernedMutationConfig,
  productSurfaceHighRiskMutationConfig,
} from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type {
  WorkPlanReceipt,
  WorkPlanSimulationRequest,
  WorkArrangementKind,
} from '../model/hris-time-work-plan-model';

const WORK_PLAN_BASE = '/api/time/v1/hris/work-plans' as const;

export const HRIS_TIME_WORK_PLAN_MUTATION_API_CONTRACTS = [
  {
    apiFunction: 'createHrisTimeWorkPlanDraft',
    routeContractKey: 'route.hcm.operations.work-plan-create.action',
    method: 'POST',
    path: `${WORK_PLAN_BASE}/drafts`,
  },
  {
    apiFunction: 'simulateHrisTimeWorkPlan',
    routeContractKey: 'route.hcm.operations.work-plan-simulate.action',
    method: 'POST',
    path: `${WORK_PLAN_BASE}/{workPlanId}/simulations`,
  },
  {
    apiFunction: 'validateHrisTimeWorkPlan',
    routeContractKey: 'route.hcm.operations.work-plan-validate.action',
    method: 'POST',
    path: `${WORK_PLAN_BASE}/{workPlanId}/actions/{action}`,
  },
  {
    apiFunction: 'submitHrisTimeWorkPlanReview',
    routeContractKey: 'route.hcm.operations.work-plan-submit-review.action',
    method: 'POST',
    path: `${WORK_PLAN_BASE}/{workPlanId}/actions/{action}`,
  },
  {
    apiFunction: 'applyHrisTimeWorkPlanApproval',
    routeContractKey: 'route.hcm.operations.work-plan-apply-approval.action',
    method: 'POST',
    path: `${WORK_PLAN_BASE}/{workPlanId}/actions/{action}`,
  },
  {
    apiFunction: 'publishHrisTimeWorkPlan',
    routeContractKey: 'route.hcm.operations.work-plan-publish.action',
    method: 'POST',
    path: `${WORK_PLAN_BASE}/{workPlanId}/actions/{action}`,
  },
] as const;

export type HrisTimeTenantExtensionField = Readonly<{
  fieldName: string;
  valueType: 'STRING' | 'INTEGER' | 'DECIMAL' | 'BOOLEAN' | 'DATE';
  stringValue?: string | null;
  integerValue?: number | null;
  decimalValue?: number | string | null;
  booleanValue?: boolean | null;
  dateValue?: string | null;
}>;

export type HrisTimeCreateDraftRequest = Readonly<{
  regimeKey: string;
  displayName: string;
  arrangementKind: WorkArrangementKind;
  tenantExtension?: Readonly<{
    schemaRef: string;
    schemaVersion: number;
    fields: readonly HrisTimeTenantExtensionField[];
  }> | null;
  scopeType:
    | 'GLOBAL'
    | 'COUNTRY'
    | 'SUBDIVISION'
    | 'TENANT'
    | 'LEGAL_ENTITY'
    | 'BUSINESS_UNIT'
    | 'WORKPLACE'
    | 'POPULATION'
    | 'PERSON'
    | 'ASSIGNMENT';
  scopeRef: string;
  priority: number;
  effectiveStart: string;
  effectiveEnd?: string | null;
  timeZone: string;
  rulePackPublicId: string;
  jurisdiction: string;
  jurisdictionSubdivision?: string | null;
  policyRevision: number;
  templateSchemaVersion: number;
  workerPublicId: string;
  peopleAssignmentPublicId: string;
  assignmentSnapshotRevision: number;
  terms: readonly Readonly<{
    extensionKind:
      | 'FLEXIBLE'
      | 'ELASTIC'
      | 'AVERAGED'
      | 'SELECTIVE'
      | 'DISCRETIONARY'
      | 'DEEMED'
      | 'REDUCED'
      | 'SHIFT'
      | 'SPLIT_SHIFT'
      | 'ON_CALL'
      | 'OVERTIME'
      | 'BREAK'
      | 'WEEKLY_LIMIT';
    parameterName: string;
    valueType: 'STRING' | 'INTEGER' | 'DURATION_MINUTES' | 'DECIMAL' | 'BOOLEAN' | 'DATE';
    stringValue?: string | null;
    integerValue?: number | null;
    decimalValue?: number | string | null;
    booleanValue?: boolean | null;
    dateValue?: string | null;
  }>[];
  segments: readonly Readonly<{
    key: string;
    dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
    kind: 'WORK' | 'BREAK' | 'ON_CALL' | 'TRAINING';
    start: string;
    end: string;
    endDayOffset: number;
    overlapPolicy: 'REJECT' | 'EARLIER' | 'LATER';
  }>[];
}>;

export type HrisTimeLifecycleRequest = Readonly<{ expectedVersion: number }>;
export type HrisTimeCommandScope = Readonly<{
  contextScopeKey?: string;
  signal?: AbortSignal;
}>;

export type WorkPlanStudioScope = Readonly<{
  ready: boolean;
  scopeKey: string;
  decisionRevision: string;
  effectiveOn: string;
}>;

export type WorkPlanStudioDataSource = Readonly<{
  read: (scope: WorkPlanStudioScope, signal: AbortSignal) => Promise<unknown>;
  simulate: (
    request: WorkPlanSimulationRequest,
    scope: WorkPlanStudioScope,
    signal: AbortSignal,
    authority?: ProductSurfaceGovernedMutationAuthority
  ) => Promise<unknown>;
  reconcileReceipt: (
    receipt: WorkPlanReceipt,
    scope: WorkPlanStudioScope,
    signal: AbortSignal
  ) => Promise<unknown>;
}>;

export type HrisTimeWorkPlanHttpConfig = Readonly<{
  contextScopeKey: string;
  headers?: Record<string, string>;
  signal: AbortSignal;
}>;

export type HrisTimeWorkPlanHttpClient = Readonly<{
  get: (
    url: string,
    config: HrisTimeWorkPlanHttpConfig
  ) => Promise<Readonly<{ data: ApiResponse<unknown> }>>;
  post: (
    url: string,
    body: unknown,
    config: HrisTimeWorkPlanHttpConfig
  ) => Promise<Readonly<{ data: ApiResponse<unknown> }>>;
}>;

export type HrisTimeWorkPlanIdFactory = () => string;
export type HrisTimeWorkPlanGovernedAuthority = (
  scope: WorkPlanStudioScope,
  signal: AbortSignal
) => Readonly<{
  decisionRevision: string;
  config: HrisTimeWorkPlanHttpConfig;
}>;

/**
 * The owner HTTP adapter deliberately has no implicit product-route binding. A caller may only
 * mount it after the generated DATA/ACTION contracts for the owner endpoints exist; the
 * operations adapter supplies the freshly evaluated action authority for each simulation.
 */
export const hrisTimeWorkPlanHttpClient: HrisTimeWorkPlanHttpClient = Object.freeze({
  get: (url, config) =>
    axiosInstance.get<ApiResponse<unknown>>(
      url,
      productSurfaceReadScopeConfig(config.contextScopeKey, config.signal)
    ),
  post: (url, body, config) =>
    axiosInstance.post<ApiResponse<unknown>, unknown>(url, body, {
      contextScopeKey: config.contextScopeKey,
      signal: config.signal,
      ...(config.headers ? { headers: config.headers } : {}),
    }),
});

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint !== undefined && (codePoint <= 0x1f || codePoint === 0x7f);
  });
}

function validOpaqueText(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim() &&
    !hasControlCharacter(value)
  );
}

function validCivilDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  try {
    return Temporal.PlainDate.from(value).toString() === value;
  } catch {
    return false;
  }
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(value)
  );
}

function assertScope(scope: WorkPlanStudioScope): void {
  if (
    !scope ||
    scope.ready !== true ||
    !validOpaqueText(scope.scopeKey, 500) ||
    !validOpaqueText(scope.decisionRevision, 500) ||
    !validCivilDate(scope.effectiveOn)
  ) {
    throw new Error('Invalid work plan studio scope.');
  }
}

function assertSimulationRequest(request: WorkPlanSimulationRequest): void {
  if (
    !request ||
    !validOpaqueText(request.workPlanId, 500) ||
    !Number.isSafeInteger(request.expectedVersion) ||
    request.expectedVersion < 1 ||
    !validOpaqueText(request.assignmentSnapshotRevision, 500) ||
    !validOpaqueText(request.policyRevision, 500) ||
    request.purpose !== 'PRE_PUBLISH_IMPACT_REVIEW'
  ) {
    throw new Error('Invalid work plan simulation request.');
  }
}

function assertReceipt(receipt: WorkPlanReceipt): void {
  if (
    !receipt ||
    !validOpaqueText(receipt.receiptId, 500) ||
    !validOpaqueText(receipt.workPlanId, 500) ||
    receipt.operation !== 'SIMULATE' ||
    !validOpaqueText(receipt.idempotencyKey, 500)
  ) {
    throw new Error('Invalid work plan receipt identity.');
  }
}

function unwrap(response: Readonly<{ data: ApiResponse<unknown> }>): unknown {
  const envelope: unknown = response?.data;
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('Invalid work plan owner response envelope.');
  }
  if (!Object.hasOwn(envelope, 'data')) {
    throw new Error('Invalid work plan owner response envelope.');
  }
  return (envelope as { data: unknown }).data;
}

function assertCommandBinding(
  source: unknown,
  expected: Readonly<{
    workPlanId: string;
    idempotencyKey: string;
    receiptId?: string;
  }>
): void {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('Work plan command identity does not match the request.');
  }
  const receipt = (source as { receipt?: unknown }).receipt;
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new Error('Work plan command identity does not match the request.');
  }
  const value = receipt as Record<string, unknown>;
  if (
    value.workPlanId !== expected.workPlanId ||
    value.operation !== 'SIMULATE' ||
    value.idempotencyKey !== expected.idempotencyKey ||
    (expected.receiptId !== undefined && value.receiptId !== expected.receiptId)
  ) {
    throw new Error('Work plan command identity does not match the request.');
  }
}

function defaultIdFactory(): string {
  if (!globalThis.crypto?.randomUUID) throw new Error('A secure idempotency key is unavailable.');
  return globalThis.crypto.randomUUID();
}

function simulationIdempotencyKey(
  idFactory: HrisTimeWorkPlanIdFactory,
  mutationAuthority: ProductSurfaceGovernedMutationAuthority | undefined
): string {
  const authorityKey =
    mutationAuthority?.mode === 'SECURE' ? mutationAuthority.idempotencyKey : undefined;
  const idempotencyKey = authorityKey ?? idFactory();
  if (!validUuid(idempotencyKey)) {
    throw new Error('Invalid work plan simulation idempotency key.');
  }
  return idempotencyKey;
}

function readConfig(scope: WorkPlanStudioScope, signal: AbortSignal): HrisTimeWorkPlanHttpConfig {
  return {
    contextScopeKey: scope.scopeKey,
    signal,
  };
}

function governedConfig(
  legacyAuthority: HrisTimeWorkPlanGovernedAuthority | undefined,
  mutationAuthority: ProductSurfaceGovernedMutationAuthority | undefined,
  scope: WorkPlanStudioScope,
  signal: AbortSignal
): HrisTimeWorkPlanHttpConfig {
  if (mutationAuthority) {
    // A work-plan simulation changes a tenant policy projection. It must never inherit the
    // legacy/unscoped compatibility mode merely because the shell is in a rollout window.
    if (
      mutationAuthority.mode !== 'SECURE' ||
      mutationAuthority.expectedDecisionRevision !== scope.decisionRevision ||
      mutationAuthority.contextScopeKey !== scope.scopeKey ||
      mutationAuthority.stepUp !== undefined ||
      mutationAuthority.objectVersion !== undefined
    ) {
      throw new Error('Governed work plan simulation authority is invalid.');
    }
    const governed = productSurfaceGovernedMutationConfig(mutationAuthority);
    return {
      contextScopeKey: scope.scopeKey,
      headers: governed.headers,
      signal,
    };
  }

  if (!legacyAuthority) throw new Error('Governed work plan simulation authority is unavailable.');
  const trusted = legacyAuthority(scope, signal);
  if (
    !trusted ||
    trusted.decisionRevision !== scope.decisionRevision ||
    trusted.config.contextScopeKey !== scope.scopeKey ||
    trusted.config.signal !== signal ||
    trusted.config.headers?.['X-DWP-Expected-Decision-Revision'] !== scope.decisionRevision
  ) {
    throw new Error('Governed work plan simulation authority is invalid.');
  }
  return trusted.config;
}

function timeCommandConfig(
  scope: HrisTimeCommandScope,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority,
  highRisk = false,
  expectedVersion?: number
) {
  if (!validUuid(commandId)) throw new Error('Invalid work plan command idempotency key.');
  if (authority.mode === 'SECURE' && authority.idempotencyKey !== commandId) {
    throw new Error('Work plan command authority does not match the idempotency key.');
  }
  if (highRisk && authority.mode === 'SECURE' && authority.objectVersion !== expectedVersion) {
    throw new Error('Work plan publication authority does not match the object version.');
  }
  const governed = highRisk
    ? productSurfaceHighRiskMutationConfig(authority, { objectVersionHeader: false })
    : productSurfaceGovernedMutationConfig(authority);
  return {
    ...(scope.contextScopeKey ? { contextScopeKey: scope.contextScopeKey } : {}),
    ...(scope.signal ? { signal: scope.signal } : {}),
    ...governed,
    headers: { ...governed.headers, 'Idempotency-Key': commandId },
    csrfReplay: 'NEVER' as const,
  };
}

export async function createHrisTimeWorkPlanDraft(
  request: HrisTimeCreateDraftRequest,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority,
  scope: HrisTimeCommandScope = {}
): Promise<unknown> {
  const response = await axiosInstance.post<ApiResponse<unknown>, HrisTimeCreateDraftRequest>(
    `${WORK_PLAN_BASE}/drafts`,
    request,
    timeCommandConfig(scope, commandId, authority)
  );
  return response.data.data;
}

export async function simulateHrisTimeWorkPlan(
  request: WorkPlanSimulationRequest,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority,
  scope: HrisTimeCommandScope = {}
): Promise<unknown> {
  assertSimulationRequest(request);
  const { workPlanId, ...body } = request;
  const response = await axiosInstance.post<ApiResponse<unknown>, typeof body>(
    `${WORK_PLAN_BASE}/${encodeURIComponent(workPlanId)}/simulations`,
    body,
    timeCommandConfig(scope, commandId, authority)
  );
  return response.data.data;
}

async function transitionHrisTimeWorkPlan(
  workPlanId: string,
  action: 'validate' | 'submit-review' | 'apply-approval' | 'publish',
  request: HrisTimeLifecycleRequest,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority,
  scope: HrisTimeCommandScope,
  highRisk = false
): Promise<unknown> {
  const response = await axiosInstance.post<ApiResponse<unknown>, HrisTimeLifecycleRequest>(
    `${WORK_PLAN_BASE}/${encodeURIComponent(workPlanId)}/actions/${action}`,
    request,
    timeCommandConfig(scope, commandId, authority, highRisk, request.expectedVersion)
  );
  return response.data.data;
}

export function validateHrisTimeWorkPlan(
  workPlanId: string,
  request: HrisTimeLifecycleRequest,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority,
  scope: HrisTimeCommandScope = {}
) {
  return transitionHrisTimeWorkPlan(workPlanId, 'validate', request, commandId, authority, scope);
}

export function submitHrisTimeWorkPlanReview(
  workPlanId: string,
  request: HrisTimeLifecycleRequest,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority,
  scope: HrisTimeCommandScope = {}
) {
  return transitionHrisTimeWorkPlan(
    workPlanId,
    'submit-review',
    request,
    commandId,
    authority,
    scope
  );
}

export function applyHrisTimeWorkPlanApproval(
  workPlanId: string,
  request: HrisTimeLifecycleRequest,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority,
  scope: HrisTimeCommandScope = {}
) {
  return transitionHrisTimeWorkPlan(
    workPlanId,
    'apply-approval',
    request,
    commandId,
    authority,
    scope
  );
}

export function publishHrisTimeWorkPlan(
  workPlanId: string,
  request: HrisTimeLifecycleRequest,
  commandId: string,
  authority: ProductSurfaceGovernedMutationAuthority,
  scope: HrisTimeCommandScope = {}
) {
  return transitionHrisTimeWorkPlan(
    workPlanId,
    'publish',
    request,
    commandId,
    authority,
    scope,
    true
  );
}

export function createHrisTimeWorkPlanDataSource(
  client: HrisTimeWorkPlanHttpClient,
  idFactory: HrisTimeWorkPlanIdFactory = defaultIdFactory,
  legacyAuthority?: HrisTimeWorkPlanGovernedAuthority
): WorkPlanStudioDataSource {
  return Object.freeze({
    async read(scope, signal) {
      assertScope(scope);
      const query = new URLSearchParams({ effectiveOn: scope.effectiveOn });
      const response = await client.get(
        `/api/time/v1/hris/work-plans?${query.toString()}`,
        readConfig(scope, signal)
      );
      return unwrap(response);
    },

    async simulate(request, scope, signal, mutationAuthority) {
      assertScope(scope);
      assertSimulationRequest(request);
      const trusted = governedConfig(legacyAuthority, mutationAuthority, scope, signal);
      const idempotencyKey = simulationIdempotencyKey(idFactory, mutationAuthority);
      const { workPlanId, ...body } = request;
      const response = await client.post(
        `/api/time/v1/hris/work-plans/${encodeURIComponent(workPlanId)}/simulations`,
        body,
        {
          ...trusted,
          headers: { ...trusted.headers, 'Idempotency-Key': idempotencyKey },
        }
      );
      const payload = unwrap(response);
      assertCommandBinding(payload, { workPlanId, idempotencyKey });
      return payload;
    },

    async reconcileReceipt(receipt, scope, signal) {
      assertScope(scope);
      assertReceipt(receipt);
      const response = await client.get(
        `/api/time/v1/hris/work-plan-receipts/${encodeURIComponent(receipt.receiptId)}`,
        readConfig(scope, signal)
      );
      const payload = unwrap(response);
      assertCommandBinding(payload, receipt);
      return payload;
    },
  });
}
