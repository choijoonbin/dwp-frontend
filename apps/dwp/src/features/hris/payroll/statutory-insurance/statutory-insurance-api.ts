import { axiosInstance, productSurfaceHighRiskMutationConfig } from '@dwp-frontend/shared-utils';
import { productSurfaceReadScopeConfig } from '@dwp-frontend/shared-utils/api/product-surface-read-scope';

import {
  COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY,
  SOCIAL_INSURANCE_DATA_ROUTE_CONTRACT_KEY,
  SOCIAL_INSURANCE_PATH,
  STATUTORY_CONFIGURATION_DATA_ROUTE_CONTRACT_KEY,
  STATUTORY_CONFIGURATION_PATH,
  parsePayrollCommandReceipt,
  parseSocialInsuranceProjection,
  parseStatutoryConfigurationProjection,
  validateCountryPackActivationCommand,
} from './statutory-insurance-contract';
import {
  validateSocialInsuranceQuery,
  validateStatutoryConfigurationQuery,
} from './statutory-insurance-query-contract';

import type { ProductSurfaceGovernedMutationAuthority } from '@dwp-frontend/shared-utils';
import type {
  CountryPackActivationCommand,
  PayrollCommandReceipt,
  SocialInsuranceProjection,
  SocialInsuranceQuery,
  StatutoryConfigurationProjection,
  StatutoryConfigurationQuery,
} from './statutory-insurance-contract';

export type StatutoryConfigurationReadContext = Readonly<{
  routeContractKey: typeof STATUTORY_CONFIGURATION_DATA_ROUTE_CONTRACT_KEY;
  contextScopeKey: string;
  decisionRevision: string;
  signal?: AbortSignal;
}>;

export type SocialInsuranceReadContext = Readonly<{
  routeContractKey: typeof SOCIAL_INSURANCE_DATA_ROUTE_CONTRACT_KEY;
  contextScopeKey: string;
  decisionRevision: string;
  signal?: AbortSignal;
}>;

export type CountryPackActivationAuthority = Readonly<{
  routeContractKey: typeof COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY;
  governance: ProductSurfaceGovernedMutationAuthority;
  contextKey: string;
  contextScopeKey: string;
  decisionRevision: string;
  idempotencyKey: string;
  correlationId: string;
  expectedObjectVersion: number;
}>;

export type StatutoryInsuranceDataSource = Readonly<{
  statutoryConfiguration: (
    query: StatutoryConfigurationQuery,
    context: StatutoryConfigurationReadContext
  ) => Promise<StatutoryConfigurationProjection>;
  socialInsurance: (
    query: SocialInsuranceQuery,
    context: SocialInsuranceReadContext
  ) => Promise<SocialInsuranceProjection>;
  activateCountryPack: (
    command: CountryPackActivationCommand,
    authority: CountryPackActivationAuthority
  ) => Promise<PayrollCommandReceipt>;
}>;

export class CountryPackActivationOutcomeUnknownError extends Error {
  constructor(cause: unknown) {
    super('The Payroll owner returned an unverifiable country-pack activation receipt.', {
      cause,
    });
    this.name = 'CountryPackActivationOutcomeUnknownError';
  }
}

function appendValue(parameters: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) {
    value.forEach((entry) => parameters.append(key, String(entry)));
    return value.length > 0;
  }
  if (typeof value === 'object') {
    let appended = false;
    Object.entries(value as Record<string, unknown>).forEach(([child, entry]) => {
      appended = appendValue(parameters, `${key}[${child}]`, entry) || appended;
    });
    return appended;
  }
  parameters.append(key, String(value));
  return true;
}

function queryString(query: StatutoryConfigurationQuery | SocialInsuranceQuery): string {
  const parameters = new URLSearchParams({
    limit: String(query.limit),
    locale: query.locale,
    timeZone: query.timeZone,
    correlationId: query.correlationId,
  });
  query.sort.forEach((sort) => parameters.append('sort', sort));
  if (query.asOf !== undefined && query.asOf !== null) parameters.set('asOf', query.asOf);
  if (query.cursor !== undefined && query.cursor !== null) parameters.set('cursor', query.cursor);
  let appendedFilter = false;
  Object.entries(query.filter).forEach(([key, value]) => {
    appendedFilter = appendValue(parameters, `filter[${key}]`, value) || appendedFilter;
  });
  if (!appendedFilter) parameters.set('filter', '{}');
  return parameters.toString();
}

function assertReadContext(
  context: StatutoryConfigurationReadContext | SocialInsuranceReadContext,
  routeContractKey:
    | typeof STATUTORY_CONFIGURATION_DATA_ROUTE_CONTRACT_KEY
    | typeof SOCIAL_INSURANCE_DATA_ROUTE_CONTRACT_KEY
) {
  if (
    context.routeContractKey !== routeContractKey ||
    !context.contextScopeKey.trim() ||
    !context.decisionRevision.trim()
  ) {
    throw new Error('PAY-003 trusted read authority is unavailable.');
  }
}

export async function queryStatutoryConfiguration(
  candidate: StatutoryConfigurationQuery,
  context: StatutoryConfigurationReadContext
) {
  const query = validateStatutoryConfigurationQuery(candidate);
  assertReadContext(context, STATUTORY_CONFIGURATION_DATA_ROUTE_CONTRACT_KEY);
  const response = await axiosInstance.get<unknown>(
    `${STATUTORY_CONFIGURATION_PATH}?${queryString(query)}`,
    {
      ...productSurfaceReadScopeConfig(context.contextScopeKey, context.signal),
      headers: {
        'X-Correlation-ID': query.correlationId,
        'X-DWP-Route-Contract-Key': context.routeContractKey,
      },
    }
  );
  const projection = parseStatutoryConfigurationProjection(response.data);
  if (
    projection.queryState.correlationId !== query.correlationId ||
    projection.queryState.cachePolicy.authorizationDecisionRevision !== context.decisionRevision
  ) {
    throw new Error('IAQ-026 response does not match the governed request.');
  }
  return projection;
}

export async function querySocialInsurance(
  candidate: SocialInsuranceQuery,
  context: SocialInsuranceReadContext
) {
  const query = validateSocialInsuranceQuery(candidate);
  assertReadContext(context, SOCIAL_INSURANCE_DATA_ROUTE_CONTRACT_KEY);
  const response = await axiosInstance.get<unknown>(
    `${SOCIAL_INSURANCE_PATH}?${queryString(query)}`,
    {
      ...productSurfaceReadScopeConfig(context.contextScopeKey, context.signal),
      headers: {
        'X-Correlation-ID': query.correlationId,
        'X-DWP-Route-Contract-Key': context.routeContractKey,
      },
    }
  );
  const projection = parseSocialInsuranceProjection(response.data);
  if (
    projection.queryState.correlationId !== query.correlationId ||
    projection.queryState.cachePolicy.authorizationDecisionRevision !== context.decisionRevision
  ) {
    throw new Error('IAQ-048 response does not match the governed request.');
  }
  return projection;
}

function activationAuthority(
  command: CountryPackActivationCommand,
  authority: CountryPackActivationAuthority
) {
  const governance = authority.governance;
  if (
    authority.routeContractKey !== COUNTRY_PACK_ACTIVATE_ROUTE_CONTRACT_KEY ||
    authority.expectedObjectVersion !== command.expectedActivationRevision ||
    authority.idempotencyKey !== command.idempotencyKey ||
    authority.correlationId !== command.correlationId ||
    !authority.contextKey.trim() ||
    !authority.contextScopeKey.trim() ||
    !authority.decisionRevision.trim() ||
    governance.mode !== 'SECURE' ||
    !governance.stepUp ||
    governance.contextKey !== authority.contextKey ||
    governance.contextScopeKey !== authority.contextScopeKey ||
    governance.expectedDecisionRevision !== authority.decisionRevision ||
    governance.stepUp.decisionRevision !== authority.decisionRevision ||
    governance.objectVersion !== command.expectedActivationRevision ||
    governance.idempotencyKey !== command.idempotencyKey
  ) {
    throw new Error('Country-pack activation HIGH-risk authority does not match the command.');
  }
  const governed = productSurfaceHighRiskMutationConfig(governance, {
    objectVersionHeader: true,
  });
  return {
    ...governed,
    headers: {
      ...governed.headers,
      'Idempotency-Key': command.idempotencyKey,
      'If-Match': `"${command.expectedActivationRevision}"`,
      'X-Correlation-ID': command.correlationId,
      'X-Purpose-Code': 'STATUTORY_CONFIGURATION',
      'X-DWP-Route-Contract-Key': authority.routeContractKey,
    },
    csrfReplay: 'NEVER' as const,
  };
}

export async function activateCountryPack(
  candidate: CountryPackActivationCommand,
  authority: CountryPackActivationAuthority
) {
  const command = validateCountryPackActivationCommand(candidate);
  const response = await axiosInstance.post<unknown, CountryPackActivationCommand['request']>(
    `/api/payroll/v1/country-packs/${command.packId}/activate`,
    command.request,
    activationAuthority(command, authority)
  );
  try {
    const receipt = parsePayrollCommandReceipt(response.data);
    if (
      receipt.correlationId !== command.correlationId ||
      receipt.aggregateVersion !== command.expectedActivationRevision + 1
    ) {
      throw new Error('Country-pack activation receipt belongs to another command revision.');
    }
    return receipt;
  } catch (error) {
    throw new CountryPackActivationOutcomeUnknownError(error);
  }
}

export const statutoryInsuranceDataSource: StatutoryInsuranceDataSource = Object.freeze({
  statutoryConfiguration: queryStatutoryConfiguration,
  socialInsurance: querySocialInsurance,
  activateCountryPack,
});
