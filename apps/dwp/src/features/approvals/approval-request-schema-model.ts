import {
  assertSupportedApprovalFormSchema,
  isApprovalTypedFormSchema,
} from '@dwp-frontend/shared-utils';

import {
  evaluateApprovalTypedForm,
  withoutApprovalTypedComputedValues,
} from './approval-form-typed-evaluator';
import { ApprovalTypedFormError, freezeTypedJson } from './approval-form-typed-model';

import type {
  ApprovalFormSchema,
  ApprovalTypedFormEvaluation,
  ApprovalRequestDetail,
} from '@dwp-frontend/shared-utils';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';

export function approvalRequestSchemaKind(schema: ApprovalFormSchema | undefined) {
  if (!schema) return 'ABSENT' as const;
  try {
    assertSupportedApprovalFormSchema(schema);
    return isApprovalTypedFormSchema(schema) ? ('TYPED' as const) : ('LEGACY' as const);
  } catch {
    return 'UNSUPPORTED' as const;
  }
}

export function approvalRequestLegacyValues(
  values: Readonly<Record<string, unknown>>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => {
      if (typeof value === 'string') return [key, value];
      if (value == null) return [key, ''];
      if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))
        return [key, String(value)];
      throw new ApprovalTypedFormError('Legacy fields cannot flatten structured values.', key);
    })
  );
}

/** Only an authoritative fetched base may have previously calculated values removed. */
export function approvalRequestStoredEditingValues(
  detail: ApprovalRequestDetail,
  compiled?: CompiledApprovalTypedForm | null
): Record<string, unknown> {
  const kind = approvalRequestSchemaKind(detail.formSchema);
  if (kind === 'UNSUPPORTED') throw new ApprovalTypedFormError('Unsupported stored form schema.');
  if (
    kind === 'TYPED' &&
    (!compiled || compiled.canonicalJson !== JSON.stringify(freezeTypedJson(detail.formSchema)))
  ) {
    throw new ApprovalTypedFormError('Stored editing base must use the exact compiled schema.');
  }
  const payload =
    kind === 'TYPED'
      ? compiled
        ? withoutApprovalTypedComputedValues(compiled, detail.payload)
        : (() => {
            throw new ApprovalTypedFormError('Stored typed form must be compiled first.');
          })()
      : approvalRequestLegacyValues(detail.payload);
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => !['summary', 'createdFrom'].includes(key))
  );
}

export function approvalRequestPublishedSchemaMatches(
  compiled: CompiledApprovalTypedForm | null,
  hash: string | undefined
): boolean {
  return Boolean(compiled && hash && /^[a-f0-9]{64}$/.test(hash) && compiled.schemaSha256 === hash);
}

export function approvalRequestTypedEvaluation(
  compiled: CompiledApprovalTypedForm,
  values: Readonly<Record<string, unknown>>,
  summary: string,
  mode: 'DRAFT' | 'SUBMIT'
): ApprovalTypedFormEvaluation {
  // Fresh UI values are validated as supplied, including any unexpected computed input.
  return evaluateApprovalTypedForm(
    compiled,
    { ...structuredClone(values), summary: summary.trim(), createdFrom: 'DWP_APPROVALS' },
    mode
  );
}

export function approvalRequestFieldValue(
  payload: Readonly<Record<string, unknown>>,
  path: string
): unknown {
  const match = /^([a-z][A-Za-z0-9_]*)(?:\[(\d+)\]\.([a-z][A-Za-z0-9_]*))?$/.exec(path);
  if (!match) return undefined;
  const value = payload[match[1]!];
  if (match[2] === undefined) return value;
  if (!Array.isArray(value)) return undefined;
  const row: unknown = value[Number(match[2])];
  return row && typeof row === 'object' && !Array.isArray(row)
    ? Object.getOwnPropertyDescriptor(row, match[3]!)?.value
    : undefined;
}

export function approvalRequestValuePresent(value: unknown): boolean {
  return Array.isArray(value)
    ? value.length > 0
    : typeof value === 'string'
      ? Boolean(value.trim())
      : value != null;
}
