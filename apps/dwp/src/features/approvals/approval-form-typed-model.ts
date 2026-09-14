import Decimal from 'decimal.js';
import { Temporal } from 'temporal-polyfill';

import type {
  ApprovalTypedCalculation,
  ApprovalTypedCondition,
  ApprovalTypedField,
  ApprovalTypedFormSchema,
} from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';

// Every intermediate is bounded to 28 digits. A multiply needs at most 56 exact digits before rejection.
export const ApprovalDecimal = Decimal.clone({ precision: 128, rounding: Decimal.ROUND_HALF_UP });

export interface CompiledApprovalTypedField {
  readonly key: string;
  readonly type: ApprovalTypedField['type'];
  readonly required: boolean;
  readonly options: readonly string[];
  readonly visibleWhen: ApprovalTypedCondition | null;
  readonly requiredWhen: ApprovalTypedCondition | null;
  readonly calculation: ApprovalTypedCalculation | null;
  readonly min: string | null;
  readonly max: string | null;
  readonly minLength: number;
  readonly maxLength: number;
  readonly minRows: number;
  readonly maxRows: number;
  readonly children: CompiledApprovalTypedScope | null;
}

export interface CompiledApprovalTypedScope {
  readonly fields: Readonly<Record<string, CompiledApprovalTypedField>>;
  readonly order: readonly CompiledApprovalTypedField[];
}

export interface CompiledApprovalTypedForm {
  readonly definition: ApprovalTypedFormSchema;
  readonly canonicalJson: string;
  readonly schemaSha256: string;
  readonly scope: CompiledApprovalTypedScope;
}

export class ApprovalTypedFormError extends Error {
  constructor(
    message: string,
    readonly fieldPath?: string
  ) {
    super(message);
    this.name = 'ApprovalTypedFormError';
  }
}

export function typedFormInvalid(message: string, path?: string): never {
  throw new ApprovalTypedFormError(message, path);
}

export function typedJavaBlank(value: string): boolean {
  const ranges = [
    [9, 13],
    [28, 32],
    [0x1680, 0x1680],
    [0x2000, 0x2006],
    [0x2008, 0x200a],
    [0x2028, 0x2029],
    [0x205f, 0x205f],
    [0x3000, 0x3000],
  ] as const;
  return Array.from(value).every((character) =>
    ranges.some(([start, end]) => {
      const code = character.codePointAt(0)!;
      return code >= start && code <= end;
    })
  );
}

export function typedJavaTrim(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value.charCodeAt(start) <= 32) start++;
  while (end > start && value.charCodeAt(end - 1) <= 32) end--;
  return value.slice(start, end);
}

export function typedDecimal(value: unknown): Decimal {
  if (
    (typeof value !== 'string' && typeof value !== 'number') ||
    (typeof value === 'number' && !Number.isSafeInteger(value))
  )
    typedFormInvalid('Decimals must be plain strings or safe integer JSON numbers.');
  const text = String(value);
  if (text.length > 40 || !/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(text)) {
    typedFormInvalid('Invalid plain decimal representation.');
  }
  return boundedTypedDecimal(new ApprovalDecimal(text));
}

export function boundedTypedDecimal(value: Decimal): Decimal {
  if (!value.isFinite() || value.precision(true) > 28 || value.decimalPlaces() > 8) {
    typedFormInvalid('Decimal exceeds precision 28 or scale 8.');
  }
  return value;
}

export function typedNumeric(field: CompiledApprovalTypedField): boolean {
  return field.type === 'NUMBER' || field.type === 'CALCULATED_NUMBER';
}

export function typedObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    typedFormInvalid('Expected an object.');
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== null && prototype !== Object.prototype)
    typedFormInvalid('Expected a plain JSON object.');
  return value as Record<string, unknown>;
}

export function typedDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) typedFormInvalid('Expected an ISO calendar date.');
  try {
    Temporal.PlainDate.from(value, { overflow: 'reject' });
  } catch {
    typedFormInvalid('Invalid calendar date.');
  }
}

export function freezeTypedJson(value: unknown): unknown {
  const budget = { nodes: 0, text: 0 };
  function copy(input: unknown, depth: number): unknown {
    if (depth > 32 || ++budget.nodes > 50000)
      typedFormInvalid('JSON complexity exceeds the limit.');
    if (typeof input === 'string') {
      budget.text += input.length;
      if (budget.text > 200000) typedFormInvalid('JSON text exceeds the limit.');
      return input;
    }
    if (input === null || typeof input === 'boolean') return input;
    if (typeof input === 'number') {
      if (!Number.isSafeInteger(input))
        typedFormInvalid('Schema JSON numbers must be safe integers.');
      return Object.is(input, -0) ? 0 : input;
    }
    if (Array.isArray(input)) return Object.freeze(input.map((item) => copy(item, depth + 1)));
    const object = typedObject(input);
    return Object.freeze(
      Object.fromEntries(
        Object.keys(object)
          .sort()
          .map((key) => [key, copy(object[key], depth + 1)])
      )
    );
  }
  return copy(value, 0);
}
