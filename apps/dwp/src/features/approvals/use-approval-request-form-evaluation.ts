import { useMemo } from 'react';
import { isApprovalTypedFormSchema } from '@dwp-frontend/shared-utils';

import { useApprovalFormSchemaValidation } from './approval-form-schema-validation';
import { ApprovalTypedFormError } from './approval-form-typed-model';
import {
  approvalRequestSchemaKind,
  approvalRequestLegacyValues,
  approvalRequestTypedEvaluation,
  approvalRequestFieldValue,
  approvalRequestValuePresent,
} from './approval-request-schema-model';

import type { ApprovalFormSchema, ApprovalTypedFormEvaluation } from '@dwp-frontend/shared-utils';

function checked(operation: () => ApprovalTypedFormEvaluation) {
  try {
    return { evaluation: operation(), error: undefined };
  } catch (error) {
    return {
      evaluation: undefined,
      error:
        error instanceof ApprovalTypedFormError
          ? error
          : new ApprovalTypedFormError('Form evaluation failed.'),
    };
  }
}

export function useApprovalRequestFormEvaluation({
  schema,
  values,
  summary,
  enabled,
}: {
  schema?: ApprovalFormSchema;
  values: Readonly<Record<string, unknown>>;
  summary: string;
  enabled: boolean;
}) {
  const kind = approvalRequestSchemaKind(schema);
  const typedSchema =
    schema && kind === 'TYPED' && isApprovalTypedFormSchema(schema) ? schema : undefined;
  const validation = useApprovalFormSchemaValidation(typedSchema, enabled);
  const legacyFields =
    schema && kind === 'LEGACY' && !isApprovalTypedFormSchema(schema) ? schema.fields : [];
  const legacy = useMemo(() => {
    if (kind === 'TYPED' || kind === 'UNSUPPORTED') return { values: {}, invalid: false };
    try {
      return { values: approvalRequestLegacyValues(values), invalid: false };
    } catch {
      return { values: {}, invalid: true };
    }
  }, [kind, values]);
  const draft = useMemo(
    () =>
      validation.compiled
        ? checked(() =>
            approvalRequestTypedEvaluation(validation.compiled!, values, summary, 'DRAFT')
          )
        : undefined,
    [validation.compiled, values, summary]
  );
  const submit = useMemo(
    () =>
      validation.compiled
        ? checked(() =>
            approvalRequestTypedEvaluation(validation.compiled!, values, summary, 'SUBMIT')
          )
        : undefined,
    [validation.compiled, values, summary]
  );
  const schemaReady = kind !== 'UNSUPPORTED' && (kind !== 'TYPED' || Boolean(validation.compiled));
  const draftValid =
    schemaReady && !legacy.invalid && (kind !== 'TYPED' || Boolean(draft?.evaluation));
  const submitValid = draftValid && (kind !== 'TYPED' || Boolean(submit?.evaluation));
  const required = draft?.evaluation?.requiredFields ?? [];
  const missing = required.filter(
    (path) =>
      !approvalRequestValuePresent(approvalRequestFieldValue(draft!.evaluation!.payload, path))
  );
  const problemKey =
    kind === 'UNSUPPORTED' || validation.invalid
      ? 'requests.typed.schemaInvalid'
      : validation.pending
        ? 'requests.typed.schemaLoading'
        : legacy.invalid || (validation.compiled && !draft?.evaluation)
          ? 'requests.typed.inputInvalid'
          : undefined;
  return {
    kind,
    compiled: validation.compiled,
    schemaReady,
    draftValid,
    submitValid,
    draftEvaluation: draft?.evaluation,
    submitEvaluation: submit?.evaluation,
    draftError: draft?.error,
    submitError: submit?.error,
    legacyValues: legacy.values,
    legacyFields,
    problemKey,
    required,
    missing,
  };
}
