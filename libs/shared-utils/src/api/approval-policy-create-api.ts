import { axiosInstance } from '../axios-instance';
import { approvalMutationExecutionConfig } from './approval-governed-mutation';

import type { ApiResponse } from '../types';
import type { ApprovalMutationExecution } from './approval-governed-mutation';
import type { ApprovalPolicy } from './approval-management-contract';

const POLICY_KEY = /^[A-Z][A-Z0-9_.-]{2,99}$/u;
const RULE_KEY = /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/u;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/u;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const POLICY_TYPES = new Set(['IDENTITY', 'DECISION', 'SLA', 'DATA', 'SEGREGATION_OF_DUTIES']);
const ENFORCEMENT_MODES = new Set(['BLOCK', 'WARN', 'MONITOR']);
const SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const LIFECYCLE_STATES = new Set(['ACTIVE', 'DISABLED', 'RETIRED']);
const INPUT_KEYS = [
  'policyKey',
  'nameKo',
  'nameEn',
  'policyType',
  'enforcementMode',
  'severity',
  'lifecycleState',
  'rule',
  'changeReason',
] as const;

export type ApprovalPolicyCreateInput = Readonly<{
  policyKey: string;
  nameKo: string;
  nameEn: string;
  policyType: 'IDENTITY' | 'DECISION' | 'SLA' | 'DATA' | 'SEGREGATION_OF_DUTIES';
  enforcementMode: 'BLOCK' | 'WARN' | 'MONITOR';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  lifecycleState: 'ACTIVE' | 'DISABLED' | 'RETIRED';
  rule: Readonly<Record<string, unknown>>;
  changeReason: string;
}>;

export type ApprovalPolicyCreateOptions = Readonly<{
  contextScopeKey: string;
  expectedMakerId: string;
  idempotencyKey: string;
  beforeDispatch: () => void;
  onDispatch?: () => void;
}>;

export class ApprovalPolicyCreateContractError extends TypeError {
  constructor() {
    super('Invalid approval policy draft creation contract.');
    this.name = 'ApprovalPolicyCreateContractError';
  }
}

export class ApprovalPolicyCreateResponseError extends Error {
  constructor() {
    super('The created approval policy draft response is unverifiable.');
    this.name = 'ApprovalPolicyCreateResponseError';
  }
}

function invalid(): never {
  throw new ApprovalPolicyCreateContractError();
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}

function responseInvalid(): never {
  throw new ApprovalPolicyCreateResponseError();
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonical(entry)])
  );
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function safeRuleValue(value: unknown, depth: number): boolean {
  if (depth > 8) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isSafeInteger(value);
  if (Array.isArray(value)) {
    return value.length <= 100 && value.every((entry) => safeRuleValue(entry, depth + 1));
  }
  if (!value || typeof value !== 'object') return false;
  const entries = Object.entries(value as Record<string, unknown>);
  return (
    entries.length <= 64 &&
    entries.every(([key, entry]) => RULE_KEY.test(key) && safeRuleValue(entry, depth + 1))
  );
}

function canonicalText(value: unknown, min: number, max: number): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length >= min &&
    value.length <= max
  );
}

function validateInput(value: ApprovalPolicyCreateInput): ApprovalPolicyCreateInput {
  const input = record(value);
  const keys = Object.keys(input).sort();
  if (
    keys.length !== INPUT_KEYS.length ||
    !INPUT_KEYS.every((key) => Object.prototype.hasOwnProperty.call(input, key)) ||
    typeof input.policyKey !== 'string' ||
    !POLICY_KEY.test(input.policyKey) ||
    !canonicalText(input.nameKo, 1, 200) ||
    !canonicalText(input.nameEn, 1, 200) ||
    typeof input.policyType !== 'string' ||
    !POLICY_TYPES.has(input.policyType) ||
    typeof input.enforcementMode !== 'string' ||
    !ENFORCEMENT_MODES.has(input.enforcementMode) ||
    typeof input.severity !== 'string' ||
    !SEVERITIES.has(input.severity) ||
    typeof input.lifecycleState !== 'string' ||
    !LIFECYCLE_STATES.has(input.lifecycleState) ||
    !canonicalText(input.changeReason, 10, 1000)
  ) {
    invalid();
  }
  const rule = record(input.rule);
  const entries = Object.entries(rule);
  if (
    entries.length < 1 ||
    entries.length > 64 ||
    !entries.every(([key, entry]) => RULE_KEY.test(key) && safeRuleValue(entry, 1)) ||
    new TextEncoder().encode(JSON.stringify(rule)).byteLength > 65_536
  ) {
    invalid();
  }
  return structuredClone(value);
}

function readCreatedPolicy(
  value: unknown,
  input: ApprovalPolicyCreateInput,
  expectedMakerId: string
): ApprovalPolicy {
  const policy = record(value);
  const pendingAt = policy.pendingAt;
  if (
    typeof policy.policyId !== 'string' ||
    !UUID.test(policy.policyId) ||
    policy.policyKey !== input.policyKey ||
    policy.nameKo !== input.nameKo ||
    policy.nameEn !== input.nameEn ||
    policy.policyType !== input.policyType ||
    policy.enforcementMode !== 'MONITOR' ||
    policy.severity !== 'LOW' ||
    policy.lifecycleState !== 'DISABLED' ||
    policy.version !== 0 ||
    policy.pendingReview !== true ||
    policy.pendingEnforcementMode !== input.enforcementMode ||
    policy.pendingSeverity !== input.severity ||
    policy.pendingLifecycleState !== input.lifecycleState ||
    policy.pendingChangeReason !== input.changeReason ||
    String(policy.pendingBy ?? '') !== expectedMakerId ||
    typeof pendingAt !== 'string' ||
    !Number.isFinite(Date.parse(pendingAt)) ||
    !same(policy.rule, input.rule) ||
    !same(policy.pendingRule, input.rule)
  ) {
    responseInvalid();
  }
  return structuredClone(policy) as ApprovalPolicy;
}

export async function createApprovalPolicyDraft(
  input: ApprovalPolicyCreateInput,
  execution: ApprovalMutationExecution,
  options: ApprovalPolicyCreateOptions
): Promise<ApprovalPolicy> {
  const original = validateInput(input);
  if (
    execution.mode !== 'SECURE' ||
    !['110', '111'].includes(execution.rolloutState) ||
    execution.contextScopeKey !== options.contextScopeKey ||
    execution.objectVersion !== undefined ||
    execution.stepUp !== undefined ||
    (execution.idempotencyKey !== undefined &&
      execution.idempotencyKey !== options.idempotencyKey) ||
    !options.contextScopeKey.trim() ||
    !/^[1-9][0-9]*$/u.test(options.expectedMakerId) ||
    !IDEMPOTENCY_KEY.test(options.idempotencyKey) ||
    typeof options.beforeDispatch !== 'function'
  ) {
    invalid();
  }
  const authority = { ...execution, idempotencyKey: options.idempotencyKey } as const;
  const config = approvalMutationExecutionConfig(authority);
  let dispatchChecks = 0;
  const response = await axiosInstance.post<ApiResponse<unknown>, ApprovalPolicyCreateInput>(
    '/api/approvals/v1/admin/policies',
    original,
    {
      ...config,
      headers: { ...config.headers, 'Idempotency-Key': options.idempotencyKey },
      beforeDispatch: () => {
        options.beforeDispatch();
        dispatchChecks += 1;
        if (dispatchChecks === 2) options.onDispatch?.();
      },
      csrfReplay: 'NEVER',
    }
  );
  options.beforeDispatch();
  return readCreatedPolicy(response.data.data, original, options.expectedMakerId);
}
