import { useEffect, useState } from 'react';
import {
  compileApprovalTypedForm,
  requireApprovalTypedSummary,
} from './approval-form-typed-compiler';
import { ApprovalTypedFormError } from './approval-form-typed-model';

import type { ApprovalTypedFormSchema } from '@dwp-frontend/shared-utils/api/approval-form-typed-contract';
import type { CompiledApprovalTypedForm } from './approval-form-typed-model';

type Result = {
  schema: ApprovalTypedFormSchema;
  compiled: CompiledApprovalTypedForm | null;
  errorPath?: string;
  invalid: boolean;
};

export function useApprovalFormSchemaValidation(
  schema: ApprovalTypedFormSchema | undefined,
  enabled: boolean
) {
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    if (!schema || !enabled) return;
    let current = true;
    void compileApprovalTypedForm(schema)
      .then((compiled) => {
        requireApprovalTypedSummary(compiled);
        if (current) setResult({ schema, compiled, invalid: false });
      })
      .catch((error: unknown) => {
        if (current)
          setResult({
            schema,
            compiled: null,
            invalid: true,
            errorPath: error instanceof ApprovalTypedFormError ? error.fieldPath : undefined,
          });
      });
    return () => {
      current = false;
    };
  }, [enabled, schema]);
  const latest = enabled && schema && result?.schema === schema ? result : null;
  return {
    compiled: latest?.compiled ?? null,
    invalid: latest?.invalid ?? false,
    errorPath: latest?.errorPath,
    pending: Boolean(schema && enabled && !latest),
  };
}
