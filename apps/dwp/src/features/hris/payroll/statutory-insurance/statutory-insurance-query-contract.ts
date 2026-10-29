import {
  SOCIAL_INSURANCE_SORTS,
  STATUTORY_CONFIGURATION_SORTS,
} from './statutory-insurance-contract';
import { resolveCanonicalTimeZone } from '@dwp-frontend/shared-i18n';

import type {
  SocialInsuranceQuery,
  StatutoryConfigurationQuery,
} from './statutory-insurance-contract';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const FILTER_TOKEN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const MONEY = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/u;
const CURRENCY = /^[A-Z]{3}$/u;

export class StatutoryInsuranceQueryContractError extends Error {
  readonly kind = 'PAY003_QUERY_CONTRACT_ERROR' as const;

  constructor(path: string) {
    super(`Invalid PAY-003 query contract: ${path}`);
    this.name = 'StatutoryInsuranceQueryContractError';
  }
}

function invalid(path: string): never {
  throw new StatutoryInsuranceQueryContractError(path);
}

function exact(
  value: unknown,
  path: string,
  allowed: readonly string[],
  required: readonly string[] = allowed
) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(path);
  const source = value as Record<string, unknown>;
  const keys = Object.keys(source);
  if (
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) ||
    keys.some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.prototype.hasOwnProperty.call(source, key))
  ) {
    return invalid(path);
  }
  return source;
}

function text(value: unknown, path: string, maximum: number, pattern?: RegExp) {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    Array.from(value).length > maximum ||
    (pattern && !pattern.test(value))
  ) {
    return invalid(path);
  }
  return value;
}

function integer(value: unknown, path: string, minimum = 0, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    return invalid(path);
  }
  return Number(value);
}

function date(value: unknown, path: string) {
  const candidate = text(value, path, 10, DATE);
  const parsed = new Date(`${candidate}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== candidate) {
    return invalid(path);
  }
  return candidate;
}

function instant(value: unknown, path: string) {
  const candidate = text(value, path, 100, INSTANT);
  if (Number.isNaN(Date.parse(candidate))) return invalid(path);
  return candidate;
}

function canonicalLocale(value: unknown, path: string) {
  const candidate = text(value, path, 35);
  try {
    if (Intl.getCanonicalLocales(candidate)[0] !== candidate) return invalid(path);
  } catch {
    return invalid(path);
  }
  return candidate;
}

function canonicalTimeZone(value: unknown, path: string) {
  const candidate = text(value, path, 255);
  if (resolveCanonicalTimeZone(candidate) !== candidate) return invalid(path);
  return candidate;
}

function optionalNullable<T>(
  value: unknown,
  parse: (candidate: unknown) => T
): T | null | undefined {
  return value === undefined ? undefined : value === null ? null : parse(value);
}

function stringArray(value: unknown, path: string, pattern: RegExp) {
  if (!Array.isArray(value) || value.length > 50) return invalid(path);
  const selected = value.map((entry, index) => text(entry, `${path}[${index}]`, 128, pattern));
  if (new Set(selected).size !== selected.length) return invalid(path);
  return Object.freeze(selected);
}

function postedAmount(value: unknown, path: string) {
  return text(value, path, Number.MAX_SAFE_INTEGER, MONEY);
}

function baseQuery(candidate: unknown, path: string, sorts: readonly string[]) {
  const source = exact(
    candidate,
    path,
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId', 'asOf', 'cursor'],
    ['limit', 'filter', 'sort', 'locale', 'timeZone', 'correlationId']
  );
  if (!Array.isArray(source.sort) || source.sort.length < 1 || source.sort.length > 3) {
    return invalid(`${path}.sort`);
  }
  const selectedSorts = source.sort.map((entry, index) => {
    const selected = text(entry, `${path}.sort[${index}]`, 64);
    if (!sorts.includes(selected)) return invalid(`${path}.sort[${index}]`);
    return selected;
  });
  if (
    new Set(selectedSorts).size !== selectedSorts.length ||
    selectedSorts.filter((entry) => entry.startsWith('itemPublicId:')).length !== 1 ||
    !selectedSorts.at(-1)?.startsWith('itemPublicId:')
  ) {
    return invalid(`${path}.sort`);
  }
  return {
    source,
    limit: integer(source.limit, `${path}.limit`, 1, 100),
    sort: Object.freeze(selectedSorts),
    locale: canonicalLocale(source.locale, `${path}.locale`),
    timeZone: canonicalTimeZone(source.timeZone, `${path}.timeZone`),
    correlationId: text(source.correlationId, `${path}.correlationId`, 36, UUID),
    asOf: optionalNullable(source.asOf, (entry) => instant(entry, `${path}.asOf`)),
    cursor: optionalNullable(source.cursor, (entry) => text(entry, `${path}.cursor`, 1024, CURSOR)),
  };
}

function metadataFilter(value: unknown, path: string) {
  const source = exact(value, path, ['keys', 'versions'], []);
  return Object.freeze({
    ...(source.keys === undefined
      ? {}
      : { keys: stringArray(source.keys, `${path}.keys`, FILTER_TOKEN) }),
    ...(source.versions === undefined
      ? {}
      : { versions: stringArray(source.versions, `${path}.versions`, FILTER_TOKEN) }),
  });
}

function policyFilter(value: unknown, path: string) {
  const source = exact(value, path, ['policyKeys', 'minimumRevision'], []);
  return Object.freeze({
    ...(source.policyKeys === undefined
      ? {}
      : { policyKeys: stringArray(source.policyKeys, `${path}.policyKeys`, FILTER_TOKEN) }),
    ...(source.minimumRevision === undefined
      ? {}
      : {
          minimumRevision:
            source.minimumRevision === null
              ? null
              : integer(source.minimumRevision, `${path}.minimumRevision`, 1),
        }),
  });
}

function moneyFilter(value: unknown, path: string) {
  const source = exact(value, path, ['currency', 'minimumAmount', 'maximumAmount'], []);
  const parseAmount = (amount: unknown, field: string) =>
    amount === null ? null : postedAmount(amount, `${path}.${field}`);
  const minimum = optionalNullable(source.minimumAmount, (entry) =>
    parseAmount(entry, 'minimumAmount')
  );
  const maximum = optionalNullable(source.maximumAmount, (entry) =>
    parseAmount(entry, 'maximumAmount')
  );
  const scaledAmount = (amount: string) => {
    const negative = amount.startsWith('-');
    const [whole, fraction = ''] = (negative ? amount.slice(1) : amount).split('.');
    const scaled = BigInt(whole!) * 1_000_000n + BigInt(fraction.padEnd(6, '0'));
    return negative ? -scaled : scaled;
  };
  if (minimum != null && maximum != null && scaledAmount(minimum) > scaledAmount(maximum)) {
    return invalid(`${path}.amountRange`);
  }
  return Object.freeze({
    ...(source.currency === undefined
      ? {}
      : {
          currency:
            source.currency === null
              ? null
              : text(source.currency, `${path}.currency`, 3, CURRENCY),
        }),
    ...(minimum === undefined ? {} : { minimumAmount: minimum }),
    ...(maximum === undefined ? {} : { maximumAmount: maximum }),
  });
}

export function validateStatutoryConfigurationQuery(
  candidate: unknown
): StatutoryConfigurationQuery {
  const common = baseQuery(candidate, 'statutoryQuery', STATUTORY_CONFIGURATION_SORTS);
  const filter = exact(
    common.source.filter,
    'statutoryQuery.filter',
    ['countryPackMetadata', 'statutoryRule', 'activationStatus', 'effectiveOn'],
    []
  );
  const status = optionalNullable(filter.activationStatus, (entry) => {
    const source = exact(
      entry,
      'statutoryQuery.filter.activationStatus',
      ['codes', 'minimumRevision'],
      []
    );
    return Object.freeze({
      ...(source.codes === undefined
        ? {}
        : {
            codes: stringArray(source.codes, 'statutoryQuery.filter.activationStatus.codes', CODE),
          }),
      ...(source.minimumRevision === undefined
        ? {}
        : {
            minimumRevision:
              source.minimumRevision === null
                ? null
                : integer(
                    source.minimumRevision,
                    'statutoryQuery.filter.activationStatus.minimumRevision',
                    1
                  ),
          }),
    });
  });
  return Object.freeze({
    limit: common.limit,
    filter: Object.freeze({
      ...(filter.countryPackMetadata === undefined
        ? {}
        : {
            countryPackMetadata: optionalNullable(filter.countryPackMetadata, (entry) =>
              metadataFilter(entry, 'statutoryQuery.filter.countryPackMetadata')
            ),
          }),
      ...(filter.statutoryRule === undefined
        ? {}
        : {
            statutoryRule: optionalNullable(filter.statutoryRule, (entry) =>
              policyFilter(entry, 'statutoryQuery.filter.statutoryRule')
            ),
          }),
      ...(status === undefined ? {} : { activationStatus: status }),
      ...(filter.effectiveOn === undefined
        ? {}
        : {
            effectiveOn:
              filter.effectiveOn === null
                ? null
                : date(filter.effectiveOn, 'statutoryQuery.filter.effectiveOn'),
          }),
    }),
    sort: common.sort as StatutoryConfigurationQuery['sort'],
    locale: common.locale,
    timeZone: common.timeZone,
    correlationId: common.correlationId,
    ...(common.asOf === undefined ? {} : { asOf: common.asOf }),
    ...(common.cursor === undefined ? {} : { cursor: common.cursor }),
  });
}

export function validateSocialInsuranceQuery(candidate: unknown): SocialInsuranceQuery {
  const common = baseQuery(candidate, 'socialInsuranceQuery', SOCIAL_INSURANCE_SORTS);
  const filter = exact(
    common.source.filter,
    'socialInsuranceQuery.filter',
    ['taxResult', 'socialInsurance', 'policyVersion', 'effectiveOn'],
    []
  );
  const taxResult = optionalNullable(filter.taxResult, (entry) =>
    moneyFilter(entry, 'socialInsuranceQuery.filter.taxResult')
  );
  const socialInsurance = optionalNullable(filter.socialInsurance, (entry) =>
    moneyFilter(entry, 'socialInsuranceQuery.filter.socialInsurance')
  );
  return Object.freeze({
    limit: common.limit,
    filter: Object.freeze({
      ...(taxResult === undefined ? {} : { taxResult }),
      ...(socialInsurance === undefined ? {} : { socialInsurance }),
      ...(filter.policyVersion === undefined
        ? {}
        : {
            policyVersion: optionalNullable(filter.policyVersion, (entry) =>
              policyFilter(entry, 'socialInsuranceQuery.filter.policyVersion')
            ),
          }),
      ...(filter.effectiveOn === undefined
        ? {}
        : {
            effectiveOn:
              filter.effectiveOn === null
                ? null
                : date(filter.effectiveOn, 'socialInsuranceQuery.filter.effectiveOn'),
          }),
    }),
    sort: common.sort as SocialInsuranceQuery['sort'],
    locale: common.locale,
    timeZone: common.timeZone,
    correlationId: common.correlationId,
    ...(common.asOf === undefined ? {} : { asOf: common.asOf }),
    ...(common.cursor === undefined ? {} : { cursor: common.cursor }),
  });
}
