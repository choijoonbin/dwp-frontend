import type { components } from '@dwp-frontend/api-contracts';
import { parseHrisCommandReceipt } from '../../../people/command-receipts/model/command-receipt';

import type { HrisCommandReceipt } from '../../../people/command-receipts/model/command-receipt';

type GatewaySchemas = components['schemas'];

export type EmployeeChangeCreateRequest = GatewaySchemas['people_EmployeeChangeRequestCreateV1'];
export type EmployeeChangeProjection =
  GatewaySchemas['people_Iaq009EmployeeChangeRequestProjectionV1'];
export type EmployeeChangeQuery = GatewaySchemas['people_Iaq009EmployeeChangeRequestQueryV1'];
export type EmployeeChangeCommandReceipt = HrisCommandReceipt;
export type EmployeeChangeItem = EmployeeChangeProjection['items'][number];
export type EmployeeChangeAction = EmployeeChangeItem['availableActions'][number];

export const EMPLOYEE_CHANGE_ROUTE = '/hr/operations/people/employee-change-requests' as const;
export const EMPLOYEE_CHANGE_WORKBENCH_ROUTE_CONTRACT =
  'route.hcm.operations.employee-change-requests.page' as const;
export const EMPLOYEE_CHANGE_CREATE_ROUTE_CONTRACT =
  'route.hcm.operations.employee-change-request-create.action' as const;
export const EMPLOYEE_CHANGE_SUBMIT_ROUTE_CONTRACT =
  'route.hcm.operations.employee-change-request-submit.action' as const;
export const EMPLOYEE_CHANGE_APPLY_ROUTE_CONTRACT =
  'route.hcm.operations.employee-change-request-apply.action' as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CODE = /^[A-Z][A-Z0-9_]{1,63}$/u;
const PUBLIC_ID = /^[A-Za-z0-9._:-]{1,128}$/u;
const DISPLAY_KEY = /^[a-z][a-z0-9._-]{1,127}$/u;
const COMPONENT_KEY = /^[a-z][a-z0-9._-]{0,127}$/u;
const CURSOR = /^[A-Za-z0-9_-]{16,1024}$/u;
const DATE = /^\d{4}-\d{2}-\d{2}$/u;

function invalid(kind: 'projection' | 'receipt'): never {
  throw new Error(`Employee-change ${kind} is invalid.`);
}

function exactRecord(
  value: unknown,
  keys: readonly string[],
  kind: 'projection' | 'receipt' = 'projection'
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(kind);
  const source = value as Record<string, unknown>;
  const actual = Object.keys(source).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    return invalid(kind);
  }
  return source;
}

function text(
  value: unknown,
  maximum: number,
  pattern?: RegExp,
  kind: 'projection' | 'receipt' = 'projection'
): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.length > maximum ||
    (pattern && !pattern.test(value))
  ) {
    return invalid(kind);
  }
  return value;
}

function integer(
  value: unknown,
  maximum = Number.MAX_SAFE_INTEGER,
  kind: 'projection' | 'receipt' = 'projection'
): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum
    ? value
    : invalid(kind);
}

function array(value: unknown, maximum: number): unknown[] {
  return Array.isArray(value) && value.length <= maximum ? value : invalid('projection');
}

function positiveInteger(value: unknown, kind: 'projection' | 'receipt' = 'projection'): number {
  const result = integer(value, Number.MAX_SAFE_INTEGER, kind);
  return result > 0 ? result : invalid(kind);
}

function uuid(value: unknown, kind: 'projection' | 'receipt' = 'projection'): string {
  return text(value, 36, UUID, kind);
}

function instant(value: unknown, kind: 'projection' | 'receipt' = 'projection'): string {
  const candidate = text(value, 100, undefined, kind);
  if (!candidate.includes('T') || !Number.isFinite(Date.parse(candidate))) return invalid(kind);
  return candidate;
}

function date(value: unknown): string {
  const candidate = text(value, 10, DATE);
  const parsed = new Date(`${candidate}T00:00:00Z`);
  if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== candidate) {
    return invalid('projection');
  }
  return candidate;
}

function aggregateValue(value: unknown): void {
  const source = exactRecord(value, ['itemCount', 'revision', 'asOf']);
  integer(source.itemCount);
  positiveInteger(source.revision);
  instant(source.asOf);
}

function statusValue(value: unknown): void {
  const source = exactRecord(value, ['code', 'revision']);
  text(source.code, 64, CODE);
  positiveInteger(source.revision);
}

function employmentValue(value: unknown): void {
  const source = exactRecord(value, ['effectiveFrom', 'effectiveTo', 'revision']);
  date(source.effectiveFrom);
  if (source.effectiveTo !== null) date(source.effectiveTo);
  positiveInteger(source.revision);
}

function fieldDecision(value: unknown, parseValue: (candidate: unknown) => void): 'VIEW' | 'MASK' {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid('projection');
  const candidate = value as Record<string, unknown>;
  if (candidate.decision === 'VIEW') {
    const source = exactRecord(candidate, ['decision', 'value']);
    parseValue(source.value);
    return 'VIEW';
  }
  if (candidate.decision === 'MASK') {
    const source = exactRecord(candidate, ['decision', 'value', 'maskReason', 'maskedDisplayKey']);
    if (source.value !== null) return invalid('projection');
    text(source.maskReason, 64, CODE);
    text(source.maskedDisplayKey, 128, DISPLAY_KEY);
    return 'MASK';
  }
  return invalid('projection');
}

const ACTION_BINDINGS = {
  'hris.action.hrm.create-employee-change-request': '/api/people/v1/hris/employee-change-requests',
  'hris.action.hrm.submit-employee-change-request':
    '/api/people/v1/hris/employee-change-requests/{requestPublicId}/submit',
  'hris.action.hrm.apply-employee-change-request':
    '/api/people/v1/hris/employee-change-requests/{requestPublicId}/apply',
} as const;

function action(value: unknown): void {
  const source = exactRecord(value, [
    'actionKey',
    'method',
    'hrefTemplate',
    'idempotencyPolicy',
    'stepUpPolicy',
  ]);
  const actionKey = text(source.actionKey, 128) as keyof typeof ACTION_BINDINGS;
  if (
    !(actionKey in ACTION_BINDINGS) ||
    source.method !== 'POST' ||
    source.hrefTemplate !== ACTION_BINDINGS[actionKey] ||
    source.idempotencyPolicy !== 'REQUIRED_IDEMPOTENCY_KEY' ||
    source.stepUpPolicy !== 'OWNER_PEP_RISK_POLICY_DECISION_REQUIRED'
  ) {
    invalid('projection');
  }
}

function validateItems(value: unknown): Readonly<{ view: number; mask: number; omit: number }> {
  let view = 0;
  let mask = 0;
  let omit = 0;
  for (const itemValue of array(value, 500)) {
    const item = exactRecord(itemValue, [
      'itemPublicId',
      'title',
      'statusCode',
      'fieldGroups',
      'deepLink',
      'availableActions',
    ]);
    const itemPublicId = uuid(item.itemPublicId);
    text(item.title, 512);
    const statusCode = text(item.statusCode, 64, CODE);
    if (
      !item.fieldGroups ||
      typeof item.fieldGroups !== 'object' ||
      Array.isArray(item.fieldGroups)
    ) {
      invalid('projection');
    }
    const groups = item.fieldGroups as Record<string, unknown>;
    if (
      Object.keys(groups).length === 0 ||
      Object.keys(groups).some(
        (key) => !['CHANGE_REQUEST_SUMMARY', 'APPROVAL_STATUS', 'EMPLOYMENT'].includes(key)
      )
    ) {
      invalid('projection');
    }
    const parsers = {
      CHANGE_REQUEST_SUMMARY: aggregateValue,
      APPROVAL_STATUS: statusValue,
      EMPLOYMENT: employmentValue,
    } as const;
    for (const key of Object.keys(parsers) as (keyof typeof parsers)[]) {
      if (groups[key] === undefined) {
        omit += 1;
      } else if (fieldDecision(groups[key], parsers[key]) === 'VIEW') {
        view += 1;
      } else {
        mask += 1;
      }
    }
    const deepLink = exactRecord(item.deepLink, ['route', 'resourcePublicId']);
    if (
      deepLink.route !== EMPLOYEE_CHANGE_ROUTE ||
      uuid(deepLink.resourcePublicId) !== itemPublicId
    ) {
      invalid('projection');
    }
    const actions = array(item.availableActions, 3);
    actions.forEach(action);
    const actionKeys = actions.map((candidate) => (candidate as Record<string, unknown>).actionKey);
    if (new Set(actionKeys).size !== actionKeys.length) invalid('projection');
    if (
      (actionKeys.includes('hris.action.hrm.submit-employee-change-request') &&
        statusCode !== 'DRAFT') ||
      (actionKeys.includes('hris.action.hrm.apply-employee-change-request') &&
        statusCode !== 'APPROVED') ||
      (actionKeys.includes('hris.action.hrm.submit-employee-change-request') &&
        actionKeys.includes('hris.action.hrm.apply-employee-change-request'))
    ) {
      invalid('projection');
    }
  }
  return { view, mask, omit };
}

export function parseEmployeeChangeProjection(value: unknown): EmployeeChangeProjection {
  const source = exactRecord(value, [
    'projectionVersion',
    'asOf',
    'variantKey',
    'queryState',
    'items',
  ]);
  if (source.projectionVersion !== '1' || source.variantKey !== 'EMPLOYEE_CHANGE_REQUESTS') {
    invalid('projection');
  }
  instant(source.asOf);
  const state = exactRecord(source.queryState, [
    'state',
    'scopeDecisionRevision',
    'freshness',
    'nextCursor',
    'fieldDecisionSummary',
    'partialFailures',
    'correlationId',
    'cachePolicy',
  ]);
  if (!['COMPLETE', 'EMPTY', 'PARTIAL', 'UNAVAILABLE'].includes(String(state.state))) {
    invalid('projection');
  }
  if (!['CURRENT', 'STALE', 'UNAVAILABLE'].includes(String(state.freshness))) {
    invalid('projection');
  }
  text(state.scopeDecisionRevision, 128, PUBLIC_ID);
  if (state.nextCursor !== null) text(state.nextCursor, 1024, CURSOR);
  uuid(state.correlationId);
  const failures = array(state.partialFailures, 32);
  for (const failureValue of failures) {
    const failure = exactRecord(failureValue, [
      'componentKey',
      'errorCode',
      'correlationId',
      'retryable',
    ]);
    text(failure.componentKey, 128, COMPONENT_KEY);
    text(failure.errorCode, 64, CODE);
    uuid(failure.correlationId);
    if (typeof failure.retryable !== 'boolean') invalid('projection');
  }
  const cache = exactRecord(state.cachePolicy, [
    'authorizationDecisionRevision',
    'invalidationEvent',
    'maxAgeSeconds',
  ]);
  text(cache.authorizationDecisionRevision, 128, PUBLIC_ID);
  if (cache.invalidationEvent !== 'dwp.hris.access.assignment.changed.v1') {
    invalid('projection');
  }
  integer(cache.maxAgeSeconds, 300);
  const counts = validateItems(source.items);
  const items = source.items as unknown[];
  if (
    (['EMPTY', 'UNAVAILABLE'].includes(String(state.state)) && items.length !== 0) ||
    (state.state === 'PARTIAL' && failures.length === 0) ||
    (state.state === 'PARTIAL' && state.freshness !== 'STALE') ||
    (state.state === 'COMPLETE' &&
      (failures.length !== 0 || items.length === 0 || state.freshness !== 'CURRENT')) ||
    (state.state === 'EMPTY' &&
      (failures.length !== 0 || state.freshness !== 'CURRENT' || state.nextCursor !== null)) ||
    (state.state === 'UNAVAILABLE' &&
      (state.freshness !== 'UNAVAILABLE' || state.nextCursor !== null))
  ) {
    invalid('projection');
  }
  const summary = exactRecord(state.fieldDecisionSummary, [
    'viewCount',
    'maskedCount',
    'omittedCount',
  ]);
  if (
    integer(summary.viewCount) !== counts.view ||
    integer(summary.maskedCount) !== counts.mask ||
    integer(summary.omittedCount) !== counts.omit
  ) {
    invalid('projection');
  }
  return Object.freeze(source) as unknown as EmployeeChangeProjection;
}

export const parseEmployeeChangeCommandReceipt = parseHrisCommandReceipt;

export function employeeChangeItemVersion(item: EmployeeChangeItem): number | null {
  const status = item.fieldGroups.APPROVAL_STATUS;
  return status?.decision === 'VIEW' ? status.value.revision : null;
}

export function hasEmployeeChangeAction(
  item: EmployeeChangeItem | null,
  actionKey: EmployeeChangeAction['actionKey']
): boolean {
  return Boolean(item?.availableActions.some((action) => action.actionKey === actionKey));
}
