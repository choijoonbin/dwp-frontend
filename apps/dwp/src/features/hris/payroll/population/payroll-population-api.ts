import { axiosInstance, productSurfaceHighRiskMutationConfig } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY,
  PAYROLL_POPULATION_PATH,
  PAYROLL_RUN_PREPARE_PATH,
  PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY,
  parsePayrollPopulationProjection,
  parsePayrollRunPreparedReceipt,
  validatePayrollPopulationQuery,
  validatePayrollRunPrepareCommand,
} from './payroll-population-contract';

import type {
  ApiResponse,
  ProductSurfaceGovernedMutationAuthority,
} from '@dwp-frontend/shared-utils';
import type {
  PayrollPopulationProjection,
  PayrollPopulationQuery,
  PayrollRunPrepareCommand,
  PayrollRunPreparedReceipt,
} from './payroll-population-contract';

export type PayrollPopulationReadContext = Readonly<{
  routeContractKey: typeof PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY;
  contextScopeKey: string;
  decisionRevision: string;
  signal?: AbortSignal;
}>;

export type PayrollRunPrepareAuthority = Readonly<{
  routeContractKey: typeof PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY;
  governance: ProductSurfaceGovernedMutationAuthority;
  contextScopeKey: string;
  decisionRevision: string;
  idempotencyKey: string;
  correlationId: string;
  expectedObjectVersion: 0;
}>;

export type PayrollPopulationDataSource = Readonly<{
  population: (
    query: PayrollPopulationQuery,
    context: PayrollPopulationReadContext
  ) => Promise<PayrollPopulationProjection>;
  prepare: (
    command: PayrollRunPrepareCommand,
    authority: PayrollRunPrepareAuthority
  ) => Promise<PayrollRunPreparedReceipt>;
}>;

export class PayrollRunPrepareOutcomeUnknownError extends Error {
  constructor(cause: unknown) {
    super('The Payroll owner returned an unverifiable preparation receipt.', { cause });
    this.name = 'PayrollRunPrepareOutcomeUnknownError';
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string, label: string) {
  if (!UUID.test(value)) throw new Error(`${label} is invalid.`);
}

function appendMany(parameters: URLSearchParams, key: string, values?: readonly string[]) {
  values?.forEach((value) => parameters.append(key, value));
}

function populationUrl(candidate: PayrollPopulationQuery) {
  const query = validatePayrollPopulationQuery(candidate);
  const parameters = new URLSearchParams({
    limit: String(query.limit),
    locale: query.locale,
    timeZone: query.timeZone,
    correlationId: query.correlationId,
  });
  appendMany(parameters, 'sort', query.sort);
  if (query.asOf) parameters.set('asOf', query.asOf);
  if (query.cursor) parameters.set('cursor', query.cursor);
  const population = query.filter.payrollPopulation;
  if (population?.minimumItemCount != null) {
    parameters.set(
      'filter[payrollPopulation][minimumItemCount]',
      String(population.minimumItemCount)
    );
  }
  if (population?.maximumItemCount != null) {
    parameters.set(
      'filter[payrollPopulation][maximumItemCount]',
      String(population.maximumItemCount)
    );
  }
  appendMany(parameters, 'filter[projectionVersion][keys]', query.filter.projectionVersion?.keys);
  appendMany(
    parameters,
    'filter[projectionVersion][versions]',
    query.filter.projectionVersion?.versions
  );
  if (query.filter.effectiveOn) {
    parameters.set('filter[effectiveOn]', query.filter.effectiveOn);
  }
  if (![...parameters.keys()].some((key) => key.startsWith('filter['))) {
    parameters.set('filter', '{}');
  }
  return `${PAYROLL_POPULATION_PATH}?${parameters.toString()}`;
}

export async function queryPayrollPopulation(
  candidate: PayrollPopulationQuery,
  context: PayrollPopulationReadContext
) {
  const query = validatePayrollPopulationQuery(candidate);
  if (
    context.routeContractKey !== PAYROLL_POPULATION_DATA_ROUTE_CONTRACT_KEY ||
    !context.contextScopeKey ||
    !context.decisionRevision
  ) {
    throw new Error('Payroll population DATA route authority is unavailable.');
  }
  const scoped = productSurfaceReadScopeConfig(context.contextScopeKey, context.signal);
  const response = await axiosInstance.get<ApiResponse<unknown>>(populationUrl(query), {
    ...scoped,
    headers: {
      'X-Correlation-ID': query.correlationId,
      'X-DWP-Route-Contract-Key': context.routeContractKey,
    },
  });
  const projection = parsePayrollPopulationProjection(response.data.data);
  if (
    projection.queryState.correlationId !== query.correlationId ||
    projection.queryState.cachePolicy.authorizationDecisionRevision !== context.decisionRevision
  ) {
    throw new Error('Payroll population response does not match the governed request.');
  }
  return projection;
}

function prepareConfig(command: PayrollRunPrepareCommand, authority: PayrollRunPrepareAuthority) {
  assertUuid(command.preparationId, 'Payroll preparation identifier');
  assertUuid(authority.idempotencyKey, 'Payroll preparation idempotency key');
  assertUuid(authority.correlationId, 'Payroll preparation correlation identifier');
  if (
    authority.routeContractKey !== PAYROLL_RUN_PREPARE_ROUTE_CONTRACT_KEY ||
    authority.expectedObjectVersion !== 0 ||
    authority.governance.mode !== 'SECURE' ||
    !authority.governance.stepUp ||
    authority.governance.contextScopeKey !== authority.contextScopeKey ||
    authority.governance.expectedDecisionRevision !== authority.decisionRevision ||
    authority.governance.stepUp.decisionRevision !== authority.decisionRevision ||
    authority.governance.idempotencyKey !== authority.idempotencyKey ||
    authority.governance.objectVersion !== 0
  ) {
    throw new Error('Payroll preparation authority does not match the immutable command.');
  }
  const governed = productSurfaceHighRiskMutationConfig(authority.governance, {
    objectVersionHeader: true,
  });
  return {
    ...governed,
    headers: {
      ...governed.headers,
      'Idempotency-Key': authority.idempotencyKey,
      'X-Correlation-ID': authority.correlationId,
      'X-DWP-Expected-Object-Version': '0',
      'X-DWP-Route-Contract-Key': authority.routeContractKey,
    },
    csrfReplay: 'NEVER' as const,
  };
}

export async function preparePayrollRun(
  candidate: PayrollRunPrepareCommand,
  authority: PayrollRunPrepareAuthority
) {
  const command = validatePayrollRunPrepareCommand(candidate);
  const response = await axiosInstance.post<ApiResponse<unknown>, PayrollRunPrepareCommand>(
    PAYROLL_RUN_PREPARE_PATH,
    command,
    prepareConfig(command, authority)
  );
  try {
    if (response.status !== 202) {
      throw new Error('Payroll preparation did not return the sealed 202 receipt transport.');
    }
    const receipt = parsePayrollRunPreparedReceipt(response.data.data);
    if (receipt.correlationId !== authority.correlationId) {
      throw new Error('Payroll preparation receipt belongs to another command.');
    }
    return receipt;
  } catch (error) {
    throw new PayrollRunPrepareOutcomeUnknownError(error);
  }
}

export const payrollPopulationDataSource: PayrollPopulationDataSource = Object.freeze({
  population: queryPayrollPopulation,
  prepare: preparePayrollRun,
});
